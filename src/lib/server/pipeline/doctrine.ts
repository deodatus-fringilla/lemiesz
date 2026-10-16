import fs from 'node:fs';

/**
 * The movement's tenets as given to the Auditor for the "doctrinal alignment" criterion.
 *
 * IMPORTANT: this is a working summary of the three tenets named in the plan, NOT the movement's
 * official wording. The movement should replace it with its own text by pointing DOCTRINE_FILE at a
 * plain-text file. Until then the criterion is only as good as this summary, which is one more reason
 * `ai_verified` never reaches public output without a human (plan §7.4).
 */
export const DEFAULT_DOCTRINE = `Methodological Rule (Anti-Hegelian Disputation): Przymierze Lemiesza explicitly rejects Hegelian dialectics (thesis-antithesis-synthesis relativism) and conducts all polemics using five classical methodologies: (1) Thomistic Disputation (Dysputa Tomistyczna: state the opponent's strongest objection fairly, cite higher truth, resolve with logical distinction); (2) Chivalrous & Principled Polemics (Rycerska i Pryncypialna Polemika: charity toward the interlocutor, zero strawman caricatures, uncompromising principles); (3) Classical Apologetics & Refutation (Refutatio: exposing false dichotomies, pluralis majestatis usurpation, and wzór vs. kopia category errors); (4) Sovereign Disputation / The Royal Reckoning (Królewska Narada, Luke 14:31-32: sober demographic, economic, and game-theoretic calculation before conflict); (5) Fair-Minded Refutation (Uczciwa Kontrargumentacja: addressing the strongest form of an objection and testing internal consistency).
Active Neutrality & Double Distance (Oaza Pokoju Europy Środkowej & Doktryna Jeża): Poland stays out of great-power alliances and foreign wars as an assertive, inviolable trade and diplomatic bridge (wzór, not mechanical kopia), maintaining equal strategic distance from rival blocs (proven by Switzerland, Austria 1955, Malta Art. 1(3), Costa Rica Art. 12, and Hague Convention V). Deterrence rests on the Hedgehog Doctrine (Doktryna Jeża: asymmetric territorial defense, game-theoretic cost-benefit calculation where the cost of invasion far exceeds aggressor gains, territorial saturation with drones and civil defense).
Theological & Moral Realism (Chrystus kontra Wegecjusz): Rejecting the pagan maxim Si vis pacem, para bellum in favor of Luke 14:31-32, Isaiah 2:4 (swords into plowshares), Matthew 5:9, 1 Samuel 8, John 10:11-13 (Shepherd vs. Hireling), Pacem in Terris and Gaudium et Spes.
Economic Fertility of the Plowshare vs. Sterility of the Sword: Civilian production, family property, and agriculture generate wealth and sustain demography (Eisenhower, Bastiat), whereas Sanacja-style "Poland-Sparta" militarization and credit-bought foreign weapons without source codes drain a shrinking nation and end in Kuty-bridge elite flight.
Subsidiarity & Civic Subjectivity: Decisions belong at the lowest competent level; the state serves the survival and freedom of Polish families, rejecting governance by war psychosis or fear.
Grounding: Positions are argued strictly from canonical sources (Scripture, Catholic social teaching, international law, constitutional precedents, and the movement's texts), never invented or attributed beyond what those sources say.`;

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
