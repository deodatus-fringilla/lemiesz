<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import Shield from 'lucide-svelte/icons/shield';
	import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Swords from 'lucide-svelte/icons/swords';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import LogOut from 'lucide-svelte/icons/log-out';
	import LogIn from 'lucide-svelte/icons/log-in';
	import MessageSquareQuote from 'lucide-svelte/icons/message-square-quote';
	import PenLine from 'lucide-svelte/icons/pen-line';
	import Archive from 'lucide-svelte/icons/archive';
	import Flame from 'lucide-svelte/icons/flame';
	import Music from 'lucide-svelte/icons/music';
	import Settings from 'lucide-svelte/icons/settings';
	import Menu from 'lucide-svelte/icons/menu';
	import PanelRightClose from 'lucide-svelte/icons/panel-right-close';
	import PanelRightOpen from 'lucide-svelte/icons/panel-right-open';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';
	import { locales, setLocale } from '$lib/paraglide/runtime.js';

	let { data, children } = $props();

	let headerHeight = $state(105);

	/** Mobile-first: the menu is a closed drawer on phones/tablets; from `xl` it is a persistent panel. */
	let menuOpen = $state(false);

	/** Desktop (xl+): the persistent panel can be hidden to give content the full width. Remembered per browser. */
	const PANEL_KEY = 'nav-panel-hidden';
	/** Spichlerz is a 3-column workspace: the panel starts hidden there (until the user shows it), shown elsewhere. */
	const isSpichlerz = $derived(page.url.pathname.startsWith('/spichlerz'));
	/** Spichlerz keeps its own remembered choice so it never overrides the preference for other pages. */
	const panelKey = $derived(isSpichlerz ? `${PANEL_KEY}:spichlerz` : PANEL_KEY);
	// Start from the page default during SSR, so /spichlerz never flashes the panel before hydration.
	let panelHidden = $state(page.url.pathname.startsWith('/spichlerz'));

	$effect(() => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(panelKey);
		} catch {
			// Storage can be blocked (private mode, disabled site data); fall back to the page default.
		}
		panelHidden = stored === null ? isSpichlerz : stored === '1';
	});

	function togglePanel() {
		panelHidden = !panelHidden;
		try {
			localStorage.setItem(panelKey, panelHidden ? '1' : '0');
		} catch {
			// Not persisted; the toggle still works for this page view.
		}
	}

	const topicNav = $derived([
		{ href: '/neutralna-polska', label: m.nav_neutral_poland() },
		{ href: '/za-i-przeciw', label: m.nav_pros_and_cons() },
		{ href: '/polskie-mocarstwo', label: m.nav_polish_power() }
	]);

	const publicPages = ['/', '/neutralna-polska', '/za-i-przeciw', '/polskie-mocarstwo'];
	const isPublicPage = $derived(publicPages.includes(page.url.pathname));

	const nav = $derived([
		{ href: '/dashboard', label: m.nav_dashboard(), icon: LayoutDashboard, badge: 0 },
		{ href: '/shield', label: m.nav_shield(), icon: MessageSquareQuote, badge: 0 },
		{ href: '/kuznia', label: m.nav_kuznia(), icon: Flame, badge: 0 },
		{ href: '/spichlerz', label: m.nav_spichlerz(), icon: Archive, badge: 0 },
		{ href: '/content', label: m.nav_content(), icon: PenLine, badge: 0 },
		{ href: '/media', label: m.nav_media(), icon: Music, badge: 0 },
		{ href: '/repository', label: m.nav_repository(), icon: BookOpen, badge: 0 },
		{ href: '/arguments', label: m.nav_arguments(), icon: Swords, badge: 0 },
		{ href: '/review', label: m.nav_review(), icon: CheckSquare, badge: data.queueCount ?? 0 }
	]);

	const isActive = (href: string) => page.url.pathname.startsWith(href);

	// Close the drawer after navigating.
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_title()}</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

<div
	style="--header-height: {headerHeight}px;"
	class="flex min-h-dvh flex-col overflow-x-clip bg-zinc-950 font-sans text-zinc-100"
