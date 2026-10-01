import fs from 'node:fs';

/**
 * The movement's tenets as given to the Auditor for the "doctrinal alignment" criterion.
 *
 * IMPORTANT: this is a working summary of the three tenets named in the plan, NOT the movement's
 * official wording. The movement should replace it with its own text by pointing DOCTRINE_FILE at a
 * plain-text file. Until then the criterion is only as good as this summary, which is one more reason
 * `ai_verified` never reaches public output without a human (plan §7.4).
 */
export const DEFAULT_DOCTRINE = `Active Neutrality: the state stays out of great-power alliances and wars, but is not passive: it trades, negotiates and pursues diplomacy with all sides, and keeps a credible territorial defence.
Double Distance: equal strategic distance from rival blocs; Poland is neither an outpost of one bloc nor a satellite of another.
Subsidiarity: decisions and responsibilities belong at the lowest competent level; higher authority helps, it does not replace.
Grounding: positions are argued from the canonical sources (Catholic social teaching, international law, the movement's own texts), never invented or attributed beyond what those sources say.`;

export function loadDoctrine(env: Record<string, string | undefined> = process.env): string {
	const file = env.DOCTRINE_FILE;
	if (file) {
		try {
			const text = fs.readFileSync(file, 'utf8').trim();
			if (text) return text;
		} catch (e) {
			console.error(`[pipeline] Could not read DOCTRINE_FILE "${file}":`, (e as Error).message);
		}
	}
	return DEFAULT_DOCTRINE;
}
