<script lang="ts">
	// 時間軸: read right to left like the text. Events of the period, the current date,
	// and the life spans of the people around the current passage with their ages.
	import { app, timeOf, eraLabel, monthLabel, bceOf, ageAt, zhNumber } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { HistEvent, Person } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	let W = $state(1000);
	const PAD = 24;

	// piecewise scale: the years before 二世 and after 垓下 are compressed
	const BREAKS: [number, number][] = [
		[-219, 0],
		[-210.2, 0.07],
		[-201, 0.9],
		[-194.5, 1]
	];
	function frac(time: number) {
		const x = Math.max(BREAKS[0][0], Math.min(BREAKS[BREAKS.length - 1][0], time));
		for (let i = 1; i < BREAKS.length; i++) {
			const [t0, f0] = BREAKS[i - 1];
			const [t1, f1] = BREAKS[i];
			if (x <= t1) return f0 + ((x - t0) / (t1 - t0)) * (f1 - f0);
		}
		return 1;
	}
	const X = (time: number) => W - PAD - frac(time) * (W - 2 * PAD);

	const years = $derived.by(() => {
		const out: { y: number; x: number; label: string; major: boolean }[] = [];
		for (let y = -218; y <= -195; y++) {
			const major = y >= -210 && y <= -201;
			if (!major && y !== -218 && y !== -214 && y !== -198 && y !== -195) continue;
			out.push({ y, x: X(y), label: `前${-y}`, major });
		}
		return out;
	});
	const eras = [
		{ ey: -209, label: '二世' },
		{ ey: -206, label: '汉' },
		{ ey: -202, label: '汉五年 称帝' }
	];

	const inChapter = $derived(new Set(reading.chapterEvents.map((c) => c.e.id)));
	const current = $derived(reading.event?.id ?? null);

	// labels for this chapter's events, laid in lanes so they do not overlap
	const labelled = $derived.by(() => {
		const evs = reading.events.filter((e) => inChapter.has(e.id)).map((e) => ({ e, x: X(timeOf(e.ey, e.m)) }));
		evs.sort((a, b) => b.x - a.x);
		const laneEnd = [Infinity, Infinity, Infinity];
		const out: { e: HistEvent; x: number; lane: number }[] = [];
		for (const v of evs) {
			const title = t ? v.e.t : v.e.title;
			const w = title.length * 12 + 8;
			const lane = laneEnd.findIndex((end) => v.x + 4 <= end);
			if (lane < 0) continue;
			laneEnd[lane] = v.x - w;
			out.push({ ...v, lane });
		}
		return out;
	});

	const nowT = $derived(reading.date ? timeOf(reading.date.ey, reading.date.m) : null);
	const bce = $derived(reading.date ? bceOf(reading.date.ey, reading.date.m) : null);

	const lives = $derived.by(() => {
		const ids = [...reading.nearby.people.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
		if (app.person && !ids.includes(app.person)) ids.unshift(app.person);
		return ids
			.map((id) => reading.personById.get(id))
			.filter((p): p is Person => !!p && (p.born != null || p.died != null))
			.slice(0, 4);
	});

	function lifeLabel(p: Person) {
		const n = t ? p.t : p.name;
		if (bce == null) return n;
		if (p.died != null && bce < -p.died) return `${n} 卒`;
		const a = ageAt(p.born, bce);
		return a != null && a > 0 ? `${n} ${a}${t ? '歲' : '岁'}` : n;
	}

	function go(e: HistEvent) {
		app.event = e.id;
		const here = e.accounts.find((a) => a.ref === reading.chapter?.id && a.segs);
		if (here?.segs) return app.goto(here.segs[0]);
		const other = e.accounts.find((a) => a.ref.startsWith('shiji') && a.segs);
		if (other?.segs) reading.open(other.ref, other.segs[0]);
	}
	const dateText = $derived(
		reading.date ? `${eraLabel(reading.date.ey)}${monthLabel(reading.date.m)} · ${t ? '公元前' : '公元前'}${bce}${t ? '年' : '年'}` : ''
	);
</script>

<div class="tl" bind:clientWidth={W}>
	<svg width={W} height="148" role="img" aria-label="时间轴">
		<line x1={PAD} x2={W - PAD} y1="76" y2="76" class="axis" />
		{#each years as y (y.y)}
			<line x1={y.x} x2={y.x} y1="72" y2="80" class="tick" />
			<text x={y.x} y="92" class="year" class:minor={!y.major}>{y.label}</text>
		{/each}
		{#each eras as e (e.ey)}
			{@const x = X(timeOf(e.ey, 10) - 1 / 12)}
			<line x1={x} x2={x} y1="66" y2="86" class="era" />
			<text x={x - 3} y="104" class="era-label">{e.label}</text>
		{/each}

		{#each reading.events as e (e.id)}
			{@const x = X(timeOf(e.ey, e.m))}
			<g class="ev" class:here={inChapter.has(e.id)} class:cur={e.id === current} onclick={() => go(e)} role="button" tabindex="-1" onkeydown={() => {}}>
				<circle cx={x} cy="76" r={e.id === current ? 5 : inChapter.has(e.id) ? 3.6 : 2.4} />
				<title>{t ? e.t : e.title} · {e.era}{monthLabel(e.m)}</title>
			</g>
		{/each}
		{#each labelled as { e, x, lane } (e.id)}
			<g class="lab" class:cur={e.id === current} onclick={() => go(e)} role="button" tabindex="-1" onkeydown={() => {}}>
				<line x1={x} x2={x} y1={14 + lane * 18} y2="72" />
				<text x={x - 3} y={24 + lane * 18}>{t ? e.t : e.title}</text>
			</g>
		{/each}

		{#if nowT != null}
			<line x1={X(nowT)} x2={X(nowT)} y1="6" y2="142" class="now" />
		{/if}

		{#each lives as p, k (p.id)}
			{@const y = 114 + k * 8}
			{@const from = p.born != null ? X(p.born + 0.5) : W - PAD}
			{@const to = p.died != null ? X(p.died + 0.5) : PAD}
			<line x1={from} x2={to} y1={y} y2={y} class="life" style="--c:var(--{p.side})" />
			{#if p.died != null}<circle cx={to} cy={y} r="2.5" class="death" style="--c:var(--{p.side})" />{/if}
			<text x={p.died != null ? to - 5 : from - 4} y={y + 3} class="life-name">{t ? p.t : p.name}</text>
		{/each}
	</svg>
	<div class="lives">
		{#each lives as p (p.id)}
			<button class="life-chip" style="--c:var(--{p.side})" onclick={() => ((app.person = p.id), (s.panel = 'people'))}>
				{lifeLabel(p)}{#if p.born != null}<small>前{-p.born}–{p.died != null ? `前${-p.died}` : ''}</small>{/if}
			</button>
		{/each}
	</div>
	<div class="date">{dateText}{#if reading.date?.from === 'text'}<small>「{reading.date.x}」</small>{/if}</div>
</div>

<style>
	.tl {
		position: relative;
		height: 172px;
		background: var(--chrome);
		border-top: 1px solid var(--chrome-edge);
		overflow: hidden;
	}
	svg {
		display: block;
	}
	.axis {
		stroke: var(--ink-soft);
	}
	.tick {
		stroke: var(--ink-soft);
	}
	.year {
		font-size: 11px;
		fill: var(--ink-note);
		text-anchor: middle;
	}
	.year.minor {
		font-size: 9px;
		fill: var(--ink-soft);
	}
	.era {
		stroke: var(--accent);
		stroke-dasharray: 2 2;
	}
	.era-label {
		font-size: 10px;
		fill: var(--accent);
		text-anchor: end;
	}
	.ev {
		cursor: pointer;
	}
	.ev circle {
		fill: var(--ink-soft);
		opacity: 0.5;
	}
	.ev.here circle {
		fill: var(--ink);
		opacity: 1;
	}
	.ev.cur circle {
		fill: var(--accent);
	}
	.lab {
		cursor: pointer;
	}
	.lab line {
		stroke: var(--chrome-edge);
	}
	.lab text {
		font-size: 12px;
		fill: var(--ink-note);
		text-anchor: end;
	}
	.lab.cur text {
		fill: var(--accent);
		font-weight: 600;
	}
	.lab:hover text {
		fill: var(--accent);
	}
	.now {
		stroke: var(--accent);
		stroke-width: 1.5;
		opacity: 0.7;
	}
	.life {
		stroke: var(--c);
		stroke-width: 3;
		opacity: 0.45;
		stroke-linecap: round;
	}
	.death {
		fill: var(--c);
	}
	.life-name {
		font-size: 9px;
		fill: var(--ink-note);
		text-anchor: end;
		paint-order: stroke;
		stroke: var(--chrome);
		stroke-width: 3px;
	}
	.lives {
		position: absolute;
		left: 10px;
		bottom: 4px;
		display: flex;
		gap: 6px;
	}
	.life-chip {
		border: none;
		border-left: 3px solid var(--c);
		background: var(--paper);
		font-size: 12px;
		padding: 1px 6px;
		cursor: pointer;
	}
	.life-chip small {
		color: var(--ink-soft);
		margin-left: 4px;
		font-size: 10px;
	}
	.date {
		position: absolute;
		right: 12px;
		bottom: 4px;
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
		background: var(--chrome);
		padding-left: 6px;
	}
	.date small {
		font-weight: 400;
		color: var(--ink-soft);
		margin-left: 6px;
	}
</style>
