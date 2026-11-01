<script lang="ts">
	import type { DeliberationComment } from '$lib/server/kuznia';
	import MessageSquare from 'lucide-svelte/icons/message-square';
	import Send from 'lucide-svelte/icons/send';
	import User from 'lucide-svelte/icons/user';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		deliberationId: number;
		comments: DeliberationComment[];
		currentUsername: string;
	}

	let { deliberationId, comments, currentUsername }: Props = $props();
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-4">
	<div class="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
		<MessageSquare class="size-4 text-amber-500" />
		<h3 class="text-sm sm:text-base font-semibold text-zinc-100">
			{m.kuznia_debate_title()}
		</h3>
		<span class="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
			{comments.length}
		</span>
	</div>

	<!-- Comments thread -->
	<div class="space-y-3">
		{#if comments.length === 0}
			<p class="py-2 text-xs italic text-zinc-500">Brak komentarzy. Rozpocznij dyskusję w zespole.</p>
		{:else}
			{#each comments as c (c.id)}
				<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-1.5">
					<div class="flex items-center justify-between text-[11px] text-zinc-400">
						<div class="flex items-center gap-1.5 font-semibold text-zinc-300">
							<User class="size-3 text-amber-400" />
							<span>{c.author}</span>
						</div>
						<span class="text-zinc-500">{c.created_at}</span>
					</div>
					<div class="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
						{c.text}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Add comment form -->
	<form method="POST" action="?/addComment" class="space-y-2.5 pt-2 border-t border-zinc-800/60">
		<input type="hidden" name="id" value={deliberationId} />
		<input type="hidden" name="author" value={currentUsername} />

		<div class="flex flex-col sm:flex-row gap-2">
			<textarea
				name="text"
				rows="2"
				required
				placeholder={m.kuznia_comment_placeholder()}
				class="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
			></textarea>
			<button
				type="submit"
				class="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-amber-600 hover:text-zinc-950 cursor-pointer transition sm:self-end"
			>
				<Send class="size-3.5" />
				<span>{m.kuznia_comment_submit()}</span>
			</button>
		</div>
	</form>
</div>
