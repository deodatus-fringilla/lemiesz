<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';

	let { data, form } = $props();

	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const ok = $derived(form && 'ok' in form && form.ok ? (form.action as string) : null);
	const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';
	const btn = 'rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400';
</script>

<div class="space-y-8">
	<div class="border-b border-zinc-800 pb-6">
		<h1 class="text-3xl font-bold tracking-tight">{m.settings_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.settings_signed_in({ user: data.me?.username ?? '', role: data.me?.role ?? '' })}</p>
	</div>

	{#if errors.length}
		<ul role="alert" class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
			{#each errors as e (e)}<li>{e === 'mismatch' ? m.settings_mismatch() : e}</li>{/each}
		</ul>
	{/if}
	{#if ok}<p role="status" class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{m.settings_saved()}</p>{/if}

	<section class="max-w-md space-y-3">
		<h2 class="text-lg font-semibold">{m.settings_change_password()}</h2>
		<p class="text-xs text-zinc-500">{m.settings_password_rules()}</p>
		<form method="POST" action="?/changePassword" use:enhance class="space-y-3">
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.settings_current()}</span><input name="current" type="password" autocomplete="current-password" required class={input} /></label>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.settings_new()}</span><input name="next" type="password" autocomplete="new-password" minlength="12" required class={input} /></label>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.settings_confirm()}</span><input name="confirm" type="password" autocomplete="new-password" minlength="12" required class={input} /></label>
			<button class={btn}>{m.repo_save()}</button>
		</form>
	</section>

	{#if data.me?.role === 'admin'}
		<section class="space-y-4">
			<h2 class="text-lg font-semibold">{m.settings_users()}</h2>
			<div class="overflow-x-auto rounded-xl border border-zinc-800">
				<table class="w-full text-left text-sm">
					<thead class="bg-zinc-900/60 text-xs uppercase text-zinc-500"><tr><th class="px-3 py-2">{m.settings_username()}</th><th class="px-3 py-2">{m.settings_role()}</th><th class="px-3 py-2">{m.settings_created()}</th><th class="px-3 py-2"></th></tr></thead>
					<tbody>
						{#each data.users as u (u.id)}
							<tr class="border-t border-zinc-800">
								<td class="px-3 py-2 font-medium">{u.username}</td>
								<td class="px-3 py-2">{u.role === 'admin' ? m.settings_role_admin() : m.settings_role_member()}</td>
								<td class="px-3 py-2 text-zinc-500">{u.created_at}</td>
								<td class="px-3 py-2">
									<div class="flex flex-wrap items-center justify-end gap-2">
										<form method="POST" action="?/resetPassword" use:enhance class="flex items-center gap-2">
											<input type="hidden" name="userId" value={u.id} />
											<input name="password" type="password" minlength="12" placeholder={m.settings_new_password_for()} autocomplete="new-password" required class="w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" />
											<button class="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">{m.settings_reset()}</button>
										</form>
										{#if u.id !== data.me?.id}
											<form method="POST" action="?/deleteUser" use:enhance={({ cancel }) => { if (!confirm(m.settings_delete_confirm({ user: u.username }))) cancel(); }}>
												<input type="hidden" name="userId" value={u.id} />
												<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form method="POST" action="?/createUser" use:enhance={() => async ({ update }) => { await update(); }} class="grid max-w-2xl gap-3 sm:grid-cols-4">
				<h3 class="text-sm font-semibold text-zinc-300 sm:col-span-4">{m.settings_add_user()}</h3>
				<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.settings_username()}</span><input name="username" required minlength="3" autocomplete="off" class={input} /></label>
				<label class="block text-sm sm:col-span-2"><span class="mb-1 block text-zinc-300">{m.login_password()}</span><input name="password" type="password" minlength="12" required autocomplete="new-password" class={input} /></label>
				<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.settings_role()}</span>
					<select name="role" class={input}><option value="member">{m.settings_role_member()}</option><option value="admin">{m.settings_role_admin()}</option></select></label>
				<div class="sm:col-span-4"><button class={btn}>{m.settings_add_user()}</button></div>
			</form>
		</section>
	{/if}
</div>
