// Minimal OpenAI-compatible mock for manual end-to-end checks of the Shield UI:
//   node scripts/mock-llm.mjs 4901
//   LLM_CHAT_BASE_URL=http://127.0.0.1:4901/v1 LLM_CHAT_API_KEY=x LLM_CHAT_MODEL=mock pnpm dev
// It cites the first <source id="N"> it is shown, splits the citation token across chunks (to exercise
// the streaming validator), cites an id that was never retrieved, and adds an invented quotation.
import http from 'node:http';

const port = Number(process.argv[2] ?? 4901);

http
	.createServer(async (req, res) => {
		if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
			res.writeHead(404).end();
			return;
		}
		let body = '';
		for await (const chunk of req) body += chunk;
		const request = JSON.parse(body);
		const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
		const id = /<source id="(\d+)"/.exec(system)?.[1] ?? '0';

		const pieces = [
			'Neutrality is not isolation ',
			'[',
			'[sr',
			`c:${id}`,
			']] ',
			'and the Convention says "every neutral state must keep a large standing army at all times" ',
			'[[src:999999]]. ',
			'Stay on message.'
		];
		if (!request.stream) {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ choices: [{ message: { content: pieces.join('') } }] }));
			return;
		}
		res.writeHead(200, { 'content-type': 'text/event-stream' });
		for (const p of pieces) {
			res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`);
			await new Promise((r) => setTimeout(r, 120));
		}
		res.write('data: [DONE]\n\n');
		res.end();
	})
	.listen(port, '127.0.0.1', () => console.log(`mock LLM on http://127.0.0.1:${port}/v1`));
