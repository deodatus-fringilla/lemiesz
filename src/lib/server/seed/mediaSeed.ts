import { db } from '$lib/server/db';
import { createMedia, parseMediaUrl, type MediaInput } from '$lib/server/media';
import { system } from '$lib/server/review';

/**
 * Starter media (replaces the scratch file docs/temp_links.txt). Every row is created as a `draft`: a human must
 * watch/listen, check the credits and approve it in /media before the Content Engine can mention it.
 *
 * What was verified on 2026-10-01 (YouTube oEmbed / watch page) and what was not:
 *  - URYM2FITucQ resolves to the title "Iluzja Wolności", channel "Attemis - Topic". The AI-assistance credit and the
 *    release details come from the owner and are NOT independently verified.
 *  - mvCZ5zhCt5Q resolves to "Rota | Epicki Polski Hymn | Power Metal Polish Patriotic Oath": a power-metal
 *    arrangement, not a traditional folk performance. The uploader could not be read, and oEmbed answered 401 (the
 *    uploader may have disabled embedding): the player may not work, and the link must be opened on YouTube.
 *  - No lyrics are stored for either: no licence decision has been made (the DB refuses lyrics without one).
 */
export const SEED_MEDIA: MediaInput[] = [
	{
		title: 'Iluzja Wolności',
		artist_or_author: 'Attemis',
		media_type: 'music',
		genre: 'modern_synth',
		mood: 'defiant',
		target_audience: 'youth_digital',
		url: 'https://www.youtube.com/watch?v=URYM2FITucQ',
		language: 'pl',
		ai_assisted: true,
		production_credits: 'AI-assisted (Suno AI), distributed via DistroKid. Credit text supplied by the owner; not independently verified.',
		notes: 'Verified 2026-10-01: title and channel ("Attemis - Topic") match. Review the credits and the lyrics licence before approving.'
	},
	{
		title: 'Rota (Power Metal arrangement)',
		artist_or_author: 'Uploader not verified',
		media_type: 'music',
		genre: 'rock_metal',
		mood: 'defiant',
		target_audience: 'general_public',
		url: 'https://www.youtube.com/watch?v=mvCZ5zhCt5Q',
		language: 'pl',
		notes:
			'Verified 2026-10-01: the video is "Rota | Epicki Polski Hymn | Power Metal Polish Patriotic Oath". Name the real artist before approving. oEmbed returned 401, so embedding may be disabled: open it on YouTube. Rota is a patriotic oath by Maria Konopnicka; the arrangement and any AI involvement need checking.'
	}
];

export function seedMedia(): number {
	if (process.env.SEED_ON_EMPTY === 'false') return 0;
	let added = 0;
	for (const item of SEED_MEDIA) {
		const parsed = parseMediaUrl(item.url)!;
		if (db.prepare('SELECT 1 FROM media_assets WHERE platform = ? AND external_id = ?').get(parsed.platform, parsed.external_id)) continue;
		createMedia(item, system('seed'));
		added++;
	}
	if (added) console.log(`[seed] Added ${added} draft media assets.`);
	return added;
}
