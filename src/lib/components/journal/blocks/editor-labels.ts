import { m } from '$lib/paraglide/messages.js';
import type { Labels } from '$lib/editor';
import type { CitableSource } from '$lib/server/journal-citations';

/**
 * Every text of the article editor, from Paraglide (the editor itself ships English and Polish defaults, but the
 * platform keeps all its words in messages/*.json). A new label in the editor makes this fail to compile until the
 * message exists: add it to messages/pl.json and en.json.
 */
export function editorLabels(sources: CitableSource[]): Labels {
	/** A citation chip reads like the source it points to ("Work — section"), not like a number. */
	const citationLabel: Labels['citationLabel'] = (kind, id) => {
		const s = sources.find((x) => x.id === id);
		const name = s ? `${s.work} — ${s.section_ref}` : m.ed_source_unknown({ id });
		return kind === 'quote' ? `„${name}”` : name;
	};
	return {
		editor: m.ed_editor(),
		toolbar: m.ed_toolbar(),
		undo: m.ed_undo(),
		redo: m.ed_redo(),
		bold: m.ed_bold(),
		italic: m.ed_italic(),
		link: m.ed_link(),
		paragraph: m.ed_paragraph(),
		heading2: m.ed_heading_2(),
		heading3: m.ed_heading_3(),
		heading4: m.ed_heading_4(),
		bulletList: m.ed_bullet_list(),
		numberedList: m.ed_numbered_list(),
		quote: m.ed_quote(),
		separator: m.ed_separator(),
		rawTable: m.ed_raw_table(),
		rawCode: m.ed_raw_code(),
		rawImage: m.ed_raw_image(),
		rawHelp: m.ed_raw_help(),
		image: m.ed_image(),
		citation: m.ed_citation(),
		source: m.ed_source(),
		quoteCitation: m.ed_quote_citation(),
		linkTitle: m.ed_link_title(),
		linkAddress: m.ed_link_address(),
		linkInvalid: m.ed_link_invalid(),
		apply: m.ed_apply(),
		removeLink: m.ed_remove_link(),
		cancel: m.ed_cancel(),
		imageTitle: m.ed_image_title(),
		imageAlt: m.ed_image_alt(),
		imageAltHelp: m.ed_image_alt_help(),
		imageAltFromHost: m.ed_image_alt_from_host(),
		imageAltMissing: m.ed_image_alt_missing(),
		imageCaption: m.ed_image_caption(),
		placement: m.ed_placement(),
		placeCenter: m.ed_place_center(),
		placeLeft: m.ed_place_left(),
		placeRight: m.ed_place_right(),
		placeFull: m.ed_place_full(),
		moveUp: m.ed_move_up(),
		moveDown: m.ed_move_down(),
		insert: m.ed_insert(),
		update: m.ed_update(),
		removeImage: m.ed_remove_image(),
		removeImageTitle: m.ed_remove_image_title(),
		removeFromArticle: m.ed_remove_from_article(),
		removeFromArticleHelp: m.ed_remove_from_article_help(),
		removeAndDelete: m.ed_remove_and_delete(),
		removeAndDeleteHelp: m.ed_remove_and_delete_help(),
		uploading: m.ed_uploading(),
		uploadFailed: m.ed_upload_failed(),
		deleteFailed: m.ed_delete_failed(),
		imageStillUsed: m.ed_image_still_used(),
		imageNotAllowed: m.ed_image_not_allowed(),
		backToText: m.ed_back_to_text(),
		citationLabel
	};
}
