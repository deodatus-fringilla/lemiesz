<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	let { form } = $props();
</script>

<div class="mx-auto mt-16 max-w-sm space-y-6">
	<div>
		<h1 class="text-2xl font-bold">{m.login_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.login_intro()}</p>
	</div>

	<form method="POST" class="space-y-4">
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.login_username()}</span>
			<input
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				required
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
			/>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.login_password()}</span>
			<input
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
			/>
		</label>
		{#if form?.failed}
			<p role="alert" class="text-sm text-rose-400">{m.login_error()}</p>
		{/if}
		<button class="w-full rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400">
			{m.login_submit()}
		</button>
	</form>
</div>
