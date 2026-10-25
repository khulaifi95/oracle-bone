<script lang="ts">
	// One vertical column of the text: cells are absolutely placed on a row grid.
	import type { Column } from '#lib/layout.js';
	import { app } from '#lib/state.svelte.js';

	let {
		col,
		unit,
		width,
		x,
		top = 0,
		noteStretch = 1
	}: { col: Column; unit: number; width: number; x: number; top?: number; noteStretch?: number } = $props();

	const s = app.settings;
</script>

<div class="col" class:title={col.kind === 'title'} style="left:{x}px;top:{top}px;width:{width}px">
	{#each col.cells as c, k (k)}
		<span
			class="c {c.k}"
			class:half={c.x !== 2}
			class:left={c.x === 1}
			class:sel={c.seg != null && c.seg === app.seg && c.k === 'm'}
			class:tp={s.names && c.tag === 'p'}
			class:tl={s.names && c.tag === 'l'}
			class:ts={c.tagStart}
			class:te={c.tagEnd}
			class:on={c.ref != null && (c.ref === app.person || c.ref === app.place)}
			class:v={s.variants && !!c.v}
			class:vsel={c.v != null && c.v === app.variant}
			class:vgap={s.variants && !!c.vgap}
			class:r={c.r}
		class:qb={c.qb}
			class:del={c.del}
			class:add={!!c.add}
			class:nsel={c.note != null && c.note === app.note?.id}
			data-seg={c.seg}
			data-i={c.i}
			data-ref={c.ref}
			data-tag={c.tag}
			data-v={c.v ?? c.vgap}
			data-note={c.note}
			data-add={c.add}
			title={c.add ? `点校本补「${c.add}」` : c.del ? '点校本删去此字' : c.r ? '四库录文缺此字，据金陵本补' : c.qb ? '原刻缺末笔，避清讳' : undefined}
			style="top:{c.y * unit}px;height:{c.h * unit}px;{c.x === 2 ? `width:${width}px;font-size:${c.k === 'p' ? unit * 0.62 : unit * 0.86}px` : `width:${width / 2}px;left:${c.x === 0 ? width / 2 : 0}px;font-size:${Math.min(width / 2, unit * c.h) * 0.92}px;--stretch:${noteStretch}`}"
			>{c.ch}{#if c.mark}<i class="mark" class:stop={c.mark === '。'}></i>{/if}</span
		>
	{/each}
</div>

<style>
	.col {
		position: absolute;
	}
	.c {
		position: absolute;
		left: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		color: var(--ink);
		cursor: default;
		user-select: text;
	}
	.c.m {
		cursor: pointer;
	}
	.c.h {
		font-weight: 600;
		letter-spacing: 0;
	}
	.c.n {
		color: var(--ink-note);
		cursor: pointer;
	}
	.c.n.half {
		transform: scaleY(var(--stretch, 1));
	}
	/* 陰文: the commentary's name cut in white on black */
	.c.l {
		color: var(--paper);
		background: var(--ink-note);
		box-shadow: inset 0 0 0 1px var(--paper);
		border-radius: 2px;
		cursor: pointer;
	}
	.c.p {
		color: var(--ink-soft);
		align-items: flex-start;
		justify-content: flex-end;
		padding-right: 12%;
	}
	.c.sel {
		background: var(--sel);
	}
	/* 專名線: a straight line on the left of names (people), a dotted one for places */
	.c.tp::after,
	.c.tl::after {
		content: '';
		position: absolute;
		left: 6%;
		top: 0;
		bottom: 0;
		border-left: 1.5px solid var(--name-line);
	}
	.c.tl::after {
		border-left: 1.5px dashed var(--place-line);
	}
	.c.tp.ts::after,
	.c.tl.ts::after {
		top: 8%;
	}
	.c.tp.te::after,
	.c.tl.te::after {
		bottom: 8%;
	}
	.c.on {
		color: var(--accent);
	}
	.c.v::before,
	.c.vgap::before {
		content: '';
		position: absolute;
		right: 2px;
		top: 50%;
		width: 5px;
		height: 5px;
		margin-top: -2.5px;
		border-radius: 50%;
		background: var(--var-dot);
	}
	.c.vgap::before {
		top: 100%;
		background: transparent;
		border: 1px solid var(--var-dot);
	}
	.c.vsel {
		background: var(--var-sel);
	}
	.c.r {
		text-decoration: underline dotted var(--ink-soft);
		text-underline-offset: 2px;
	}
	/* 缺筆: a small open corner where the last stroke is missing */
	.c.qb::after {
		content: '';
		position: absolute;
		right: 8%;
		bottom: 8%;
		width: 22%;
		height: 22%;
		border-right: 1.5px solid var(--var-dot);
		border-bottom: 1.5px solid var(--var-dot);
	}
	.c.del {
		color: var(--ink-soft);
		opacity: 0.7;
	}
	.c.del::before {
		content: '';
		position: absolute;
		inset: 10% 15%;
		border: 1px solid var(--ink-soft);
		border-radius: 50%;
		opacity: 0.6;
	}
	.c.add::before {
		content: '⁺';
		position: absolute;
		bottom: -2px;
		right: 0;
		font-size: 11px;
		color: var(--accent);
	}
	.c.nsel {
		background: var(--note-sel);
	}
	.mark {
		position: absolute;
		right: -2px;
		bottom: -3px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--judou);
	}
	.mark.stop {
		width: 7px;
		height: 7px;
		background: transparent;
		border: 1.5px solid var(--judou);
		right: -4px;
		bottom: -5px;
	}
</style>
