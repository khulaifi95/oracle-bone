<script lang="ts">
	// 對讀: the same event as told by 史記, 漢書 and 資治通鑑, set side by side in vertical
	// columns. Wording that differs from the 史記 account is marked.
	import { app, eraLabel, monthLabel, bceOf } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { loadChapter, loadPlain } from '#lib/data.js';
	import type { Account, Chapter, HistEvent, PlainChapter } from '#lib/types.js';
	import { diffArrays } from 'diff';

	let { wide = false }: { wide?: boolean } = $props();

	const s = app.settings;
	const t = $derived(s.script === 't');
	const ed = $derived(s.edition === 'j' ? 'j' : 'd');
	const PUNCT = /[，。、；：？！「」『』《》〈〉（）…—·]/;

	const picked = $derived(app.event ? (reading.events.find((e) => e.id === app.event) ?? null) : null);
	// the event of the current passage; between events, the one picked or the last one told
	const event = $derived<HistEvent | null>(reading.event ?? picked ?? reading.lastEvent);
	const between = $derived(!reading.event);

	interface Told {
		a: Account;
		book: string;
		title: string;
		paras: { text: string; mark: boolean[] }[];
		here: boolean;
		where: string;
		/** share of the wording found in the primary account */
		sim: number | null;
	}
	let told = $state<Told[]>([]);
	let loading = $state(false);

	const BOOK: Record<string, [string, string]> = { shiji: ['史记', '史記'], hanshu: ['汉书', '漢書'], tongjian: ['通鉴', '通鑑'] };

	function segText(ch: Chapter, from: string, to: string): string[] {
		const i = ch.segs.findIndex((x) => x.id === from);
		const j = ch.segs.findIndex((x) => x.id === to);
		const out: string[] = [];
		let para = -1;
		for (let k = i; k <= j && k >= 0; k++) {
			const seg = ch.segs[k];
			const st = seg[ed];
			const chars = [...(t ? st.t : st.s)];
			const after = new Map(st.p ?? []);
			const before = new Map(st.q ?? []);
			let str = '';
			chars.forEach((c, n) => {
				str += (before.get(n) ?? '') + c + (after.get(n) ?? '');
			});
			if (seg.para !== para) out.push('');
			para = seg.para;
			out[out.length - 1] += str;
		}
		return out;
	}

	async function build(e: HistEvent) {
		loading = true;
		const res: Told[] = [];
		for (const a of e.accounts) {
			const [book, juan] = a.ref.split('-');
			let texts: string[];
			let title: string;
			let heading = '';
			if (book === 'shiji') {
				const ch = await loadChapter(a.ref);
				texts = a.segs ? segText(ch, a.segs[0], a.segs[1]) : [];
				title = t ? ch.title.t : ch.title.s;
			} else {
				const ch: PlainChapter = await loadPlain(a.ref);
				texts = ch.paras.slice(a.paras[0], a.paras[1] + 1).map((p) => (t ? p.t : p.s));
				title = (t ? ch.title.t : ch.title.s) || `卷${juan}`;
				heading = ch.paras[a.paras[0]]?.h ?? '';
			}
			if (s.punct === 'none') texts = texts.map((x) => [...x].filter((c) => !PUNCT.test(c)).join(''));
			// 通鑑 headings are year lines such as 高帝元年（乙未，公元前二〇六年）: keep the reign year
			heading = heading.replace(/（.*$/, '');
			const [p0, p1] = a.paras;
			const where = `${heading ? heading + ' ' : ''}第${p0 + 1}${p1 > p0 ? '–' + (p1 + 1) : ''}段`;
			res.push({ a, book, title, paras: texts.map((text) => ({ text, mark: [] })), here: a.ref === reading.chapter?.id, where, sim: null });
		}
		// mark wording that differs from the primary 史記 account
		const primary = res.find((r) => r.here) ?? res.find((r) => r.book === 'shiji');
		if (primary) {
			const key = (r: Told) => {
				const chars: string[] = [];
				const at: [number, number][] = [];
				r.paras.forEach((p, pi) => [...p.text].forEach((c, ci) => !PUNCT.test(c) && (chars.push(c), at.push([pi, ci]))));
				return { chars, at };
			};
			const base = key(primary);
			for (const r of res) {
				r.paras.forEach((p) => (p.mark = [...p.text].map(() => false)));
				if (r === primary) continue;
				const k = key(r);
				let n = 0;
				let marked = 0;
				for (const part of diffArrays(base.chars, k.chars)) {
					if (part.removed) continue;
					if (part.added) {
						marked += part.count!;
						for (let q = 0; q < part.count!; q++) {
							const [pi, ci] = k.at[n + q];
							r.paras[pi].mark[ci] = true;
						}
					}
					n += part.count!;
				}
				r.sim = k.chars.length ? 1 - marked / k.chars.length : null;
			}
		}
		told = res;
		loading = false;
	}

	$effect(() => {
		const e = event;
		void s.script;
		void s.punct;
		void ed;
		if (e) build(e);
		else told = [];
	});

	function open(r: Told) {
		if (r.book !== 'shiji' || !r.a.segs) return;
		app.parallelWide = false;
		if (r.a.ref === reading.chapter?.id) app.goto(r.a.segs[0]);
		else reading.open(r.a.ref, r.a.segs[0]).then(() => app.goto(r.a.segs![0]));
	}
	const chapterEvents = $derived(reading.chapterEvents);
	const BOOKS = ['shiji', 'hanshu', 'tongjian'] as const;
	const chapterTitle = (ref: string) => {
		const [b] = ref.split('-');
		const c = reading.catalog?.books[b]?.chapters.find((x) => x.id === ref);
		return c ? (t ? c.t : c.title) : ref;
	};
	// which books tell this event, and where
	const coverage = $derived(
		event
			? BOOKS.map((b) => ({
					b,
					titles: [...new Set(event.accounts.filter((a) => a.ref.startsWith(b + '-')).map((a) => a.ref))].map(chapterTitle),
					absent: event.absent?.[b]
				}))
			: []
	);
	let how = $state(false);
	function pick(id: string) {
		const x = chapterEvents.find((c) => c.e.id === id);
		if (!x) return;
		app.event = id;
		const a = x.e.accounts.find((a) => a.ref === reading.chapter?.id && a.segs);
		if (a?.segs) app.goto(a.segs[0]);
	}
