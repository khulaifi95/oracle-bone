<script lang="ts">
	// 輿圖: the base map with the rivers on their courses of the period, the states of the current year
	// at their capitals, and the places named around the current passage.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { occurrences } from '#lib/find.js';

	let { wide = false }: { wide?: boolean } = $props();

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
	// where the book's events happen: the view the map opens on
	const HOME = $derived<[number, number, number, number]>(reading.book?.map.home ?? [106.5, 28.5, 122.5, 38.8]);
	const mapInfo = $derived(reading.book?.map);
	const sides = $derived(reading.book?.sides ?? []);
	const home = $derived<[number, number, number, number]>([px(HOME[0]), py(HOME[3]), px(HOME[2]) - px(HOME[0]), py(HOME[1]) - py(HOME[3])]);
	const vb = $derived(view ?? home);
	// another book: back to its home view
	$effect(() => {
		void reading.bookId;
		view = null;
	});
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
	// svg units per screen pixel, so that labels keep their size on screen at any zoom or panel size
	let cw = $state(400);
	let ch = $state(400);
	const u = $derived(Math.max(vb[2] / (cw || 1), vb[3] / (ch || 1)));
	const detail = $derived(u < 1.1);
	const ring = (pts: [number, number][]) => path(pts) + 'Z';
	const mid = (line: [number, number][]) => line[Math.floor(line.length / 2)];
	// rivers worth a name even when zoomed out
	const NAMED = $derived(new Set(mapInfo?.named ?? []));
	const MARSH_NAMED = $derived(new Set(mapInfo?.marshNames ?? []));
	const riverLabels = $derived.by(() => {
		const seen = new Set<string>();
		const out: { name: string; t: string; x: number; y: number }[] = [];
		for (const r of reading.basemap?.rivers ?? []) {
			if (seen.has(r.name) || !(detail || NAMED.has(r.name))) continue;
			// label the longest stretch of each river once
			const best = (reading.basemap?.rivers ?? []).filter((x) => x.name === r.name).sort((a, b) => b.line.length - a.line.length)[0];
			const [x, y] = mid(best.line);
			out.push({ name: r.name, t: r.t, x: px(x), y: py(y) });
			seen.add(r.name);
		}
		return out;
	});
	function onKey(e: KeyboardEvent) {
		if (wide && e.key === 'Escape') app.mapWide = false;
	}

	// the states as they stood in the latest year listed at or before the one being read
	const polityYears = $derived(Object.keys(reading.polities).map(Number).sort((a, b) => a - b));
	const polities = $derived.by(() => {
		const y = reading.date?.ey ?? polityYears[0];
		let best: number | null = null;
		for (const k of polityYears) if (k <= y) best = k;
		return best == null ? [] : (reading.polities[String(best)] ?? []);
	});
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

<svelte:window onkeydown={onKey} />

