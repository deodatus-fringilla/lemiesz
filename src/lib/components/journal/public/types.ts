/** What the public Biblioteka sends to the browser: public fields only (no internal notes, reviewers or authorship). */
export interface LibraryEntry {
	id: number;
	title: string;
	artist_or_author: string;
	media_type: string;
	url: string;
	archive_url: string | null;
	public_note: string;
	language: string | null;
	/** The last link check failed: readers get a gentle warning (and the archived copy, if any). */
	broken: boolean;
}
