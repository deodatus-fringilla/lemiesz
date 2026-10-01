import { db } from '$lib/server/db';
import { listBackups, backupDir } from '$lib/server/backup';
import { authDisabled } from '$lib/server/auth';
import { getProvider } from '$lib/server/llm';
import { getTranslationCoverage, type Coverage } from '$lib/server/sources';
import { reviewQueue, sampleStats, type QueueReason, type SampleStats } from '$lib/server/pipeline/queue';
import type { Locale } from '$lib/i18n/locales';

export type WarningId =
	| 'origin_missing'
	| 'auth_disabled'
	| 'admin_password_in_env'
	| 'no_backup'
	| 'backup_stale'
	| 'backup_same_disk'
	| 'models_same_family'
	| 'chat_missing'
	| 'pipeline_missing'
	| 'embedder_off'
	| 'sampling_alert'
	| 'stale_cards'
	| 'nothing_approved';

export interface Warning {
	id: WarningId;
	severity: 'error' | 'warn' | 'info';
}

export interface PipelineHealth {
	runs30d: number;
	created: number;
	rejected: number;
	verified: number;
	flagged: number;
	/** Share of drafted cards stopped by the verbatim-quote check before they were stored. A rising rate means the drafter is inventing quotes. */
	fabricationRate: number | null;
	last: { at: string; drafter: string | null; auditor: string | null; created: number; rejected: number; verified: number; flagged: number } | null;
}

export interface Dashboard {
	counts: { sources: number; arguments: number; approvedTexts: number; users: number; drafts: number };
	queue: Record<QueueReason, number>;
	sampling: SampleStats;
	pipeline: PipelineHealth;
	coverage: Record<Locale, Coverage>;
	config: {
		auth: 'enabled' | 'disabled';
		chat: boolean;
		drafter: boolean;
		auditor: boolean;
		embedder: string;
		ragVectorMin: number;
	};
	backup: { dir: string; count: number; last: { file: string; bytes: number; at: string } | null; ageHours: number | null; intervalHours: number };
	recent: { at: string; actor: string; ownerType: string; ownerId: number; locale: string; from: string; to: string }[];
	topUsed: { ownerType: string; ownerId: number; uses: number; title: string }[];
	warnings: Warning[];
}

const n = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

export function pipelineHealth(): PipelineHealth {
	const agg = db
		.prepare(
			`SELECT COUNT(*) AS runs, COALESCE(SUM(created_count), 0) AS created, COALESCE(SUM(rejected_count), 0) AS rejected,
				COALESCE(SUM(verified_count), 0) AS verified, COALESCE(SUM(flagged_count), 0) AS flagged
			 FROM pipeline_runs WHERE kind = 'draft' AND at >= datetime('now', '-30 days')`
		)
		.get() as { runs: number; created: number; rejected: number; verified: number; flagged: number };
	const last = db
		.prepare(
			`SELECT at, drafter_model AS drafter, auditor_model AS auditor, created_count AS created, rejected_count AS rejected,
				verified_count AS verified, flagged_count AS flagged FROM pipeline_runs WHERE kind = 'draft' ORDER BY id DESC LIMIT 1`
		)
		.get() as PipelineHealth['last'] | undefined;
	const proposed = agg.created + agg.rejected;
	return {
		runs30d: agg.runs,
		created: agg.created,
		rejected: agg.rejected,
		verified: agg.verified,
		flagged: agg.flagged,
		fabricationRate: proposed === 0 ? null : agg.rejected / proposed,
		last: last ?? null
	};
}

