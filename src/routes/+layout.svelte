<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Shield, LayoutDashboard, BookOpen, Swords, CheckSquare, LogOut, MessageSquareQuote, PenLine } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { locales, setLocale } from '$lib/paraglide/runtime.js';

	let { data, children } = $props();

	const nav = $derived([
		{ href: '/', label: m.nav_dashboard(), icon: LayoutDashboard },
		{ href: '/shield', label: m.nav_shield(), icon: MessageSquareQuote },
		{ href: '/content', label: m.nav_content(), icon: PenLine },
		{ href: '/repository', label: m.nav_repository(), icon: BookOpen },
		{ href: '/arguments', label: m.nav_arguments(), icon: Swords },
		{ href: '/review', label: m.nav_review(), icon: CheckSquare }
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_title()}</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-zinc-950 font-sans text-zinc-100">
	{#if data.user}
		<header class="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
			<div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
				<a href="/" class="flex items-center gap-2.5">
					<span class="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
						<Shield class="h-5 w-5" />
					</span>
					<span class="leading-tight">
						<span class="block text-base font-bold">Pakt Lemiesza</span>
						<span class="block text-[11px] text-zinc-400">{m.app_subtitle()}</span>
					</span>
				</a>

				<nav class="hidden items-center gap-1 text-sm font-medium md:flex">
					{#each nav as item (item.href)}
						<a
							href={item.href}
							class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors {isActive(item.href)
								? 'border border-zinc-800 bg-zinc-900 text-amber-400'
								: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>

				<div class="flex items-center gap-3 text-xs">
					<div class="flex overflow-hidden rounded-lg border border-zinc-800" role="group" aria-label={m.language()}>
						{#each locales as code (code)}
							<button
								type="button"
								onclick={() => setLocale(code)}
								class="px-2.5 py-1 font-semibold uppercase {data.locale === code
									? 'bg-amber-500 text-zinc-950'
									: 'text-zinc-400 hover:text-zinc-100'}"
							>
								{code}
							</button>
						{/each}
					</div>
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-zinc-400 hover:text-zinc-100"
						>
							<LogOut class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">{m.logout({ user: data.user.username })}</span>
						</button>
					</form>
				</div>
			</div>
			<nav class="flex gap-1 overflow-x-auto border-t border-zinc-900 px-4 py-2 text-sm md:hidden">
				{#each nav as item (item.href)}
					<a href={item.href} class="whitespace-nowrap rounded-lg px-3 py-1 {isActive(item.href) ? 'bg-zinc-900 text-amber-400' : 'text-zinc-400'}">
						{item.label}
					</a>
				{/each}
			</nav>
		</header>
	{/if}

	<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
		{@render children()}
	</main>

	<footer class="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">{m.footer()}</footer>
</div>
