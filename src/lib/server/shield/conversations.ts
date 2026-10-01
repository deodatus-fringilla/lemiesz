import crypto from 'node:crypto';
import { db } from '$lib/server/db';

export interface StoredMessage {
	id: number;
	role: 'user' | 'assistant' | 'system';
	content: string;
	locale: string;
	sources_json: string | null;
	created_at: string;
}

export interface ConversationSummary {
	id: string;
	title: string | null;
	updated_at: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Returns the conversation if it exists AND belongs to this user; otherwise null (no cross-user reads). */
export function getOwnedConversation(id: string, userId: string): ConversationSummary | null {
	return (
		(db
			.prepare('SELECT id, title, updated_at FROM conversations WHERE id = ? AND user_id = ?')
			.get(id, userId) as ConversationSummary | undefined) ?? null
	);
}

export function createConversation(userId: string, locale: string, firstMessage: string): string {
	const id = crypto.randomUUID();
	db.prepare('INSERT INTO conversations (id, title, locale, user_id) VALUES (?, ?, ?, ?)').run(
		id,
		clip(firstMessage.trim().replace(/\s+/g, ' '), 80),
		locale,
		userId
	);
	return id;
}

export function appendMessage(
	conversationId: string,
	role: 'user' | 'assistant',
	content: string,
	locale: string,
	sourcesJson?: unknown
): number {
	return db.transaction(() => {
		const res = db
			.prepare('INSERT INTO messages (conversation_id, role, content, locale, sources_json) VALUES (?, ?, ?, ?, ?)')
			.run(conversationId, role, content, locale, sourcesJson === undefined ? null : JSON.stringify(sourcesJson));
		db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
		return Number(res.lastInsertRowid);
	})();
}

export function listMessages(conversationId: string): StoredMessage[] {
	return db
		.prepare('SELECT id, role, content, locale, sources_json, created_at FROM messages WHERE conversation_id = ? ORDER BY id')
		.all(conversationId) as StoredMessage[];
}

export function listConversations(userId: string, limit = 15): ConversationSummary[] {
	return db
		.prepare('SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT ?')
		.all(userId, limit) as ConversationSummary[];
}