/** Everything the dashboard shows, and the warnings an operator should act on. Cheap queries only. */
export function collectDashboard(env: Record<string, string | undefined> = process.env): Dashboard {
	const queueItems = reviewQueue();
	const queue: Record<QueueReason, number> = { flagged: 0, stale: 0, draft: 0, sampled: 0 };
	for (const q of queueItems) queue[q.reason]++;

	const sampling = sampleStats();
	const drafter = getProvider('drafter', env);
	const auditor = getProvider('auditor', env);
	const chat = getProvider('chat', env);
	const embedder = (env.EMBEDDER || 'none').toLowerCase();
	const intervalHours = Number(env.BACKUP_INTERVAL_HOURS ?? 24);

	const backups = listBackups();
	const lastBackup = backups[0];
	const ageHours = lastBackup ? (Date.now() - lastBackup.createdAt.getTime()) / 3_600_000 : null;

	const counts = {
		sources: n('SELECT COUNT(*) AS c FROM sources'),
		arguments: n('SELECT COUNT(*) AS c FROM arguments'),
		approvedTexts:
			n("SELECT COUNT(*) AS c FROM source_texts WHERE review = 'human_approved'") +
			n("SELECT COUNT(*) AS c FROM argument_texts WHERE review = 'human_approved'"),
		users: n('SELECT COUNT(*) AS c FROM users'),
		drafts: n('SELECT COUNT(*) AS c FROM content_drafts')
	};

	const warnings: Warning[] = [];
	const warn = (id: WarningId, severity: Warning['severity'] = 'warn') => warnings.push({ id, severity });

	if (env.NODE_ENV === 'production' && !env.ORIGIN && !env.PROTOCOL_HEADER) warn('origin_missing', 'error');
	if (authDisabled()) warn('auth_disabled', 'error');
	if (env.ADMIN_PASSWORD && counts.users > 0) warn('admin_password_in_env');
	if (intervalHours > 0) {
		if (!lastBackup) warn('no_backup', 'error');
		else if (ageHours! > Math.max(intervalHours * 2, 48)) warn('backup_stale', 'error');
	} else warn('no_backup', 'error');
	if (lastBackup && backupDir() && env.BACKUP_DIR === undefined) warn('backup_same_disk', 'info');
	if (drafter && auditor && drafter.family === auditor.family) warn('models_same_family');
	if (!chat) warn('chat_missing', 'info');
	if (!drafter || !auditor) warn('pipeline_missing', 'info');
	if (embedder === 'none') warn('embedder_off');
	if (sampling.alert) warn('sampling_alert', 'error');
	if (queue.stale > 0) warn('stale_cards');
	if (counts.approvedTexts === 0) warn('nothing_approved');

	const recent = (
		db
			.prepare('SELECT at, actor, owner_type, owner_id, locale, from_review, to_review FROM review_events WHERE from_review != to_review ORDER BY id DESC LIMIT 10')
			.all() as { at: string; actor: string; owner_type: string; owner_id: number; locale: string; from_review: string; to_review: string }[]
	).map((r) => ({ at: r.at, actor: r.actor, ownerType: r.owner_type, ownerId: r.owner_id, locale: r.locale, from: r.from_review, to: r.to_review }));

	const topUsed = (
		db
			.prepare(
				`SELECT cu.owner_type AS ownerType, cu.owner_id AS ownerId, cu.uses,
					CASE cu.owner_type
						WHEN 'source' THEN (SELECT work || ' ' || section_ref FROM sources WHERE id = cu.owner_id)
						ELSE (SELECT opponent_claim FROM argument_texts WHERE argument_id = cu.owner_id ORDER BY locale LIMIT 1)
					END AS title
				 FROM card_usage cu ORDER BY cu.uses DESC LIMIT 5`
			)
			.all() as { ownerType: string; ownerId: number; uses: number; title: string | null }[]
	).map((r) => ({ ...r, title: r.title ?? `#${r.ownerId}` }));

	return {
		counts,
		queue,
		sampling,
		pipeline: pipelineHealth(),
		coverage: getTranslationCoverage(),
		config: {
			auth: authDisabled() ? 'disabled' : 'enabled',
			chat: !!chat,
			drafter: !!drafter,
			auditor: !!auditor,
			embedder,
			ragVectorMin: Number(env.RAG_VECTOR_MIN ?? 0.79)
		},
		backup: {
			dir: backupDir(),
			count: backups.length,
			last: lastBackup ? { file: lastBackup.file, bytes: lastBackup.bytes, at: lastBackup.createdAt.toISOString() } : null,
			ageHours,
			intervalHours
		},
		recent,
		topUsed,
		warnings
	};
}
