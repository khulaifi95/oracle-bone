<script lang="ts">
	// 卷軸: the chapter as one continuous handscroll, read from right to left.
	import type { Chapter, Ed } from '#lib/types.js';
	import { app } from '#lib/state.svelte.js';
	import { layoutChapter, segOfColumn, type Layout } from '#lib/layout.js';
	import { onTextClick } from '#lib/interact.js';
	import ColumnView from './ColumnView.svelte';
	import { untrack } from 'svelte';

	let { chapter, ed, label = '', id }: { chapter: Chapter; ed: Ed; label?: string; id: string } = $props();

	const s = app.settings;
	let box: HTMLDivElement;
	let viewW = $state(800);
	let viewH = $state(600);
	let scrollLeft = $state(0);
	let programmatic = 0;

	const unit = $derived(Math.round(s.size * 1.08));
	const colW = $derived(Math.round(s.size * 1.55));
	const MARGIN_TOP = 34;
	const rows = $derived(Math.max(8, Math.floor((viewH - MARGIN_TOP * 2) / unit)));
	const END = 220; // room for the 引首 at the right and the 拖尾 at the left

	const layout: Layout = $derived(
		layoutChapter(chapter, {
			ed,
			script: s.script,
			punct: s.punct,
			notes: s.notes,
			notesMode: s.notesMode,
			rows,
			noteH: 0.62,
			frontMatter: false,
			bookTitle: '史记',
			juanZh: ''
		})
	);
	const total = $derived(layout.cols.length * colW + END * 2);
	const xOf = (i: number) => total - END - (i + 1) * colW;

	// Only the columns near the viewport are rendered.
	const visible = $derived.by(() => {
		const from = Math.floor((total - END - (scrollLeft + viewW)) / colW) - 4;
		const to = Math.ceil((total - END - scrollLeft) / colW) + 4;
		const out: number[] = [];
		for (let i = Math.max(0, from); i <= Math.min(layout.cols.length - 1, to); i++) out.push(i);
		return out;
	});

	function scrollToSeg(seg: string, smooth = false) {
		const i = layout.segCol.get(seg);
		if (i == null || !box) return;
		programmatic = Date.now();
		box.scrollTo({ left: Math.max(0, xOf(i) - viewW * 0.72), behavior: smooth ? 'smooth' : 'instant' });
	}

	// Start at the right end (the beginning of the text), or at the current position.
	let started = false;
	$effect(() => {
		void layout;
		if (!box) return;
		const cur = untrack(() => app.seg);
		const target = cur && layout.segCol.has(cur) ? cur : null;
		if (!started) {
			started = true;
			if (target) requestAnimationFrame(() => scrollToSeg(target));
			else requestAnimationFrame(() => box.scrollTo({ left: total }));
		} else if (target) requestAnimationFrame(() => scrollToSeg(target));
	});

	// Jump requests (from the timeline, the panels, links).
	$effect(() => {
		const j = app.jump;
		if (j) scrollToSeg(j.seg, true);
	});

	// In 對照 mode, follow the other scroll.
	$effect(() => {
		const seg = app.seg;
		if (seg && scrollSource.id && scrollSource.id !== id && Date.now() - scrollSource.at < 400) scrollToSeg(seg);
	});

	function onScroll() {
		scrollLeft = box.scrollLeft;
		if (Date.now() - programmatic < 600) return;
		const centre = Math.floor((total - END - (scrollLeft + viewW * 0.72)) / colW);
		const seg = segOfColumn(layout, Math.max(0, centre));
		if (seg && seg !== app.seg) {
			scrollSource.id = id;
			scrollSource.at = Date.now();
			app.seg = seg;
		}
	}

	function onWheel(e: WheelEvent) {
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
			e.preventDefault();
			box.scrollLeft -= e.deltaY;
		}
	}
</script>

<script lang="ts" module>
	export const scrollSource = { id: '', at: 0 };
</script>

<div class="scroll" bind:clientWidth={viewW} bind:clientHeight={viewH}>
	{#if label}<div class="label">{label}</div>{/if}
	<div
		class="track"
		bind:this={box}
		onscroll={onScroll}
		onwheel={onWheel}
		onclick={(e) => onTextClick(e, ed)}
		role="presentation"
	>
		<div class="paper" style="width:{total}px">
			<div class="mount top"></div>
			<div class="mount bottom"></div>
			<div class="yinshou" style="left:{total - END + 30}px"><span>{s.script === 's' ? '史记' : '史記'}</span></div>
			<div class="roller right" style="left:{total - 26}px"></div>
			<div class="roller left"></div>
			{#each visible as i (i)}
				<ColumnView col={layout.cols[i]} {unit} width={colW} x={xOf(i)} top={MARGIN_TOP} />
			{/each}
		</div>
	</div>
</div>

<style>
	.scroll {
		position: relative;
		height: 100%;
		min-height: 0;
	}
	.label {
		position: absolute;
		top: 6px;
		right: 14px;
		z-index: 3;
		font-size: 12px;
		color: var(--chrome-ink);
		background: var(--accent);
		padding: 1px 8px;
		border-radius: 2px;
		letter-spacing: 0.2em;
	}
	.track {
		position: absolute;
		inset: 12px 0;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
	}
	.paper {
		position: relative;
		height: 100%;
		background: var(--scroll-paper);
		background-image: var(--paper-grain);
	}
	.mount {
		position: absolute;
		left: 0;
		right: 0;
		height: 14px;
		background: var(--silk);
		background-image: repeating-linear-gradient(90deg, transparent 0 6px, rgba(255, 255, 255, 0.06) 6px 7px);
	}
	.mount.top {
		top: 0;
		border-bottom: 1px solid var(--silk-edge);
	}
	.mount.bottom {
		bottom: 0;
		border-top: 1px solid var(--silk-edge);
	}
	.yinshou {
		position: absolute;
		top: 14px;
		bottom: 14px;
		width: 150px;
		background: var(--silk-light);
		display: flex;
		align-items: center;
		justify-content: center;
		border-left: 1px solid var(--silk-edge);
		border-right: 1px solid var(--silk-edge);
	}
	.yinshou span {
		writing-mode: vertical-rl;
		font-size: 44px;
		letter-spacing: 0.4em;
		color: var(--ink);
		opacity: 0.85;
		font-weight: 600;
	}
	.roller {
		position: absolute;
		top: -2px;
		bottom: -2px;
		width: 26px;
		background: var(--roller);
		border-radius: 6px;
		box-shadow: inset -4px 0 6px rgba(0, 0, 0, 0.25);
	}
	.roller.left {
		left: 0;
	}
</style>
