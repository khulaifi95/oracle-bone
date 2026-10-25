<script lang="ts">
	// 人物: who is on stage around the current passage, and a card for the selected person
	// (名、字、封號官稱 as of the current year, 歲數, and where the chapter mentions them).
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { ageAt, eraLabel, julianYear, yearShort } from '#lib/dates.js';
	import { occurrences } from '#lib/find.js';
	import type { Person, RelKind } from '#lib/types.js';
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

	// 人物關係: what each other person was to this one, phase by phase. The phase of the year being
	// read is marked, and a relation is filed under the kind it has then (英布 moves from 君臣 to
	// 敵對 as the reading passes 前204).
	const KINDS: RelKind[] = ['kin', 'lord', 'ally', 'foe', 'other'];
	const KIND_LABEL: Record<RelKind, [string, string]> = {
		kin: ['亲族', '親族'],
		lord: ['君臣主从', '君臣主從'],
		ally: ['交游同盟', '交遊同盟'],
		foe: ['敌对', '敵對'],
		other: ['其他', '其他']
	};
	let allRels = $state(false);
	const onStage = $derived(new Set([...Object.keys(reading.chapter?.mentions ?? {}), ...reading.nearby.people.keys()]));
	const within = (f: number | null, to: number | null, y: number) => (f == null || f <= y) && (to == null || y <= to);
	const rels = $derived.by(() => {
		const list = (person?.rel ?? [])
			.map((r) => {
				const other = reading.personById.get(r.id);
				if (!other) return null;
				let cur = year == null ? -1 : r.p.findIndex(([f, to]) => within(f, to, year));
				let when: 'now' | 'past' | 'later' = 'now';
				if (year != null && cur < 0) {
					const before = r.p.map(([f], i) => [f, i] as const).filter(([f]) => f == null || f <= year);
					if (before.length) (cur = before[before.length - 1][1]), (when = 'past');
					else (cur = 0), (when = 'later');
				}
				return { r, other, cur, when, kind: r.p[Math.max(0, cur)][2], here: onStage.has(r.id) };
			})
			.filter((x) => x != null);
		const shown = allRels || !list.some((x) => x.here) ? list : list.filter((x) => x.here);
		const rank = { now: 0, past: 1, later: 2 };
		return {
			total: list.length,
			here: list.filter((x) => x.here).length,
			groups: KINDS.map((k) => ({ k, items: shown.filter((x) => x.kind === k).sort((a, b) => rank[a.when] - rank[b.when] || Number(b.here) - Number(a.here)) })).filter((g) => g.items.length)
		};
	});
	const span = (f: number | null, to: number | null) =>
		f == null && to == null ? '' : f === to ? yearShort(f!) : `${f == null ? '' : yearShort(f)}–${to == null ? '' : yearShort(to)}`;

	// 本篇同見: who shares the most passages with this person in the chapter
	const together = $derived.by(() => {
		if (!person || !reading.chapter) return [];
		const n = new Map<string, number>();
		for (const id of occ) {
			const seen = new Set(segById.get(id)?.[ed].g?.map((g) => g[3]) ?? []);
			for (const o of seen) if (o && o !== person.id) n.set(o, (n.get(o) ?? 0) + 1);
		}
		return [...n.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([id, k]) => ({ p: reading.personById.get(id), k }))
			.filter((x): x is { p: Person; k: number } => !!x.p);
	});
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
			{#if rels.total}
				<div class="occ-head">
					<span>{t ? '人物關係' : '人物关系'}</span>
					{#if rels.here && rels.here < rels.total}
						<button onclick={() => (allRels = !allRels)}>{allRels ? (t ? `只看本篇 ${rels.here}` : `只看本篇 ${rels.here}`) : t ? `全部 ${rels.total}` : `全部 ${rels.total}`}</button>
					{/if}
				</div>
				{#each rels.groups as g (g.k)}
					<div class="rel-kind" style="--k:var(--rel-{g.k})">{KIND_LABEL[g.k][t ? 1 : 0]}</div>
					<ul class="rels">
						{#each g.items as { r, other, cur, when } (r.id)}
							<li class={when} style="--k:var(--rel-{g.k})">
								<div class="rel-line">
									<button class="rn" style="--c:var(--{other.side})" onclick={() => (app.person = other.id)}>{nm(other)}</button>
									<span class="ph">
										{#each r.p as ph, i (i)}{#if i}<span class="arrow">→</span>{/if}<span class="lab" class:cur={i === cur} style="--k:var(--rel-{ph[2]})">{t ? ph[4] : ph[3]}</span>{/each}
									</span>
									{#if span(r.p[cur][0], r.p[cur][1])}<small>{span(r.p[cur][0], r.p[cur][1])}{when === 'later' ? (t ? ' 後事' : ' 后事') : ''}</small>{/if}
								</div>
								{#if r.note}<div class="rel-note">{t ? r.noteT : r.note}</div>{/if}
							</li>
						{/each}
					</ul>
				{/each}
			{/if}
			{#if together.length}
				<div class="occ-head"><span>{t ? '本篇常與之同見' : '本篇常与之同见'}</span></div>
				<div class="chips together">
					{#each together as { p, k } (p.id)}
						<button class="chip" style="--c:var(--{p.side})" onclick={() => (app.person = p.id)}>{nm(p)}<small>{k}</small></button>
					{/each}
				</div>
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
	.people {
		--rel-kin: #9a6b2f;
		--rel-lord: #4b5d7a;
		--rel-ally: #4f7f52;
		--rel-foe: #b23b32;
		--rel-other: #8a8070;
	}
	.rel-kind {
		font-size: 12.5px;
		color: var(--k);
		letter-spacing: 0.2em;
		margin: 8px 0 2px;
	}
	.rels {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.rels li {
		border-left: 2px solid var(--k);
		padding: 3px 0 3px 8px;
		margin: 3px 0;
	}
	.rels li.past,
	.rels li.later {
		opacity: 0.62;
		border-left-style: dashed;
	}
	.rel-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
	}
	.rn {
		border: none;
		border-bottom: 2px solid var(--c);
		background: none;
		padding: 0 1px;
		font-size: 15px;
		cursor: pointer;
		color: var(--ink);
	}
	.rn:hover {
		color: var(--accent);
	}
	.ph {
		font-size: 14px;
		color: var(--ink-soft);
	}
	.ph .lab.cur {
		color: var(--k);
		font-weight: 700;
	}
	.arrow {
		margin: 0 3px;
		color: var(--ink-soft);
	}
	.rel-line small {
		font-size: 12px;
		color: var(--ink-soft);
		margin-left: auto;
	}
	.rel-note {
		font-size: 13px;
		line-height: 1.6;
		color: var(--ink-note);
		margin-top: 1px;
	}
	.together {
		margin: 4px 0 2px;
	}
	.chip small {
		color: var(--ink-soft);
		margin-left: 4px;
		font-size: 12px;
	}
</style>
