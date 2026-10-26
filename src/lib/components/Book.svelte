<script lang="ts">
	// 線裝: the chapter cut into 版面 the way the edition was printed — its own 行款,
	// frame, 界行 and 版心 — and turned one leaf (葉) at a time.
	import type { Chapter, Ed, EditionInfo } from '#lib/types.js';
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { zhNumber } from '#lib/dates.js';
	import { layoutChapter, segOfColumn } from '#lib/layout.js';
	import { onTextClick } from '#lib/interact.js';
	import ColumnView from './ColumnView.svelte';
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';

	let {
		chapter,
		ed,
		edition,
		half = false
	}: { chapter: Chapter; ed: Ed; edition: EditionInfo; half?: boolean } = $props();

	const s = app.settings;
	let viewW = $state(800);
	let viewH = $state(600);
	/** the page shown: a whole leaf, or in half mode one 半葉 (a, then b) */
	let leaf = $state(0);

	const L = $derived(edition.layout);
	const layout = $derived(
		layoutChapter(chapter, {
			ed,
			script: s.script,
			punct: s.punct,
			notes: s.notes,
			notesMode: s.notesMode,
			rows: L.rows,
			noteH: L.rows / L.noteRows,
			frontMatter: true,
			...reading.layoutOf(s.script)
		})
	);
	const COL = 1.32; // column width in rows
	const BX = 1.5; // 版心 width in columns
	const unit = $derived(
		Math.max(8, Math.min((viewH - 70) / (L.rows + 2.2), (viewW - 120) / (COL * ((half ? 1 : 2) * L.cols + (half ? BX / 2 : BX)) + 1.2)))
	);
	const colW = $derived(unit * COL);
	const halfW = $derived(colW * L.cols);
	const bxW = $derived(colW * BX);
	const pageW = $derived(half ? halfW + bxW / 2 : halfW * 2 + bxW);
	const pageH = $derived(unit * L.rows);
	const perLeaf = $derived(L.cols * (half ? 1 : 2));
	const leaves = $derived(Math.max(1, Math.ceil(layout.cols.length / perLeaf)));
	const black = $derived(L.mouth.includes('黑'));
	const bookName = $derived(reading.layoutOf(s.script).bookTitle);
	// 白口 books print 卷 in the 版心 title, 黑口 ones only the number
	const juanZh = $derived(reading.info?.juanZh ?? '');
	const juanShort = $derived(black ? juanZh.replace('卷', '') : juanZh);
	// 雙行小注 in a printed book are cut smaller than the text and only a little taller than wide
	const NOTE = 0.8;
	const noteStretch = $derived(Math.min(1.15, unit / (colW / 2 * NOTE)));

	const colsOf = (h: 0 | 1) => {
		const start = leaf * perLeaf + h * L.cols;
		return layout.cols.slice(start, start + L.cols).map((c, k) => ({ c, k }));
	};

	function leafOf(seg: string) {
		const i = layout.segCol.get(seg);
		return i == null ? null : Math.floor(i / perLeaf);
	}

	function go(n: number) {
		const next = Math.max(0, Math.min(leaves - 1, n));
		if (next === leaf) return;
		leaf = next;
		const seg = segOfColumn(layout, leaf * perLeaf);
		if (seg) {
			bookSource.ed = ed;
			bookSource.at = Date.now();
			app.seg = seg;
		}
	}

	// In 對照 mode, the other edition turns to the same passage.
	$effect(() => {
		const seg = app.seg;
		if (!seg || bookSource.ed === ed || Date.now() - bookSource.at > 400) return;
		const l = untrack(() => leafOf(seg));
		if (l != null) leaf = l;
	});

	// Open at the current reading position when the layout changes.
	$effect(() => {
		void layout;
		const cur = untrack(() => app.seg);
		const l = cur ? leafOf(cur) : null;
		untrack(() => (leaf = l ?? 0));
	});
	$effect(() => {
		const j = app.jump;
		if (!j) return;
		const l = untrack(() => leafOf(j.seg));
		if (l != null) leaf = l;
	});

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
		if (e.key === 'ArrowLeft') go(leaf + 1);
		if (e.key === 'ArrowRight') go(leaf - 1);
	}
	function onWheel(e: WheelEvent) {
		if (Math.abs(e.deltaY) < 30) return;
		go(leaf + (e.deltaY > 0 ? 1 : -1));
	}
</script>

<script lang="ts" module>
	export const bookSource = { ed: '', at: 0 };
</script>

<svelte:window onkeydown={onKey} />

