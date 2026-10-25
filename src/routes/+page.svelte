<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import SidePanel from '#lib/components/SidePanel.svelte';
	import Reader from '#lib/components/Reader.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import ParallelPanel from '#lib/components/ParallelPanel.svelte';
	import MapPanel from '#lib/components/MapPanel.svelte';

	const s = app.settings;

	// Deep links: #shiji-7/7.3.1 opens a chapter at a sentence.
	function fromHash() {
		const m = location.hash.match(/^#(shiji-\d+)(?:\/([\d.]+))?/);
		return m ? { chapter: m[1], seg: m[2] ?? null } : null;
	}

	onMount(() => {
		const h = fromHash();
		reading.init().then(() => reading.open(h?.chapter ?? s.chapter, h?.seg)).then(() => {
			if (h?.seg) requestAnimationFrame(() => app.goto(h.seg!));
		});
		const onHash = () => {
			const x = fromHash();
			if (x && (x.chapter !== reading.chapter?.id || (x.seg && x.seg !== app.seg))) reading.open(x.chapter, x.seg);
		};
		addEventListener('hashchange', onHash);
		return () => removeEventListener('hashchange', onHash);
	});

	let hashTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const id = reading.chapter?.id;
		const seg = app.seg;
		if (!id) return;
		clearTimeout(hashTimer);
		hashTimer = setTimeout(() => history.replaceState(null, '', `#${id}${seg ? '/' + seg : ''}`), 300);
	});

	$effect(() => {
		document.documentElement.dataset.script = s.script;
		document.documentElement.dataset.face = s.face;
		document.documentElement.lang = s.script === 't' ? 'zh-Hant' : 'zh-Hans';
	});
	$effect(() => {
		const ch = reading.chapter;
		if (ch) document.title = `${s.script === 't' ? ch.title.t : ch.title.s} · ${s.script === 't' ? '史讀' : '史读'}`;
	});
</script>

<div class="app">
	<TopBar />
	<main>
		<SidePanel />
		<div class="stage">
			<Reader />
			{#if app.parallelWide}
				<div class="overlay"><ParallelPanel wide /></div>
			{:else if app.mapWide}
				<div class="overlay"><MapPanel wide /></div>
			{/if}
		</div>
	</main>
	<Timeline />
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100vh;
	}
	main {
		display: grid;
		grid-template-columns: minmax(320px, 420px) 1fr;
		min-height: 0;
	}
	.stage {
		position: relative;
		background: var(--stage);
		min-width: 0;
		min-height: 0;
	}
	.overlay {
		position: absolute;
		inset: 0;
		background: var(--panel);
		z-index: 5;
		box-shadow: inset 0 0 0 1px var(--chrome-edge);
	}
	@media (max-width: 760px) {
		main {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 40%;
		}
		main > :global(.side) {
			order: 2;
		}
	}
</style>
