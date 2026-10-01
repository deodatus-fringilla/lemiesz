// Smoke test for the BUILT server (run `pnpm build` first): pnpm smoke
// Starts build/index.js on a temporary database, then checks health, auth and the review rules
// over real HTTP.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemiesz-smoke-'));
const PASSWORD = 'smoke-test-passphrase';

const server = spawn(process.execPath, ['build/index.js'], {
	env: {
		...process.env,
		PORT: String(PORT),
		HOST: '127.0.0.1',
		ORIGIN: BASE,
		NODE_ENV: 'production',
		DATABASE_PATH: path.join(dir, 'smoke.db'),
		ADMIN_USERNAME: 'smoke',
		ADMIN_PASSWORD: PASSWORD
	},
	stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

let failures = 0;
const check = (name, ok, extra = '') => {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`);
	if (!ok) failures++;
};

async function waitForHealth() {
	for (let i = 0; i < 100; i++) {
		try {
			const r = await fetch(`${BASE}/api/health`);
			if (r.ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error('server did not become healthy\n' + log);
}

const noRedirect = { redirect: 'manual' };

try {
	await waitForHealth();
	check('health is public and ok', (await fetch(`${BASE}/api/health`)).status === 200);

	let r = await fetch(`${BASE}/api/sources`);
	check('API without a session is 401', r.status === 401, String(r.status));
	r = await fetch(`${BASE}/repository`, noRedirect);
	check('page without a session redirects to /login', r.status === 303 && r.headers.get('location') === '/login', String(r.status));
	r = await fetch(`${BASE}/login`);
	check('login page is public', r.status === 200);

	// Unauthenticated form action must not write anything
	r = await fetch(`${BASE}/repository?/delete`, {
		method: 'POST',
		headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
		body: 'sourceId=1',
		...noRedirect
	});
	check('unauthenticated form action is refused', r.status === 303 || r.status === 401 || r.status === 403, String(r.status));

	// Wrong password
	r = await fetch(`${BASE}/login`, {
		method: 'POST',
		headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
		body: 'username=smoke&password=wrong-wrong-wrong',
		...noRedirect
	});
	check('wrong password does not create a session', !(r.headers.get('set-cookie') ?? '').includes('session='), String(r.status));

	// Real login
	r = await fetch(`${BASE}/login`, {
		method: 'POST',
		headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
		body: `username=smoke&password=${PASSWORD}`,
		...noRedirect
	});
	const setCookie = r.headers.get('set-cookie') ?? '';
	check('login succeeds and sets an HttpOnly session cookie', r.status === 303 && /session=/.test(setCookie) && /HttpOnly/i.test(setCookie), `${r.status} ${setCookie}`);
	const cookie = setCookie.split(';')[0];
	const authed = { headers: { cookie } };

	r = await fetch(`${BASE}/api/sources`, authed);
	const list = await r.json();
	check('API with a session lists seeded sources', r.status === 200 && list.total >= 7, JSON.stringify(list).slice(0, 200));
	check('seeded sources are all drafts', list.sources.every((s) => Object.values(s.translations).every((t) => t.review === 'draft')));

	r = await fetch(`${BASE}/repository`, authed);
	check('repository page renders (Polish by default)', r.status === 200 && (await r.text()).includes('Repozytorium'));

	for (const page of ['/arguments', '/review', '/']) {
		r = await fetch(BASE + page, authed);
		check('page ' + page + ' renders', r.status === 200, String(r.status));
	}
	r = await fetch(BASE + '/review', authed);
	check('review queue lists the seeded drafts', (await r.text()).includes('Pacem in Terris'));

	// Editing text via API cannot smuggle in an approval
	const id = list.sources[0].id;
	const locale = Object.keys(list.sources[0].translations)[0];
	const text = list.sources[0].translations[locale].text;
	r = await fetch(`${BASE}/api/sources/${id}`, {
		method: 'PUT',
		headers: { ...authed.headers, 'content-type': 'application/json' },
		body: JSON.stringify({ locale, text: text + ' ', review: 'human_approved', actor: 'someone-else' })
	});
	const put = await r.json();
	check('PUT ignores a client-supplied review state', put.source?.translations[locale].review === 'draft', JSON.stringify(put).slice(0, 200));

	// Human approval is a separate, audited call
	r = await fetch(`${BASE}/api/sources/${id}/review`, {
		method: 'POST',
		headers: { ...authed.headers, 'content-type': 'application/json' },
		body: JSON.stringify({ locale, to: 'human_approved' })
	});
	check('a signed-in human can approve', r.status === 200, String(r.status));
	r = await fetch(`${BASE}/api/sources/${id}/review`, {
		method: 'POST',
		headers: { ...authed.headers, 'content-type': 'application/json' },
		body: JSON.stringify({ locale, to: 'ai_verified' })
	});
	check('a human cannot set ai_verified', r.status === 403, String(r.status));

	// ---- Shield (SSE) ----
	const chat = async (message, headers = authed.headers) => {
		const res = await fetch(`${BASE}/api/chat`, {
			method: 'POST',
			headers: { ...headers, 'content-type': 'application/json' },
			body: JSON.stringify({ message, locale: 'en' })
		});
		const body = await res.text();
		const events = body
			.split('\n\n')
			.filter(Boolean)
			.map((block) => ({
				type: /^event: (.+)$/m.exec(block)?.[1],
				data: JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? 'null')
			}));
		return { res, events };
	};
	let c = await chat('anything', {});
	check('chat without a session is 401', c.res.status === 401, String(c.res.status));

	// Everything is still a draft except the one text approved above, so a draft-only topic finds nothing…
	c = await chat('war is no longer a fit instrument with which to repair the violation of justice');
	check('chat streams text/event-stream', (c.res.headers.get('content-type') ?? '').includes('text/event-stream'));
	check('first event is sources', c.events[0]?.type === 'sources', JSON.stringify(c.events[0]).slice(0, 120));
	check('draft sources are not retrieved: "no strong source", model not needed', c.events[0].data.tier === 'none' && c.events.at(-1).data.noSource === true);

	// …while the approved text is found. (Approve a known seed row, then ask about it.)
	const pit = list.sources.find((s) => s.work.startsWith('Pacem in Terris') && s.section_ref === '§127');
	r = await fetch(`${BASE}/api/sources/${pit.id}/review`, {
		method: 'POST',
		headers: { ...authed.headers, 'content-type': 'application/json' },
		body: JSON.stringify({ locale: 'en', to: 'human_approved' })
	});
	c = await chat('war is no longer a fit instrument with which to repair the violation of justice');
	check('approved source is retrieved; evidence is sent before any token', c.events[0].data.tier === 'sources' && c.events[0].data.sources[0].id === pit.id, JSON.stringify(c.events[0].data).slice(0, 160));
	check('without a chat model the stream still completes with done (llm:false)', c.events.at(-1).type === 'done' && c.events.at(-1).data.llm === false);

	// Cross-site form post must be rejected by SvelteKit's origin check
	r = await fetch(`${BASE}/logout`, {
		method: 'POST',
		headers: { cookie, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' },
		body: '',
		...noRedirect
	});
	check('cross-origin form POST is rejected', r.status === 403, String(r.status));

	r = await fetch(`${BASE}/logout`, {
		method: 'POST',
		headers: { cookie, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
		body: '',
		...noRedirect
	});
	check('logout works', r.status === 303);
	r = await fetch(`${BASE}/api/sources`, authed);
	check('session is invalid after logout', r.status === 401, String(r.status));
} catch (e) {
	console.error(e);
	failures++;
} finally {
	server.kill();
	fs.rmSync(dir, { recursive: true, force: true });
}

if (failures) {
	console.error(`\n${failures} check(s) failed.\n--- server log ---\n${log}`);
	process.exit(1);
}
console.log('\nAll smoke checks passed.');
