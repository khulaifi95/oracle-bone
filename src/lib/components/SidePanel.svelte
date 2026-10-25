<script lang="ts">
	// The left column: the context layers for the current passage.
	import { app, type Panel } from '#lib/state.svelte.js';
	import MapPanel from './MapPanel.svelte';
	import PeoplePanel from './PeoplePanel.svelte';
	import ParallelPanel from './ParallelPanel.svelte';
	import VariantsPanel from './VariantsPanel.svelte';
	import NotePanel from './NotePanel.svelte';
	import AboutPanel from './AboutPanel.svelte';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const TABS: { id: Panel; s: string; t: string }[] = [
		{ id: 'map', s: '舆图', t: '輿圖' },
		{ id: 'people', s: '人物', t: '人物' },
		{ id: 'parallel', s: '对读', t: '對讀' },
		{ id: 'variants', s: '校勘', t: '校勘' },
		{ id: 'note', s: '注', t: '注' },
		{ id: 'about', s: '凡例', t: '凡例' }
	];
	function pick(id: Panel) {
		s.panel = id;
		app.save();
	}
</script>

<aside class="side">
	<nav>
		{#each TABS as tab (tab.id)}
			<button class:on={s.panel === tab.id} onclick={() => pick(tab.id)}>{t ? tab.t : tab.s}</button>
		{/each}
	</nav>
	<div class="body">
		{#if s.panel === 'map'}{#if app.mapWide}<div class="placeholder">{t ? '輿圖已展開於右側' : '舆图已展开于右侧'}</div>{:else}<MapPanel />{/if}
		{:else if s.panel === 'people'}<PeoplePanel />
		{:else if s.panel === 'parallel'}{#if app.parallelWide}<div class="placeholder">{t ? '對讀已展開於右側' : '对读已展开于右侧'}</div>{:else}<ParallelPanel />{/if}
		{:else if s.panel === 'variants'}<VariantsPanel />
		{:else if s.panel === 'note'}<NotePanel />
		{:else}<AboutPanel />{/if}
	</div>
</aside>

<style>
	.side {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--panel);
		border-right: 3px solid var(--chrome);
	}
	nav {
		display: flex;
		background: var(--panel-2);
		border-bottom: 1px solid var(--panel-edge);
	}
	nav button {
		flex: 1;
		border: none;
		background: none;
		padding: 10px 0 8px;
		cursor: pointer;
		font-size: 16px;
		letter-spacing: 0.15em;
		color: var(--ink-note);
		border-bottom: 3px solid transparent;
	}
	nav button:hover {
		color: var(--ink);
	}
	nav button.on {
		color: var(--accent);
		background: var(--panel);
		border-bottom-color: var(--accent);
		font-weight: 700;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	.placeholder {
		padding: 20px;
		color: var(--ink-soft);
		font-size: 13px;
	}
</style>
