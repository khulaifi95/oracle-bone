<script lang="ts">
	// 輿圖: the base map with the rivers on their Han courses, the states of the current year
	// at their capitals, and the places named around the current passage.
	import { app, SIDE_LABEL, eraLabel, bceOf } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { occurrences } from '#lib/find.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const COS = Math.cos((33 * Math.PI) / 180);
	const K = 40;
	const bbox = $derived(reading.basemap?.bbox ?? [102, 24, 124, 42.5]);
	const W = $derived((bbox[2] - bbox[0]) * K * COS);
	const H = $derived((bbox[3] - bbox[1]) * K);
	const px = (lon: number) => (lon - bbox[0]) * K * COS;
	const py = (lat: number) => (bbox[3] - lat) * K;
	const path = (line: [number, number][]) => line.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('');

	// view box (zoom and pan)
	let view = $state<[number, number, number, number] | null>(null);
	// the heartland of the 秦漢之際 wars, from 關中 to the sea
	const HOME: [number, number, number, number] = [106.5, 28.5, 122.5, 38.8];
	const home = $derived<[number, number, number, number]>([px(HOME[0]), py(HOME[3]), px(HOME[2]) - px(HOME[0]), py(HOME[1]) - py(HOME[3])]);
	const vb = $derived(view ?? home);
	let svg: SVGSVGElement;
	let drag: { x: number; y: number; v: [number, number, number, number] } | null = null;

	function toSvg(e: { clientX: number; clientY: number }) {
		const r = svg.getBoundingClientRect();
		const scale = Math.max(vb[2] / r.width, vb[3] / r.height);
		const ox = (r.width * scale - vb[2]) / 2;
		const oy = (r.height * scale - vb[3]) / 2;
		return { x: vb[0] - ox + (e.clientX - r.left) * scale, y: vb[1] - oy + (e.clientY - r.top) * scale, scale };
	}
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const p = toSvg(e);
		const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
		const w = Math.min(W, Math.max(W / 8, vb[2] * f));
		const h = (w / vb[2]) * vb[3];
		view = [p.x - ((p.x - vb[0]) * w) / vb[2], p.y - ((p.y - vb[1]) * h) / vb[3], w, h];
	}
	function onDown(e: PointerEvent) {
		if ((e.target as Element).closest('.place')) return;
		drag = { x: e.clientX, y: e.clientY, v: [vb[0], vb[1], vb[2], vb[3]] };
		svg.setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (!drag) return;
		const r = svg.getBoundingClientRect();
		const scale = Math.max(drag.v[2] / r.width, drag.v[3] / r.height);
		view = [drag.v[0] - (e.clientX - drag.x) * scale, drag.v[1] - (e.clientY - drag.y) * scale, drag.v[2], drag.v[3]];
	}
	const zoom = $derived(W / vb[2]);

	const year = $derived(reading.date ? reading.date.ey : -209);
	const polityYear = $derived(String(Math.max(-209, Math.min(-201, year))));
	const polities = $derived(year < -209 ? [] : (reading.polities[polityYear] ?? []));
	const eventPlaces = $derived(new Set(reading.event?.places ?? []));
	const near = $derived(reading.nearby.places);
	const place = $derived(app.place ? reading.placeById.get(app.place) : null);
	const placeOcc = $derived(place && reading.chapter ? occurrences(reading.chapter, place.id) : []);
	const mentionsInChapter = $derived(reading.chapter?.mentions ?? {});

	// bring a newly selected place into view
	$effect(() => {
		const p = place;
		if (!p) return;
		const x = px(p.lon);
		const y = py(p.lat);
		const v = view;
		if (v && (x < v[0] || x > v[0] + v[2] || y < v[1] || y > v[1] + v[3])) view = [x - v[2] / 2, y - v[3] / 2, v[2], v[3]];
	});

	function nextOccurrence() {
		if (!placeOcc.length) return;
		const cur = app.seg ? (reading.order.get(app.seg) ?? -1) : -1;
		const next = placeOcc.find((id) => (reading.order.get(id) ?? 0) > cur) ?? placeOcc[0];
		app.goto(next);
	}
	const sideColor = (side: string) => `var(--${side})`;
	const name = (p: { name: string; t: string }) => (t ? p.t : p.name);
