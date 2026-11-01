import { m } from '$lib/paraglide/messages.js';
import type { ColorTag, MeetingCategory } from '$lib/server/spichlerz';

export const COLOR_TAGS: ColorTag[] = ['zinc', 'amber', 'purple', 'blue', 'emerald', 'rose'];

export const CATEGORY_LIST: MeetingCategory[] = [
	'epistolary',
	'strategy',
	'doctrine',
	'campaign',
	'operational',
	'general'
];

export function getCategoryLabel(cat: MeetingCategory): string {
	const map: Record<MeetingCategory, () => string> = {
		epistolary: m.meetings_filter_epistolary,
		strategy: m.meetings_filter_strategy,
		doctrine: m.meetings_filter_doctrine,
		campaign: m.meetings_filter_campaign,
		operational: m.meetings_filter_operational,
		general: m.meetings_filter_general
	};
	return map[cat]?.() ?? cat;
}

export const CATEGORY_BADGE_STYLES: Record<MeetingCategory, string> = {
	epistolary: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
	strategy: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
	doctrine: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
	campaign: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
	operational: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
	general: 'border-zinc-600/30 bg-zinc-600/10 text-zinc-300'
};

export const COLOR_BORDER_STYLES: Record<ColorTag, string> = {
	zinc: 'border-l-zinc-600',
	amber: 'border-l-amber-400',
	purple: 'border-l-purple-400',
	blue: 'border-l-blue-400',
	emerald: 'border-l-emerald-400',
	rose: 'border-l-rose-400'
};

export const COLOR_DOT_STYLES: Record<ColorTag, string> = {
	zinc: 'bg-zinc-500',
	amber: 'bg-amber-400',
	purple: 'bg-purple-400',
	blue: 'bg-blue-400',
	emerald: 'bg-emerald-400',
	rose: 'bg-rose-400'
};