<div class="desk" bind:clientWidth={viewW} bind:clientHeight={viewH} onwheel={onWheel}>
	<button class="turn next" onclick={() => go(leaf + 1)} disabled={leaf >= leaves - 1} aria-label="下一叶">‹</button>
	{#key leaf}
		<div
			class="leaf"
			style="width:{pageW + unit * 1.2}px;height:{pageH + unit * 1.2}px"
			in:fade={{ duration: 180 }}
			onclick={(e) => onTextClick(e, ed)}
			role="presentation"
		>
			<div class="frame" style="inset:{unit * 0.6}px">
				{#if half}
					<!-- one 半葉: a (the right half of the sheet) has the 版心 at its left edge, b at its right -->
					{@const side = leaf % 2}
					{@const textX = side === 0 ? pageW : halfW}
					{#each Array(L.cols) as _, k (k)}
						<div class="rule" style="left:{textX - (k + 1) * colW}px"></div>
					{/each}
					{#each colsOf(0) as { c, k } (k)}
						<ColumnView col={c} {unit} width={colW} x={textX - (k + 1) * colW} {noteStretch} noteScale={NOTE} />
					{/each}
					<div class="banxin half" style="left:{side === 0 ? 0 : halfW}px;width:{bxW / 2}px">
						{#if black}<div class="xiangbi top"></div><div class="xiangbi bottom"></div>{/if}
						<div class="bx-title" style="top:{pageH * 0.24}px;font-size:{bxW * 0.3}px">{bookName}{juanShort}</div>
						<div class="bx-page" style="top:{pageH * 0.7}px;font-size:{bxW * 0.3}px">{zhNumber(Math.floor(leaf / 2) + 1)}</div>
					</div>
				{:else}
					<!-- right half-leaf (a), then 版心, then left half-leaf (b) -->
					{#each [0, 1] as h (h)}
						{@const right = h === 0 ? pageW : halfW}
						{#each Array(L.cols) as _, k (k)}
							<div class="rule" style="left:{right - (k + 1) * colW}px"></div>
						{/each}
						{#each colsOf(h as 0 | 1) as { c, k } (k)}
							<ColumnView col={c} {unit} width={colW} x={right - (k + 1) * colW} {noteStretch} noteScale={NOTE} />
						{/each}
					{/each}
					<div class="banxin" style="left:{halfW}px;width:{bxW}px">
						{#if black}<div class="xiangbi top"></div>{:else if L.top}<div class="bx-top">{L.top}</div>{/if}
						<svg class="yuwei" viewBox="0 0 20 10" style="top:{pageH * 0.2}px" aria-hidden="true"><path d="M0 0 H20 V10 L10 4 L0 10 Z" /></svg>
						<div class="bx-title" style="top:{pageH * 0.2 + bxW * 0.6}px;font-size:{bxW * 0.42}px">{bookName}{juanShort}</div>
						{#if L.fishtail === 2}<svg class="yuwei down" viewBox="0 0 20 10" style="top:{pageH * 0.78}px" aria-hidden="true"><path d="M0 10 H20 V0 L10 6 L0 0 Z" /></svg>{/if}
						<div class="bx-page" style="top:{pageH * (L.fishtail === 2 ? 0.66 : 0.72)}px;font-size:{bxW * 0.4}px">{zhNumber(leaf + 1)}</div>
						{#if black}<div class="xiangbi bottom"></div>{/if}
					</div>
				{/if}
			</div>
		</div>
	{/key}
	<button class="turn prev" onclick={() => go(leaf - 1)} disabled={leaf <= 0} aria-label="上一叶">›</button>
	<div class="folio">
		{edition.short} · {edition.layout.desc} ·
		{#if half}第 {Math.floor(leaf / 2) + 1} 叶{leaf % 2 ? 'b' : 'a'} / {Math.ceil(leaves / 2)}{:else}第 {leaf + 1} / {leaves} 叶{/if}
	</div>
</div>

<style>
	.desk {
		position: relative;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: var(--desk);
		overflow: hidden;
	}
	.leaf {
		position: relative;
		background: var(--book-paper);
		background-image: var(--paper-grain);
		box-shadow: 0 2px 14px rgba(40, 25, 10, 0.25);
	}
	.frame {
		position: absolute;
		border: 3px solid var(--frame);
		outline: 1px solid var(--frame);
		outline-offset: -7px;
	}
	.rule {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0;
		border-left: 1px solid var(--rule);
	}
	.banxin.half {
		border-left: none;
		border-right: none;
		background: rgba(58, 46, 36, 0.04);
	}
	.banxin {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--frame);
		border-right: 1px solid var(--frame);
		color: var(--ink);
	}
	.bx-top {
		position: absolute;
		top: 8px;
		left: 0;
		right: 0;
		writing-mode: vertical-rl;
		margin: 0 auto;
		font-size: 10px;
		opacity: 0.75;
		display: flex;
		align-items: center;
	}
	.xiangbi {
		position: absolute;
		left: 28%;
		right: 28%;
		height: 12%;
		background: var(--frame);
	}
	.xiangbi.top {
		top: 0;
	}
	.xiangbi.bottom {
		bottom: 0;
	}
	.yuwei {
		position: absolute;
		left: 0;
		width: 100%;
		fill: var(--frame);
	}
	.bx-title,
	.bx-page {
		position: absolute;
		left: 0;
		right: 0;
		writing-mode: vertical-rl;
		display: flex;
		align-items: center;
		letter-spacing: 0.1em;
	}
	.turn {
		background: none;
		border: none;
		font-size: 40px;
		color: var(--ink-soft);
		cursor: pointer;
		padding: 0 6px;
	}
	.turn:disabled {
		opacity: 0.2;
		cursor: default;
	}
	.folio {
		position: absolute;
		bottom: 6px;
		left: 0;
		right: 0;
		text-align: center;
		font-size: 12px;
		color: var(--ink-soft);
	}
</style>