</script>

<div class="map">
	<div class="head">
		<span class="year">{reading.date ? `${eraLabel(reading.date.ey)} · 前${bceOf(reading.date.ey, reading.date.m)}年` : ''}</span>
		<span class="hint">{t ? '滾輪縮放，拖動平移' : '滚轮缩放，拖动平移'}</span>
		<button class="reset" onclick={() => (view = view ? null : [0, 0, W, H])}>{view ? (t ? '復原' : '复原') : t ? '全圖' : '全图'}</button>
	</div>
	<svg
		bind:this={svg}
		viewBox={vb.join(' ')}
		preserveAspectRatio="xMidYMid meet"
		onwheel={onWheel}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={() => (drag = null)}
		role="img"
		aria-label="秦汉之际形势图"
	>
		<rect x="-2000" y="-2000" width={W + 4000} height={H + 4000} class="sea" />
		{#if reading.basemap}
			{#each reading.basemap.coast as line, i (i)}
				<path d={path(line)} class="coast" style="stroke-width:{1.2 / zoom}" />
			{/each}
			{#each reading.basemap.lakes as line, i (i)}
				<path d={path(line) + 'Z'} class="lake" style="stroke-width:{0.6 / zoom}" />
			{/each}
			{#each reading.basemap.rivers as r, i (i)}
				<path d={path(r.line)} class="river" class:major={r.major} style="stroke-width:{(r.major ? 1.6 : 0.9) / zoom}"><title>{r.name}</title></path>
			{/each}
		{/if}

		{#each reading.places as p (p.id)}
			{@const hot = near.has(p.id) || eventPlaces.has(p.id) || app.place === p.id}
			{@const x = px(p.lon)}
			{@const y = py(p.lat)}
			<g
				class="place"
				class:hot
				class:ev={eventPlaces.has(p.id)}
				class:sel={app.place === p.id}
				class:dim={!hot && !mentionsInChapter[p.id]}
				onclick={() => (app.place = p.id)}
				role="button"
				tabindex="-1"
				onkeydown={() => {}}
			>
				<circle cx={x} cy={y} r={(hot ? 3.4 : 2) / Math.sqrt(zoom)} />
				{#if hot || zoom > 2.2}
					<text x={x + 5 / zoom} y={y + 4 / zoom} style="font-size:{(hot ? 13 : 10) / zoom}px">{name(p)}</text>
				{/if}
			</g>
		{/each}

		{#each polities as pol (pol.name)}
			{@const cap = reading.placeById.get(pol.capital)}
			{#if cap}
				<g class="polity" style="--c:{sideColor(pol.side)}">
					<rect x={px(cap.lon) - 6 / zoom} y={py(cap.lat) - 6 / zoom} width={12 / zoom} height={12 / zoom} style="stroke-width:{1.5 / zoom}" />
					<text x={px(cap.lon)} y={py(cap.lat) - 9 / zoom} style="font-size:{15 / zoom}px;stroke-width:{3 / zoom}">{pol.name}</text>
				</g>
			{/if}
		{/each}
	</svg>

	<div class="legend">
		{#if polities.length}
			<div class="pols">
				{#each polities as pol (pol.name)}
					{@const ruler = reading.personById.get(pol.ruler)}
					<button class="pol" style="--c:{sideColor(pol.side)}" onclick={() => ruler && ((app.person = ruler.id), (s.panel = 'people'))}>
						<b>{pol.name}</b>{ruler ? name(ruler) : ''}
					</button>
				{/each}
			</div>
		{:else}
			<div class="note">{t ? '秦統一天下，郡縣治之。' : '秦统一天下，郡县治之。'}</div>
		{/if}
	</div>

	{#if place}
		<div class="card">
			<div class="title">
				<b>{name(place)}</b>
				<span>{place.modern}</span>
			</div>
			{#if place.note}<p>{place.note}</p>{/if}
			<div class="row">
				<span>{t ? '本篇' : '本篇'} {placeOcc.length} {t ? '見' : '见'}</span>
				{#if placeOcc.length}<button onclick={nextOccurrence}>{t ? '下一處' : '下一处'} ›</button>{/if}
				<button onclick={() => (app.place = null)}>{t ? '關閉' : '关闭'}</button>
			</div>
		</div>
	{/if}
	<div class="key">
		<span style="--c:var(--qin)">{SIDE_LABEL.qin}</span><span style="--c:var(--chu)">{SIDE_LABEL.chu}</span><span style="--c:var(--han)">{SIDE_LABEL.han}</span><span style="--c:var(--other)">{SIDE_LABEL.other}</span>
		<i>{t ? '河、濟、淮依西漢故道' : '河、济、淮依西汉故道'}</i>
	</div>
</div>

<style>
	.map {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 6px 10px;
	}
	.year {
		font-weight: 600;
		color: var(--accent);
	}
	.hint {
		font-size: 11px;
		color: var(--ink-soft);
		flex: 1;
	}
	.reset,
	.row button {
		border: 1px solid var(--chrome-edge);
		background: var(--paper);
		border-radius: 3px;
		padding: 1px 8px;
		cursor: pointer;
		font-size: 12px;
	}
	svg {
		flex: 1;
		min-height: 0;
		width: 100%;
		cursor: grab;
		touch-action: none;
		background: #ebe4d2;
	}
	.sea {
		fill: #ebe4d2;
	}
	.coast {
		fill: none;
		stroke: #8c8676;
	}
	.lake {
		fill: #cfd9d6;
		stroke: #7f9894;
	}
	.river {
		fill: none;
		stroke: #6d93a6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.place {
		cursor: pointer;
	}
	.place circle {
		fill: var(--ink-soft);
	}
	.place text {
		fill: var(--ink);
		paint-order: stroke;
		stroke: #efe8d8;
		stroke-width: 0.25em;
	}
	.place.dim circle {
		opacity: 0.4;
	}
	.place.hot circle {
		fill: var(--place-line);
	}
	.place.ev circle {
		fill: var(--accent);
	}
	.place.sel circle {
		fill: var(--accent);
		stroke: #fff;
		stroke-width: 0.6;
	}
	.place.sel text {
		font-weight: 600;
		fill: var(--accent);
	}
	.polity rect {
		fill: none;
		stroke: var(--c);
	}
	.polity text {
		fill: var(--c);
		font-weight: 600;
		text-anchor: middle;
		paint-order: stroke;
		stroke: #efe8d8;
		pointer-events: none;
	}
	.legend {
		padding: 6px 10px 2px;
	}
	.pols {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.pol {
		border: none;
		border-left: 3px solid var(--c);
		background: var(--paper);
		padding: 1px 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.pol b {
		color: var(--c);
		margin-right: 4px;
	}
	.note {
		font-size: 12px;
		color: var(--ink-soft);
	}
	.card {
		margin: 6px 10px;
		padding: 8px 10px;
		background: var(--paper);
		border: 1px solid var(--chrome-edge);
		border-radius: 4px;
	}
	.card .title b {
		font-size: 17px;
		color: var(--place-line);
		margin-right: 8px;
	}
	.card .title span {
		font-size: 12px;
		color: var(--ink-soft);
	}
	.card p {
		margin: 6px 0;
		font-size: 13px;
		line-height: 1.6;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		color: var(--ink-soft);
	}
	.key {
		display: flex;
		gap: 10px;
		padding: 4px 10px 8px;
		font-size: 11px;
		color: var(--ink-soft);
		align-items: center;
	}
	.key span::before {
		content: '';
		display: inline-block;
		width: 8px;
		height: 8px;
		border: 1.5px solid var(--c);
		margin-right: 3px;
		vertical-align: -1px;
	}
	.key i {
		margin-left: auto;
		font-style: normal;
	}
</style>
