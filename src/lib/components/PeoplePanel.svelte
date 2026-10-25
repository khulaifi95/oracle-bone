<script lang="ts">
	// 人物: who is on stage around the current passage, and a card for the selected person
	// (名、字、封號官稱 as of the current year, 歲數, and where the chapter mentions them).
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { ageAt, eraLabel, julianYear, yearShort } from '#lib/dates.js';
	import { occurrences } from '#lib/find.js';
	import type { Person } from '#lib/types.js';
	import Seal from './Seal.svelte';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const ed = $derived(s.edition === 'j' ? 'j' : 'd');
	const person = $derived(app.person ? reading.personById.get(app.person) : null);
	const date = $derived(reading.date);
	const cal = $derived(reading.book?.calendar);
	/** the Julian year being read */
	const year = $derived(date && cal ? julianYear(date.ey, date.m, cal) : null);
	const era = (ey: number) => (cal ? eraLabel(ey, cal, s.script, reading.info?.court) : '');

	const occ = $derived(person && reading.chapter ? occurrences(reading.chapter, person.id, ed) : []);
	const segById = $derived(new Map((reading.chapter?.segs ?? []).map((x) => [x.id, x])));

	const nearby = $derived(
		[...reading.nearby.people.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([id]) => reading.personById.get(id))
			.filter((p): p is Person => !!p)
	);
	const inChapter = $derived(
		Object.entries(reading.chapter?.mentions ?? {})
			.map(([id, n]) => ({ p: reading.personById.get(id), n }))
			.filter((x): x is { p: Person; n: number } => !!x.p)
			.sort((a, b) => b.n - a.n)
	);

	function titleAt(p: Person, ey: number | undefined) {
		if (!p.titles?.length || ey == null) return null;
		let cur: string | null = null;
		for (const [from, to, title] of p.titles) if (Number(from) <= ey && ey <= Number(to)) cur = title;
		return cur;
	}
	function lifeLine(p: Person) {
		const b = p.born != null ? yearShort(p.born) : '?';
		const d = p.died != null ? yearShort(p.died) : '?';
		return p.born == null && p.died == null ? '' : `${b}—${d}`;
	}
	function status(p: Person) {
		if (year == null) return '';
		if (p.died != null && year > p.died) return t ? '已卒' : '已卒';
		const a = ageAt(p.born, year);
		return a != null && a > 0 ? `${a}${t ? '歲' : '岁'}` : '';
	}
	function context(segId: string) {
		const seg = segById.get(segId);
		if (!seg || !person) return { before: '', name: '', after: '' };
		const tx = seg[ed];
		const str = t ? tx.t : tx.s;
		const g = tx.g?.find((x) => x[3] === person!.id);
		if (!g) return { before: str.slice(0, 24), name: '', after: '' };
		return { before: str.slice(Math.max(0, g[0] - 10), g[0]), name: str.slice(g[0], g[0] + g[1]), after: str.slice(g[0] + g[1], g[0] + g[1] + 14) };
	}
	function next() {
		const cur = app.seg ? (reading.order.get(app.seg) ?? -1) : -1;
		app.goto(occ.find((id) => (reading.order.get(id) ?? 0) > cur) ?? occ[0]);
	}
	const nm = (p: Person) => (t ? p.t : p.name);
	const chapterTitle = (id: string) => {
		const b = reading.book;
		const c = b?.chapters.find((x) => x.id === id);
		return b && c ? `${t ? b.t : b.title}·${t ? c.t : c.title}` : '';
	};
</script>