>
	<header
		bind:clientHeight={headerHeight}
		class="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur"
	>
		<!-- Base (phone): brand + controls. Topic labels sit on their own scrollable row below. -->
		<div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
			<div class="flex min-w-0 items-center gap-4 lg:gap-8">
				<a
					href="/"
					class="group flex min-w-0 shrink-0 cursor-pointer items-center gap-2.5"
					title="Powrót do strony głównej"
				>
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-colors group-hover:border-amber-500/50 group-hover:bg-amber-500/20">
						<Shield class="h-5 w-5" />
					</span>
					<span class="min-w-0 leading-tight">
						<span class="block truncate text-sm font-bold text-zinc-100 sm:text-base">Przymierze Lemiesza</span>
						<span class="hidden truncate text-[11px] text-zinc-400 sm:block">{m.app_subtitle()}</span>
					</span>
				</a>

				<!-- Labels to the right of the brand from md up -->
				<nav class="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Tematy">
					{#each topicNav as item (item.href)}
						{@const active = page.url.pathname === item.href}
						<a
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class="rounded-lg border px-3 py-1.5 whitespace-nowrap transition-colors {active
								? 'border-amber-500/40 bg-amber-500/15 font-semibold text-amber-300'
								: 'border-transparent text-zinc-300 hover:bg-zinc-900 hover:text-amber-400'}"
						>
							{item.label}
						</a>
					{/each}
				</nav>
			</div>

			<div class="flex shrink-0 items-center gap-2 text-xs">
				<div class="flex overflow-hidden rounded-lg border border-zinc-800" role="group" aria-label={m.language()}>
					{#each locales as code (code)}
						<button
							type="button"
							onclick={() => setLocale(code)}
							class="min-h-9 px-2.5 font-semibold uppercase transition-colors {data.locale === code
								? 'bg-amber-500 text-zinc-950'
								: 'text-zinc-400 hover:text-zinc-100'}"
						>
							{code}
						</button>
					{/each}
				</div>

				<!-- Desktop toggle for the persistent panel (xl+) -->
				<button
					type="button"
					onclick={togglePanel}
					class="hidden min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 xl:flex"
					aria-label={panelHidden ? m.nav_panel_show() : m.nav_panel_hide()}
					title={panelHidden ? m.nav_panel_show() : m.nav_panel_hide()}
					aria-expanded={!panelHidden}
					aria-controls="side-menu"
				>
					{#if panelHidden}<PanelRightOpen class="h-4 w-4" />{:else}<PanelRightClose class="h-4 w-4" />{/if}
				</button>

				<!-- Drawer toggle: hidden once the panel is persistent (xl) -->
				<button
					type="button"
					onclick={() => (menuOpen = !menuOpen)}
					class="flex min-h-9 min-w-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 xl:hidden"
					aria-label="Menu"
					aria-expanded={menuOpen}
					aria-controls="side-menu"
				>
					{#if menuOpen}<X class="h-4 w-4" />{:else}<Menu class="h-4 w-4" />{/if}
					<span class="hidden sm:inline">Menu</span>
				</button>
			</div>
		</div>

		<!-- Phone-only topic row (scrolls horizontally if needed) -->
		<nav class="flex gap-1.5 overflow-x-auto border-t border-zinc-900 px-3 py-1.5 md:hidden" aria-label="Tematy">
			{#each topicNav as item (item.href)}
				{@const active = page.url.pathname === item.href}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class="min-h-9 shrink-0 flex items-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors {active
						? 'border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold'
						: 'border-zinc-800 text-zinc-300 active:bg-zinc-900'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<!-- Backdrop for the drawer (phones/tablets only) -->
	{#if menuOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs xl:hidden"
			onclick={() => (menuOpen = false)}
			aria-label="Zamknij menu"
			tabindex="-1"
		></button>
	{/if}

	<!--
		Base: off-canvas drawer sliding from the right.
		xl+: persistent floating panel at the top-right (location from the design).
	-->
	<aside
		id="side-menu"
		class="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-3 overflow-y-auto bg-zinc-950 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 {menuOpen
			? 'visible translate-x-0'
			: 'invisible translate-x-full'} {panelHidden ? 'xl:hidden' : 'xl:visible'} xl:inset-y-auto xl:top-20 xl:right-6 xl:w-64 xl:translate-x-0 xl:overflow-visible xl:bg-transparent xl:p-0 xl:shadow-none"
		aria-label="Szybka nawigacja"
	>
		<div class="flex items-center justify-between px-1 xl:hidden">
			<span class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Menu</span>
			<button
				type="button"
				onclick={() => (menuOpen = false)}
				class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 text-zinc-300"
				aria-label="Zamknij menu"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Card 1: navigation (highly transparent glass) -->
		<div class="rounded-2xl border border-white/20 bg-black/20 p-2 shadow-xl backdrop-blur-xs">
			<nav class="flex flex-col gap-1">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="flex min-h-11 items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all {isActive(item.href)
							? 'border-amber-500/40 bg-amber-500/20 text-amber-300 font-semibold'
							: 'border-transparent text-zinc-200 hover:border-white/20 hover:bg-white/10 hover:text-white'}"
					>
						<span class="flex items-center gap-2.5 truncate">
							<item.icon class="h-4 w-4 shrink-0 {isActive(item.href) ? 'text-amber-400' : 'text-zinc-400'}" />
							<span class="truncate">{item.label}</span>
						</span>
						{#if item.badge > 0}
							<span class="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">{item.badge}</span>
						{/if}
					</a>
				{/each}
			</nav>
		</div>

		<!-- Card 2: session (highly transparent glass) -->
		<div class="rounded-2xl border border-white/20 bg-black/20 p-3 shadow-xl backdrop-blur-xs">
			{#if data.user}
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2 px-1 text-xs">
						<div class="flex min-w-0 items-center gap-2">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-400">
								{data.user.username.charAt(0).toUpperCase()}
							</span>
							<span class="truncate font-medium text-zinc-100">{data.user.username}</span>
						</div>
						<span class="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 uppercase">{data.user.role}</span>
					</div>
					<div class="flex flex-col gap-1.5 border-t border-white/15 pt-2">
						<a
							href="/settings"
							class="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
						>
							<Settings class="h-3.5 w-3.5" />
							<span>{m.nav_settings()}</span>
						</a>
						<form method="POST" action="/logout">
							<button
								type="submit"
								class="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
							>
								<LogOut class="h-3.5 w-3.5" />
								<span>{m.logout({ user: data.user.username })}</span>
							</button>
						</form>
					</div>
				</div>
			{:else}
				<a
					href="/login"
					class="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
				>
					<LogIn class="h-4 w-4" />
					<span>{m.login_submit()}</span>
				</a>
			{/if}
		</div>
	</aside>

	{#if isPublicPage}
		<main class="flex-1">
			{@render children()}
		</main>
	{:else}
		<main class="mx-auto w-full min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-8 {panelHidden ? '' : 'xl:pr-72'} {isSpichlerz && panelHidden ? 'max-w-[1800px]' : 'max-w-7xl'}">
			{@render children()}
		</main>
	{/if}

	<footer class="border-t border-zinc-900 px-3 py-6 text-center text-xs text-zinc-600">{m.footer()}</footer>
</div>
