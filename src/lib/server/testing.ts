import { db } from './db';
import { createSource, type CreateSourceInput } from './sources';
import { createArgument, type CreateArgumentInput } from './arguments';
import { human, type Review } from './review';

/**
 * Test helpers: build small corpora without the seed. `review` is written straight to the table, which
 * deliberately bypasses the state machine so tests can start from any state.
 */
const alice = human('alice');

function force(type: 'source' | 'argument', id: number, locale: string, review: Review) {
	const table = type === 'source' ? 'source_texts' : 'argument_texts';
	const col = type === 'source' ? 'source_id' : 'argument_id';
	db.prepare(`UPDATE ${table} SET review = ? WHERE ${col} = ? AND locale = ?`).run(review, id, locale);
}

export function makeSource(over: Partial<CreateSourceInput> = {}, review: Review = 'human_approved'): number {
	const id = createSource(
		{
			work: 'Test Work',
			section_ref: '§1',
			category: 'magisterium',
			license: 'test licence terms',
			cleared_to_store: true,
			original_locale: 'en',
			locale: 'en',
			origin: 'original',
			text: 'The territory of neutral Powers is inviolable and belligerents may not cross it.',
			...over
		},
		alice
	);
	force('source', id, over.locale ?? 'en', review);
	return id;
}

export function makeArgument(
	over: Partial<CreateArgumentInput> & { source_ids: number[] },
	review: Review = 'human_approved'
): number {
	const id = createArgument(
		{
			locale: 'en',
			opponent_claim: 'You are isolationists who abandon your allies',
			counter_punch: 'Neutrality is not isolation: the inviolability of neutral territory is settled international law.',
			core_principle: 'active neutrality',
			fallacy_type: 'false dichotomy',
			...over
		},
		alice
	);
	force('argument', id, over.locale ?? 'en', review);
	return id;
}

export { force as forceReview };