<div class="people">
	{#if person}
		<article class="card" style="--c:var(--{person.side})">
			<div class="top">
				<figure class="pic">
					{#if person.portrait}
						<img src="./{person.portrait.image}" alt={nm(person)} />
					{:else}
						<Seal name={person.t} size={92} color="var(--{person.side})" />
					{/if}
				</figure>
				<div class="who">
					<header>
						<h2>{nm(person)}</h2>
						{#if person.zi}<span class="zi">字{person.zi}</span>{/if}
						<span class="side">{reading.sideLabel(person.side, s.script)}</span>
						<button class="x" onclick={() => (app.person = null)} aria-label="关闭">×</button>
					</header>
					<div class="facts">
						{#if lifeLine(person)}<span>{lifeLine(person)}</span>{/if}
						{#if date && status(person)}<span class="age">{era(date.ey)}{status(person)}</span>{/if}
					</div>
					{#if titleAt(person, date?.ey)}<div class="now">{titleAt(person, date?.ey)}</div>{/if}
				</div>
			</div>
			{#if person.portrait}
				<div class="credit">
					{t ? '圖' : '图'}：{#if person.portrait.page}<a href={person.portrait.page} target="_blank" rel="noreferrer">{person.portrait.source}</a>{:else}{person.portrait.source}{/if}
				</div>
			{/if}
			{#if person.bornNote}<div class="small">{person.bornNote}</div>{/if}
			{#if person.aliases.length > 1}
				<div class="small">{t ? '文中稱' : '文中称'}：{person.aliases.join('、')}</div>
			{/if}
			<p>{t ? person.bioT : person.bio}</p>
			{#if person.titles?.length}
				<ol class="titles">
					{#each person.titles as [from, to, title], k (k)}
						<li class:cur={date && Number(from) <= date.ey && date.ey <= Number(to)}>
							<span>{era(Number(from))}</span><b>{title}</b>
						</li>
					{/each}
				</ol>
			{/if}
			{#if person.chapter && person.chapter !== reading.chapter?.id}
				<button class="link" onclick={() => reading.open(person!.chapter!)}>{t ? '本傳' : '本传'}：{chapterTitle(person.chapter)} ›</button>
			{/if}
			<div class="occ-head">
				<span>{t ? '本篇' : '本篇'} {occ.length} {t ? '見' : '见'}</span>
				{#if occ.length}<button onclick={next}>{t ? '下一處' : '下一处'} ›</button>{/if}
			</div>
			<ul class="occ">
				{#each occ.slice(0, 60) as id (id)}
					{@const c = context(id)}
					<li class:cur={id === app.seg}>
						<button onclick={() => app.goto(id)}>{c.before}<b>{c.name}</b>{c.after}</button>
					</li>
				{/each}
			</ul>
		</article>
	{/if}

	<section>
		<h3>{t ? '此段人物' : '此段人物'}</h3>
		<div class="chips">
			{#each nearby as p (p.id)}
				<button class="chip" class:on={p.id === app.person} style="--c:var(--{p.side})" onclick={() => (app.person = p.id)}>
					{#if p.portrait}<img class="av" src="./{p.portrait.image}" alt="" />{/if}{nm(p)}{#if status(p)}<small>{status(p)}</small>{/if}
				</button>
			{:else}
				<span class="small">—</span>
			{/each}
		</div>
	</section>
	<section>
		<h3>{t ? '本篇人物' : '本篇人物'}</h3>
		<div class="chips">
			{#each inChapter as { p, n } (p.id)}
				<button class="chip" class:on={p.id === app.person} style="--c:var(--{p.side})" onclick={() => (app.person = p.id)}>
					{#if p.portrait}<img class="av" src="./{p.portrait.image}" alt="" />{/if}{nm(p)}<small>{n}</small>
				</button>
			{/each}
		</div>
	</section>
</div>

<style>
	.people {
		padding: 10px;
		overflow-y: auto;
		height: 100%;
	}
	.card {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-top: 3px solid var(--c);
		border-radius: 4px;
		padding: 10px 12px;
		margin-bottom: 12px;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 26px;
		letter-spacing: 0.1em;
	}
	.zi {
		color: var(--ink-note);
	}
	.side {
		font-size: 13px;
		color: var(--c);
		border: 1px solid var(--c);
		padding: 0 4px;
		border-radius: 2px;
	}
	.x {
		margin-left: auto;
		border: none;
		background: none;
		font-size: 18px;
		cursor: pointer;
		color: var(--ink-soft);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 6px 0 2px;
		font-size: 14.5px;
	}
	.age {
		color: var(--accent);
	}
	.now {
		font-weight: 700;
		color: var(--c);
		margin-top: 4px;
	}
	.small {
		font-size: 13px;
		color: var(--ink-soft);
		margin: 2px 0;
	}
	p {
		line-height: 1.75;
		font-size: 15px;
		margin: 8px 0;
	}
	.titles {
		list-style: none;
		padding: 0;
		margin: 6px 0;
		font-size: 13.5px;
	}
	.titles li {
		display: flex;
		gap: 8px;
		padding: 1px 0;
		color: var(--ink-soft);
	}
	.titles li span {
		width: 5.5em;
	}
	.titles li.cur {
		color: var(--ink);
	}
	.titles li.cur b {
		color: var(--accent);
	}
	.link {
		border: none;
		background: none;
		color: var(--place-line);
		cursor: pointer;
		padding: 0;
		margin: 4px 0;
	}
	.occ-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		color: var(--ink-soft);
		border-top: 1px solid var(--panel-edge);
		padding-top: 6px;
		margin-top: 6px;
	}
	.occ-head button {
		border: 1px solid var(--panel-edge);
		background: var(--panel);
		border-radius: 3px;
		cursor: pointer;
		font-size: 13px;
	}
	.occ {
		list-style: none;
		padding: 0;
		margin: 4px 0 0;
		max-height: 260px;
		overflow-y: auto;
	}
	.occ button {
		border: none;
		background: none;
		text-align: left;
		padding: 3px 2px;
		cursor: pointer;
		font-size: 14.5px;
		color: var(--ink-note);
		width: 100%;
	}
	.occ b {
		color: var(--accent);
		font-weight: 600;
	}
	.occ li.cur button {
		background: var(--sel);
	}
	h3 {
		font-size: 14.5px;
		color: var(--ink-soft);
		font-weight: 400;
		margin: 10px 0 6px;
		letter-spacing: 0.2em;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.top {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.pic {
		margin: 0;
		flex-shrink: 0;
	}
	.pic img {
		display: block;
		width: 110px;
		height: 140px;
		object-fit: cover;
		object-position: top;
		border: 1px solid var(--panel-edge);
		border-radius: 3px;
		background: #efe4c8;
	}
	.who {
		flex: 1;
		min-width: 0;
	}
	.credit {
		font-size: 11.5px;
		color: var(--ink-soft);
		margin-top: 4px;
	}
	.credit a {
		color: inherit;
	}
	.av {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
		object-position: top;
		vertical-align: -5px;
		margin-right: 4px;
	}
	.chip {
		border: 1px solid var(--panel-edge);
		border-left: 3px solid var(--c);
		background: var(--paper);
		border-radius: 3px;
		padding: 2px 7px;
		cursor: pointer;
		font-size: 14.5px;
	}
	.chip.on {
		background: var(--accent-soft);
	}
	.chip small {
		color: var(--ink-soft);
		margin-left: 4px;
		font-size: 12px;
	}
</style>
