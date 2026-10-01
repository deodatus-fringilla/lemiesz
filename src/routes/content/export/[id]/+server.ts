import { error, type RequestHandler } from '@sveltejs/kit';
import { draftToMarkdown, getDraft } from '$lib/server/content/drafts';

/** Markdown export of a draft (the text plus status and evidence). Publishing stays a human copy-paste. */
export const GET: RequestHandler = ({ params }) => {
	const draft = getDraft(Number(params.id));
	if (!draft) error(404, 'Draft not found');
	return new Response(draftToMarkdown(draft), {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'content-disposition': `attachment; filename="draft-${draft.id}-${draft.platform}-${draft.locale}.md"`
		}
	});
};
