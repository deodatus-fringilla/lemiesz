/**
 * 1 Samuel 8:4–18, Contemporary English Version (CEV), quoted verbatim for the public landing page.
 *
 * D5 (Truth in Citations): these strings are scripture. Do not paraphrase, "tidy up" or machine-translate
 * them. A Polish rendering must come from a published translation, pasted verbatim and attributed.
 * The translator's footnote marker "[a]" after verse 11 is intentionally omitted.
 */

export const SAMUEL8_REF = '1 Samuel 8:4–18';
export const SAMUEL8_TRANSLATION = 'Contemporary English Version (CEV)';

export type Verse = { n: number; text: string };

/** vv. 4–5: the elders' request. */
export const request: Verse[] = [
	{ n: 4, text: "One day the nation's leaders came to Samuel at Ramah" },
	{
		n: 5,
		text: 'and said, “You are an old man. You set a good example for your sons, but they haven\'t followed it. Now we want a king to be our leader, just like all the other nations. Choose one for us!”'
	}
];

/** v. 6 + the narrative lead-in of v. 7. */
export const samuelPrays: Verse[] = [
	{ n: 6, text: 'Samuel was upset to hear the leaders say they wanted a king, so he prayed about it.' },
	{ n: 7, text: 'The Lord answered:' }
];

/** vv. 7–9: the Lord's answer. */
export const lordAnswers: Verse[] = [
	{ n: 7, text: 'Samuel, do everything they want you to do. I am really the one they have rejected as their king.' },
	{
		n: 8,
		text: 'Ever since the day I rescued my people from Egypt, they have turned from me to worship idols. Now they are turning away from you.'
	},
	{ n: 9, text: 'Do everything they ask, but warn them and tell them how a king will treat them.' }
];

/** v. 10. */
export const samuelTells: Verse = {
	n: 10,
	text: 'Samuel told the people who were asking for a king what the Lord had said:'
};

export type ConsequenceKey = 'army' | 'labour' | 'daughters' | 'land' | 'tithe_harvest' | 'servants' | 'slavery' | 'silence';

export type Consequence = {
	key: ConsequenceKey;
	ref: string;
	verses: Verse[];
	/** The two culminating consequences are visually emphasised. */
	climax?: boolean;
};

/** vv. 11–18, split into the distinct costs of the crown. Verse text is verbatim; only the grouping is ours. */
export const consequences: Consequence[] = [
	{
		key: 'army',
		ref: '8:11–12',
		verses: [
			{
				n: 11,
				text: 'If you have a king, this is how he will treat you. He will force your sons to join his army. Some of them will ride in his chariots, some will serve in the cavalry, and others will run ahead of his own chariot.'
			},
			{ n: 12, text: 'Some of them will be officers in charge of 1,000 soldiers, and others will be in charge of 50.' }
		]
	},
	{
		key: 'labour',
		ref: '8:12',
		verses: [
			{
				n: 12,
				text: "Still others will have to farm the king's land and harvest his crops, or make weapons and parts for his chariots."
			}
		]
	},
	{
		key: 'daughters',
		ref: '8:13',
		verses: [{ n: 13, text: 'Your daughters will have to make perfume or do his cooking and baking.' }]
	},
	{
		key: 'land',
		ref: '8:14',
		verses: [
			{
				n: 14,
				text: 'The king will take your best fields, as well as your vineyards, and olive orchards and give them to his own officials.'
			}
		]
	},
	{
		key: 'tithe_harvest',
		ref: '8:15',
		verses: [{ n: 15, text: 'He will also take a tenth of your grain and grapes and give it to his officers and officials.' }]
	},
	{
		key: 'servants',
		ref: '8:16–17',
		verses: [
			{ n: 16, text: 'The king will take your slaves and your best young men and your donkeys and make them do his work.' },
			{ n: 17, text: 'He will also take a tenth of your sheep and goats.' }
		]
	},
	{
		key: 'slavery',
		ref: '8:17',
		verses: [{ n: 17, text: "You will become the king's slaves," }],
		climax: true
	},
	{
		key: 'silence',
		ref: '8:18',
		verses: [
			{
				n: 18,
				text: "and you will finally cry out for the Lord to save you from the king you wanted. But the Lord won't answer your prayers."
			}
		],
		climax: true
	}
];
