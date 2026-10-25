<script lang="ts">
	// The text itself: one edition, or both stacked for 對照, as a scroll or as 線裝 leaves.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { Ed } from '#lib/types.js';
	import Scroll from './Scroll.svelte';
	import Book from './Book.svelte';

	const s = app.settings;
	const eds = $derived<Ed[]>(s.edition === 'both' ? ['d', 'j'] : [s.edition]);
	const info = $derived(reading.chapter ? reading.catalog?.books.shiji.chapters.find((c) => c.id === reading.chapter!.id) : null);
</script>

<div class="reader" class:pair={eds.length === 2} class:side={eds.length === 2 && s.form === 'book'}>
	{#if reading.chapter && reading.catalog}
		{#key reading.chapter.id}
			{#each eds as ed (ed)}
				{@const edition = reading.catalog.editions[ed]}
				<div class="pane">
					{#if s.form === 'scroll'}
						<Scroll chapter={reading.chapter} {ed} id={ed} label={eds.length === 2 ? edition.short : ''} />
					{:else}
						<Book chapter={reading.chapter} {ed} {edition} juanZh={info?.juanZh ?? ''} half={eds.length === 2} />
					{/if}
				</div>
			{/each}
		{/key}
	{:else if reading.error}
		<div class="msg">读取失败：{reading.error}</div>
	{:else}
		<div class="msg">展卷中……</div>
	{/if}
</div>

<style>
	.reader {
		height: 100%;
		display: grid;
		grid-template-rows: 1fr;
		min-width: 0;
	}
	.reader.pair {
		grid-template-rows: 1fr 1fr;
		gap: 4px;
		background: var(--chrome);
	}
	/* 線裝 對照: one 半葉 of each edition, 殿本 on the right */
	.reader.side {
		grid-template-rows: 1fr;
		grid-template-columns: 1fr 1fr;
		direction: rtl;
	}
	.reader.side .pane {
		direction: ltr;
	}
	.pane {
		min-height: 0;
		position: relative;
	}
	.msg {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-soft);
		letter-spacing: 0.3em;
	}
</style>