</script>

<div class="par" class:wide>
	<div class="head">
		<select value={event?.id ?? ''} onchange={(e) => pick((e.target as HTMLSelectElement).value)} aria-label="事件">
			{#if !event}<option value="">{t ? '— 本段無對應事件 —' : '— 本段无对应事件 —'}</option>{/if}
			{#each chapterEvents as { e } (e.id)}
				<option value={e.id}>{t ? e.t : e.title}</option>
			{/each}
		</select>
		{#if event}
			{#if between}<span class="when soft">{t ? '前事' : '前事'}</span>{/if}
			<span class="when">{eraLabel(event.ey)}{monthLabel(event.m)}{event.approx ? '前后' : ''} · 前{bceOf(event.ey, event.m)}</span>
		{/if}
		<button class="how-btn" class:open={how} onclick={() => (how = !how)} aria-label="对读如何系联">?</button>
		<button class="wide-btn" onclick={() => (app.parallelWide = !app.parallelWide)}>{wide ? (t ? '收起' : '收起') : t ? '展開' : '展开'}</button>
	</div>
	{#if how}
		<div class="how">
			{t
				? '每一事先由人工在《史記》《漢書》《資治通鑑》中各定一句起句（及止句），找到所在段落；再以本事的《史記》原文為準，凡前後段落與之四字連文相合達四分之一者併入，他處重述此事的段落也照此找出，標為「同文」。比照以當前所讀之篇為底本：標色之字是措辭不同處，百分數是該段文字見於底本的比例。'
				: '每一事先由人工在《史记》《汉书》《资治通鉴》中各定一句起句（及止句），找到所在段落；再以本事的《史记》原文为准，凡前后段落与之四字连文相合达四分之一者并入，他处重述此事的段落也照此找出，标为“同文”。比照以当前所读之篇为底本：标色之字是措辞不同处，百分数是该段文字见于底本的比例。'}
		</div>
	{/if}
	{#if event}
		<div class="cov">
			{#each coverage as c (c.b)}
				<span class="book" class:none={!c.titles.length} title={c.absent ?? ''}>
					<b>{BOOK[c.b][t ? 1 : 0]}</b>
					{#if c.titles.length}{c.titles.join('、')}{:else}{t ? '未載' : '未载'}{/if}
				</span>
			{/each}
		</div>
		<div class="accounts">
			{#each told as r (r.a.ref + ":" + r.a.paras[0])}
				<section class="acc" class:here={r.here}>
					<div class="label">
						<b>{BOOK[r.book][t ? 1 : 0]}</b>·{r.title}
						<span class="where">{r.where}</span>
						{#if r.a.auto}<span class="tag" title="按文字相合找到的段落">同文</span>{/if}
						{#if r.here}<span class="tag base">底本</span>{:else if r.sim !== null}<span class="sim" title={t ? '此段文字見於底本的比例' : '此段文字见于底本的比例'}>{Math.round(r.sim * 100)}%</span>{/if}
						{#if r.book === 'shiji' && !r.here}<button onclick={() => open(r)}>{t ? '往讀' : '往读'}</button>{/if}
					</div>
					<div class="vt">
						{#each r.paras as p, pi (pi)}
							<p>{#each [...p.text] as c, ci (ci)}{#if p.mark[ci]}<mark>{c}</mark>{:else}{c}{/if}{/each}</p>
						{/each}
					</div>
				</section>
			{/each}
			{#if loading && !told.length}<div class="msg">……</div>{/if}
		</div>
		{#each coverage.filter((c) => c.absent) as c (c.b)}
			<div class="foot">{BOOK[c.b][t ? 1 : 0]}{t ? '未載' : '未载'}：{c.absent}</div>
		{/each}
		<div class="foot">{t ? '標色之字為與底本措辭不同處' : '标色之字为与底本措辞不同处'}</div>
	{:else}
		<div class="msg">{t ? '移至敘事段落，或從上方選擇事件。' : '移至叙事段落，或从上方选择事件。'}</div>
	{/if}
</div>

<style>
	.par {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		flex-wrap: wrap;
	}
	.head select {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 3px;
		max-width: 220px;
	}
	.when {
		font-size: 13px;
		color: var(--accent);
	}
	.when.soft {
		color: var(--ink-soft);
	}
	.how-btn {
		margin-left: auto;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		cursor: pointer;
		font-size: 12px;
		padding: 0;
	}
	.how-btn.open {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff8ee;
	}
	.how {
		margin: 0 10px 8px;
		padding: 8px 10px;
		background: var(--paper);
		border-left: 3px solid var(--accent);
		font-size: 13.5px;
		line-height: 1.7;
		color: var(--ink-note);
	}
	.cov {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 10px 8px;
		font-size: 13px;
	}
	.cov .book {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 3px;
		padding: 1px 7px;
		color: var(--ink-note);
	}
	.cov .book b {
		color: var(--accent);
		margin-right: 3px;
	}
	.cov .book.none {
		opacity: 0.6;
		border-style: dashed;
	}
	.cov .book.none b {
		color: var(--ink-soft);
	}
	.where {
		color: var(--ink-soft);
		font-size: 12px;
	}
	.tag {
		font-size: 11.5px;
		padding: 0 5px;
		border-radius: 2px;
		background: var(--n-suoyin);
		color: #fff;
	}
	.tag.base {
		background: var(--accent);
	}
	.sim {
		font-size: 12px;
		color: var(--n-jijie);
	}
	.wide-btn {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		cursor: pointer;
		font-size: 13px;
	}
	.accounts {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.wide .accounts {
		flex-direction: row-reverse;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 10px;
	}
	.acc {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 4px;
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.wide .acc {
		flex: 1 0 300px;
		min-height: 0;
	}
	.acc.here {
		border-color: var(--accent);
	}
	.label {
		font-size: 13px;
		color: var(--ink-soft);
		margin-bottom: 4px;
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.label b {
		color: var(--ink);
	}
	.label button {
		margin-left: auto;
		border: none;
		background: none;
		color: var(--place-line);
		cursor: pointer;
		font-size: 13px;
	}
	.vt {
		writing-mode: vertical-rl;
		font-family: var(--text-font);
		height: 250px;
		overflow-x: auto;
		overflow-y: hidden;
		font-size: 16px;
		line-height: 1.85;
		letter-spacing: 0.06em;
		/* the box scrolls sideways; fade the column cut at its edge */
		mask-image: linear-gradient(to right, transparent, #000 28px);
	}
	.wide .vt {
		height: auto;
		flex: 1;
		min-height: 0;
		font-size: 19px;
	}
	.vt p {
		margin: 0 0 0 0.8em;
		text-indent: 2em;
	}
	mark {
		background: none;
		color: var(--accent);
		text-emphasis: dot var(--accent);
		text-emphasis-position: left;
		-webkit-text-emphasis: dot var(--accent);
		-webkit-text-emphasis-position: left;
	}
	.foot,
	.msg {
		font-size: 13px;
		color: var(--ink-soft);
		padding: 6px 10px;
	}
</style>