<div class="map" class:wide>
	<div class="head">
		<span class="year">{reading.date ? reading.dateText(reading.date.ey, null, s.script) : ''}</span>
		<span class="hint">{t ? '滾輪縮放，拖動平移' : '滚轮缩放，拖动平移'}</span>
		<button class="btn" onclick={() => (view = view ? null : [0, 0, W, H])}>{view ? (t ? '復原' : '复原') : t ? '全圖' : '全图'}</button>
		<button class="btn" onclick={() => (app.mapWide = !app.mapWide)} title={wide ? 'Esc' : ''}>{wide ? (t ? '收起' : '收起') : t ? '放大' : '放大'}</button>
	</div>
	<p class="purpose">{mapInfo ? (t ? mapInfo.purpose.t : mapInfo.purpose.s) : ''}</p>
	<div class="frame" bind:clientWidth={cw} bind:clientHeight={ch}>
		<svg
			bind:this={svg}
			viewBox={vb.join(' ')}
			preserveAspectRatio="xMidYMid meet"
			onwheel={onWheel}
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={() => (drag = null)}
			role="img"
			aria-label={t ? '形勢圖' : '形势图'}
		>
			<defs>
				{#each sides as { id: side } (side)}
					<radialGradient id="halo-{side}">
						<stop offset="0" style="stop-color:var(--{side});stop-opacity:0.42" />
						<stop offset="0.6" style="stop-color:var(--{side});stop-opacity:0.16" />
						<stop offset="1" style="stop-color:var(--{side});stop-opacity:0" />
					</radialGradient>
				{/each}
				{#if reading.basemap}
					<clipPath id="han-sea">
						{#each reading.basemap.hanSea as h (h.name)}<path d={ring(h.ring)} />{/each}
					</clipPath>
					<mask id="not-han-sea">
						<rect x="-2000" y="-2000" width={W + 4000} height={H + 4000} fill="#fff" />
						{#each reading.basemap.hanSea as h (h.name)}<path d={ring(h.ring)} fill="#000" />{/each}
					</mask>
				{/if}
			</defs>
			<rect x="-2000" y="-2000" width={W + 4000} height={H + 4000} class="sea" />
			{#if reading.basemap}
				{#each reading.basemap.land as l, i (i)}
					<path d={ring(l)} class="land" />
				{/each}
				<!-- land built out since: sea in 200 BC, with today's shore dashed -->
				{#each reading.basemap.hanSea as h (h.name)}
					<path d={ring(h.ring)} class="sea" />
				{/each}
				<g mask="url(#not-han-sea)">
					{#each reading.basemap.coast as line, i (i)}
						<path d={path(line)} class="coast" style="stroke-width:{1.3 * u}" />
					{/each}
				</g>
				<g clip-path="url(#han-sea)">
					{#each reading.basemap.coast as line, i (i)}
						<path d={path(line)} class="coast now" style="stroke-width:{0.9 * u};stroke-dasharray:{4 * u} {3 * u}" />
					{/each}
				</g>
				{#each reading.basemap.hanSea as h (h.name)}
					<path d={path(h.coast)} class="coast" style="stroke-width:{1.3 * u}"><title>{t ? '古海岸（約略）' : '古海岸（约略）'}</title></path>
				{/each}
				{#each reading.basemap.lakes as line, i (i)}
					<path d={ring(line)} class="lake" style="stroke-width:{0.7 * u}" />
				{/each}
				{#each reading.basemap.marshes as m (m.name)}
					<path d={ring(m.ring)} class="marsh" style="stroke-width:{0.8 * u};stroke-dasharray:{2 * u} {2 * u}"><title>{m.name}</title></path>
				{/each}
			{/if}

			{#each polities as pol (pol.name)}
				{@const cap = reading.placeById.get(pol.capital)}
				{#if cap}
					<circle cx={px(cap.lon)} cy={py(cap.lat)} r={K * 1.1} fill="url(#halo-{pol.side})" class="halo" />
				{/if}
			{/each}

			{#if reading.basemap}
				{#each reading.basemap.rivers as r, i (i)}
					<path d={path(r.line)} class="river" class:major={r.major} style="stroke-width:{(r.major ? 2.1 : 1.2) * u}"><title>{r.name}</title></path>
				{/each}
				{#each riverLabels as l (l.name)}
					<text x={l.x} y={l.y} class="rlabel" style="font-size:{12.5 * u}px;stroke-width:{3 * u}">{t ? l.t : l.name}</text>
				{/each}
				{#each reading.basemap.marshes as m (m.name)}
					{#if detail || MARSH_NAMED.has(m.name)}
						<text x={px(m.c[0])} y={py(m.c[1]) + 4 * u} class="mlabel" style="font-size:{12 * u}px;stroke-width:{3 * u}">{t ? m.t : m.name}</text>
					{/if}
				{/each}
				{#each reading.basemap.mountains as m (m.name)}
					<g class="mount">
						<path d="M{px(m.lon) - 5 * u},{py(m.lat) + 4 * u}L{px(m.lon)},{py(m.lat) - 5 * u}L{px(m.lon) + 5 * u},{py(m.lat) + 4 * u}Z" />
						<text x={px(m.lon) + 7 * u} y={py(m.lat) + 4 * u} style="font-size:{12.5 * u}px;stroke-width:{3 * u}">{t ? m.t : m.name}</text>
					</g>
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
					<circle cx={x} cy={y} r={(hot ? 4.6 : 2.6) * u} style="stroke-width:{1.2 * u}" />
					{#if hot || detail}
						<text x={x + 6 * u} y={y + 5 * u} style="font-size:{(hot ? 16 : 13) * u}px;stroke-width:{3.5 * u}">{name(p)}</text>
					{/if}
				</g>
			{/each}

			{#each polities as pol (pol.name)}
				{@const cap = reading.placeById.get(pol.capital)}
				{#if cap}
					<g class="polity" style="--c:{sideColor(pol.side)}">
						<rect x={px(cap.lon) - 7 * u} y={py(cap.lat) - 7 * u} width={14 * u} height={14 * u} style="stroke-width:{2 * u}" />
						<text x={px(cap.lon)} y={py(cap.lat) - 11 * u} style="font-size:{19 * u}px;stroke-width:{4 * u}">{pol.name}</text>
					</g>
				{/if}
			{/each}
		</svg>
	</div>
	<div class="legend">
		{#if polities.length}
			<div class="pols">
				{#each polities as pol (pol.name)}
					{@const ruler = reading.personById.get(pol.ruler)}
					<button class="pol" style="--c:{sideColor(pol.side)}" disabled={!ruler} onclick={() => ruler && ((app.person = ruler.id), (s.panel = 'people'))}>
						<b>{pol.name}</b>{ruler ? name(ruler) : (pol.who ?? '')}
					</button>
				{/each}
			</div>
		{:else}
			{#if mapInfo && mapInfo.empty.s}<div class="note">{t ? mapInfo.empty.t : mapInfo.empty.s}</div>{/if}
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
		{#each sides as x (x.id)}<span class="side" style="--c:var(--{x.id})">{t ? x.t : x.s}</span>{/each}
		<span class="dot" style="--c:var(--accent)">{t ? '本事' : '本事'}</span><span class="dot" style="--c:var(--place-line)">{t ? '本段' : '本段'}</span>
		<span class="dash">{t ? '今海岸' : '今海岸'}</span>
		<i>{mapInfo ? (t ? mapInfo.key.t : mapInfo.key.s) : ''}</i>
	</div>
</div>

<style>
	.map {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		font-size: 14.5px;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 8px 10px 2px;
	}
	.year {
		font-weight: 600;
		font-size: 16px;
		color: var(--accent);
	}
	.hint {
		font-size: 12.5px;
		color: var(--ink-soft);
		flex: 1;
	}
	.btn,
	.row button {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		padding: 2px 9px;
		cursor: pointer;
		font-size: 13.5px;
	}
	.purpose {
		margin: 2px 10px 6px;
		font-size: 13px;
		line-height: 1.6;
		color: var(--ink-note);
	}
	.wide .purpose {
		font-size: 14.5px;
	}
	.frame {
		flex: 1;
		min-height: 0;
		position: relative;
		margin: 0 8px;
		border: 1px solid var(--panel-edge);
		border-radius: 4px;
		overflow: hidden;
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
		background: var(--map-sea);
		display: block;
	}
	.sea {
		fill: var(--map-sea);
	}
	.land {
		fill: var(--map-land);
	}
	.coast {
		fill: none;
		stroke: var(--map-coast);
		stroke-linejoin: round;
	}
	.coast.now {
		stroke: var(--map-coast-now);
	}
	.lake {
		fill: var(--map-water);
		stroke: var(--map-river);
	}
	.marsh {
		fill: var(--map-marsh);
		stroke: var(--map-river);
	}
	.halo {
		pointer-events: none;
	}
	.river {
		fill: none;
		stroke: var(--map-river);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.rlabel,
	.mlabel {
		fill: var(--map-river-ink);
		font-style: italic;
		letter-spacing: 0.15em;
		paint-order: stroke;
		stroke: var(--map-land);
		pointer-events: none;
	}
	.mlabel {
		text-anchor: middle;
	}
	.mount path {
		fill: var(--map-mount);
	}
	.mount text {
		fill: var(--map-mount);
		paint-order: stroke;
		stroke: var(--map-land);
		letter-spacing: 0.1em;
	}
	.mount {
		pointer-events: none;
	}
	.place {
		cursor: pointer;
	}
	.place circle {
		fill: var(--ink-soft);
		stroke: var(--map-land);
	}
	.place text {
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--map-land);
	}
	.place.dim circle {
		opacity: 0.45;
	}
	.place.hot circle {
		fill: var(--place-line);
	}
	.place.hot text {
		font-weight: 600;
	}
	.place.ev circle {
		fill: var(--accent);
	}
	.place.sel circle {
		fill: var(--accent);
		stroke: #fff;
	}
	.place.sel text {
		fill: var(--accent);
	}
	.polity rect {
		fill: var(--map-land);
		stroke: var(--c);
	}
	.polity text {
		fill: var(--c);
		font-weight: 700;
		font-family: var(--font-kai);
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--map-land);
		pointer-events: none;
	}
	.legend {
		padding: 8px 10px 2px;
	}
	.pols {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.pol {
		border: none;
		border-left: 4px solid var(--c);
		background: var(--paper);
		padding: 2px 7px;
		font-size: 14px;
		cursor: pointer;
	}
	.pol b {
		color: var(--c);
		margin-right: 4px;
	}
	.note {
		font-size: 14px;
		color: var(--ink-soft);
	}
	.card {
		margin: 6px 10px;
		padding: 8px 10px;
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 4px;
	}
	.wide .card {
		position: absolute;
		right: 24px;
		top: 96px;
		width: 340px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}
	.card .title b {
		font-size: 18px;
		color: var(--place-line);
		margin-right: 8px;
	}
	.card .title span {
		font-size: 13.5px;
		color: var(--ink-soft);
	}
	.card p {
		margin: 6px 0;
		font-size: 15px;
		line-height: 1.6;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13.5px;
		color: var(--ink-soft);
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		padding: 4px 10px 8px;
		font-size: 13px;
		color: var(--ink-soft);
		align-items: center;
	}
	.key .side::before {
		content: '';
		display: inline-block;
		width: 9px;
		height: 9px;
		border: 2px solid var(--c);
		margin-right: 3px;
		vertical-align: -1px;
	}
	.key .dot::before {
		content: '';
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
		margin-right: 3px;
		vertical-align: -1px;
	}
	.key .dash::before {
		content: '';
		display: inline-block;
		width: 16px;
		border-top: 1.5px dashed var(--map-coast-now);
		margin-right: 3px;
		vertical-align: 3px;
	}
	.key i {
		margin-left: auto;
		font-style: normal;
	}
</style>
