<script lang="ts">
	import type { PageData } from './$types';
	import KuzniaSelector from '$lib/components/kuznia/KuzniaSelector.svelte';
	import KuzniaMediaViewer from '$lib/components/kuznia/KuzniaMediaViewer.svelte';
	import HermeneuticTrio from '$lib/components/kuznia/HermeneuticTrio.svelte';
	import KuzniaDebate from '$lib/components/kuznia/KuzniaDebate.svelte';
	import KuzniaBridge from '$lib/components/kuznia/KuzniaBridge.svelte';
	import KuzniaNewModal from '$lib/components/kuznia/KuzniaNewModal.svelte';
	import Flame from 'lucide-svelte/icons/flame';
	import { m } from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	let activeFilter = $state<'all' | 'music' | 'art' | 'sources'>('all');
	let selectedIdOverride = $state<number | null>(null);
	let selectedId = $derived(selectedIdOverride ?? data.selectedId);
	let isEditingNotes = $state(false);
	let newModalOpen = $state(false);

	const activeDeliberation = $derived(
		data.deliberations.find((d) => d.id === selectedId) || data.deliberations[0] || null
	);

	function handleSelect(id: number) {
		selectedIdOverride = id;
		isEditingNotes = false;
	}
</script>

<svelte:head>
	<title>{m.kuznia_title()} · {m.app_title()}</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
	<!-- Page Header -->
	<div class="space-y-1">
		<div class="flex items-center gap-2">
			<div class="rounded-lg bg-amber-600/20 p-2 border border-amber-500/40 text-amber-400">
				<Flame class="size-5" />
			</div>
			<h1 class="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
				{m.kuznia_title()}
			</h1>
		</div>
		<p class="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
			{m.kuznia_intro()}
		</p>
	</div>

	<!-- Selector Toolbar / Strip -->
	<KuzniaSelector
		deliberations={data.deliberations}
		selectedId={activeDeliberation?.id ?? null}
		{activeFilter}
		onselect={handleSelect}
		onfilterchange={(f) => (activeFilter = f)}
		onnew={() => (newModalOpen = true)}
	/>

	{#if activeDeliberation}
		<!-- Action Bridge to Tarcza & Content Engine -->
		<KuzniaBridge deliberation={activeDeliberation} />

		<!-- Media / Scripture Viewer with Quote & Lyrics -->
		<KuzniaMediaViewer deliberation={activeDeliberation} />

		<!-- 3-Axis Hermeneutics: Faith, Reason, Sovereignty -->
		<HermeneuticTrio
			deliberationId={activeDeliberation.id}
			theologicalNotes={activeDeliberation.theological_notes}
			philosophicalNotes={activeDeliberation.philosophical_notes}
			politicalNotes={activeDeliberation.political_notes}
			isEditing={isEditingNotes}
			ontoggleedit={() => (isEditingNotes = !isEditingNotes)}
		/>

		<!-- Team Commentary & Deliberation Thread -->
		<KuzniaDebate
			deliberationId={activeDeliberation.id}
			comments={activeDeliberation.debate_comments}
			currentUsername={data.user?.username || data.user?.id || 'admin'}
		/>
	{/if}
</div>

<!-- Modal to add new deliberation linked to existing media/source -->
<KuzniaNewModal
	open={newModalOpen}
	mediaList={data.mediaList}
	sourcesList={data.sourcesList}
	onclose={() => (newModalOpen = false)}
/>
