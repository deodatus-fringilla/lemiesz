import { OpenAiCompatibleProvider } from './openai-compatible';
import type { LlmProvider } from './provider';

export type LlmRole = 'drafter' | 'auditor' | 'chat';

/** Builds the provider for a role from LLM_<ROLE>_* environment variables, or null when not configured. */
export function getProvider(role: LlmRole, env: Record<string, string | undefined> = process.env): LlmProvider | null {
	const key = role.toUpperCase();
	const baseUrl = env[`LLM_${key}_BASE_URL`];
	const apiKey = env[`LLM_${key}_API_KEY`];
	const model = env[`LLM_${key}_MODEL`];
	if (!baseUrl || !apiKey || !model) return null;
	return new OpenAiCompatibleProvider({ baseUrl, apiKey, model, family: env[`LLM_${key}_FAMILY`] });
}

export class NotIndependentError extends Error {}

/**
 * The auditor must not be the same model family as the drafter (plan §12.3 q): an AI marking its own
 * family's homework shares its blind spots. Override only knowingly with LLM_ALLOW_SAME_FAMILY=true.
 */
export function assertIndependent(
	drafter: LlmProvider,
	auditor: LlmProvider,
	env: Record<string, string | undefined> = process.env
): void {
	if (env.LLM_ALLOW_SAME_FAMILY === 'true') return;
	if (drafter.family === auditor.family) {
		throw new NotIndependentError(
			`Drafter and auditor are both model family "${drafter.family}". Configure a different family for the auditor (LLM_AUDITOR_*).`
		);
	}
}
