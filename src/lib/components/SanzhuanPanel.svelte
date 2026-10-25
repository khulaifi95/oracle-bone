<script lang="ts">
	// 三傳: each 經 entry of the year being read, with how the 左氏, 公羊 and 穀梁 take it.
	// The 公羊 and 穀梁 經 texts differ here and there from the 左氏 one; the differing words are marked.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import { loadSanzhuan } from '#lib/data.js';
	import type { SanzhuanEntry, ST } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const read = (x: ST) => (t ? x.t : x.s);

	let entries = $state<SanzhuanEntry[]>([]);
	$effect(() => {
		const id = reading.chapter?.id;
		if (!id || !reading.book?.jingzhuan) return;
		loadSanzhuan(id).then((d) => (entries = d.entries)).catch(() => (entries = []));
	});

	const ch = $derived(reading.chapter);
	const segById = $derived(new Map((ch?.segs ?? []).map((x) => [x.id, x])));
	/** first segment of each paragraph */
	const paraHead = $derived.by(() => {
		const m = new Map<number, string>();
		for (const x of ch?.segs ?? []) if (!m.has(x.para)) m.set(x.para, x.id);
		return m;
	});
	const cur = $derived(app.seg ? segById.get(app.seg) : (ch?.segs[0] ?? null));
	const year = $derived(cur?.y ?? entries[0]?.y ?? null);
	const yearEntries = $derived(entries.filter((e) => e.y === year));
	/** the entry the passage is on: the 經 itself, or the 傳 paragraph that tells it */
	const active = $derived.by(() => {
		if (!cur) return null;
		const head = paraHead.get(cur.para);
		return entries.find((e) => e.seg === head || e.seg === cur.id) ?? entries.find((e) => e.told === head) ?? null;
	});
	let open = $state<string | null>(null);
	$effect(() => {
		open = active?.seg ?? null;
	});
	const years = $derived([...new Set(entries.map((e) => e.y))]);
	const yearName = (y: number) => (reading.book ? reading.dateText(y, null, s.script).split(' · ')[0] : '');

	/** characters of `a` not found, in order, in `b` (a small LCS on bare characters) */
	function marks(a: string, b: string): boolean[] {
		const bare = (x: string) => [...x].filter((c) => !/[，。、；：？！「」『』\s]/.test(c));
		const A = [...a];
		const ai = A.map((c, i) => [c, i] as const).filter(([c]) => !/[，。、；：？！「」『』\s]/.test(c));
		const B = bare(b);
		const n = ai.length;
		const m = B.length;
		const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
		for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = ai[i][0] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
		const out = A.map(() => false);
		let i = 0;
		let j = 0;
		while (i < n) {
			if (j < m && ai[i][0] === B[j]) {
				i++;
				j++;
			} else if (j < m && L[i][j + 1] >= L[i + 1][j]) j++;
			else {
				out[ai[i][1]] = true;
				i++;
			}
		}
		return out;
	}
	function goTo(seg: string) {
		app.goto(seg);
	}
</script>

<div class="sz">
	{#if !entries.length}
		<p class="empty">{t ? '此篇無經文。' : '此篇无经文。'}</p>
	{:else}
		<nav class="years">
			{#each years as y (y)}
				<button class:on={y === year} onclick={() => goTo(entries.find((e) => e.y === y)!.seg)}>{yearName(y)}</button>
			{/each}
		</nav>
		<p class="lead">
			{t
				? '《春秋》經文有三家傳：左氏敘其事，公羊、穀梁釋其義例。三家所據經文小有不同，異字標紅。'
				: '《春秋》经文有三家传：左氏叙其事，公羊、穀梁释其义例。三家所据经文小有不同，异字标红。'}
		</p>
		<ol>
			{#each yearEntries as e (e.seg)}
				{@const isOpen = open === e.seg}
				<li class:on={active?.seg === e.seg} class:open={isOpen}>
					<button class="jing" onclick={() => ((open = isOpen ? null : e.seg), goTo(e.seg))}>
						<span class="mark">{t ? '經' : '经'}</span>{read(e.zuo)}
					</button>
					{#if isOpen}
						<div class="zhuan">
							<section class="zuo">
								<h4>{t ? '左氏' : '左氏'}</h4>
								{#if e.told}
									<button class="told" onclick={() => goTo(e.told!)}
										>{t ? '傳文見本卷' : '传文见本卷'}：{(t ? segById.get(e.told)?.j.t : segById.get(e.told)?.j.s)?.slice(0, 18)}……</button
									>
								{:else if e.noZhuan}
									<p class="none">{t ? '無傳（杜注）' : '无传（杜注）'}</p>
								{:else}
									<p class="none">{t ? '傳文與他事合敘' : '传文与他事合叙'}</p>
								{/if}
							</section>
							{#each [{ k: 'gong', s: '公羊', t: '公羊', x: e.gong }, { k: 'gu', s: '穀梁', t: '穀梁', x: e.gu }] as z (z.k)}
								<section class={z.k}>
									<h4>{t ? z.t : z.s}</h4>
									{#if z.x}
										{@const jt = read(z.x.jing)}
										{@const mk = marks(jt, read(e.zuo))}
										<p class="jt">{#each [...jt] as c, i (i)}{#if mk[i]}<b>{c}</b>{:else}{c}{/if}{/each}</p>
										{#if z.x.zhuan}<p class="zt">{read(z.x.zhuan)}</p>{:else}<p class="none">{t ? '無傳' : '无传'}</p>{/if}
									{:else}
										<p class="none">{t ? '經文與上條合為一條' : '经文与上条合为一条'}</p>
									{/if}
								</section>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.sz {
		height: 100%;
		overflow-y: auto;
		padding: 8px 10px 14px;
	}
	.years {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.years button {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		padding: 2px 8px;
		cursor: pointer;
		font-size: 13px;
	}
	.years button.on {
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 600;
	}
	.lead {
		font-size: 13px;
		color: var(--ink-soft);
		line-height: 1.6;
		margin: 4px 0 8px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 4px;
		margin-bottom: 6px;
	}
	li.on {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent-soft);
	}
	.jing {
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		background: none;
		cursor: pointer;
		padding: 7px 9px;
		font-family: var(--text-font);
		font-size: 16px;
		line-height: 1.6;
		color: var(--ink);
	}
	.mark {
		display: inline-block;
		background: var(--ink);
		color: var(--paper);
		font-size: 12px;
		padding: 0 4px;
		border-radius: 2px;
		margin-right: 6px;
		vertical-align: 2px;
	}
	.zhuan {
		border-top: 1px dotted var(--panel-edge);
		padding: 4px 9px 8px;
	}
	section {
		display: grid;
		grid-template-columns: 2.8em 1fr;
		column-gap: 6px;
		align-items: baseline;
		padding: 4px 0;
	}
	section + section {
		border-top: 1px dotted var(--panel-edge);
	}
	section > :not(h4) {
		grid-column: 2;
	}
	h4 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-note);
		letter-spacing: 0.1em;
		grid-row: span 2;
	}
	p {
		margin: 2px 0;
		font-family: var(--text-font);
		font-size: 15px;
		line-height: 1.75;
		color: var(--ink-note);
	}
	.jt {
		color: var(--ink-soft);
		font-size: 14px;
	}
	.jt b {
		color: var(--accent);
		font-weight: 600;
	}
	.zt {
		color: var(--ink);
	}
	.none {
		font-size: 13px;
		color: var(--ink-soft);
	}
	.told {
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		font-family: var(--text-font);
		font-size: 14.5px;
		color: var(--place-line);
		line-height: 1.6;
	}
	.told:hover {
		color: var(--accent);
	}
	.empty {
		color: var(--ink-soft);
		padding: 10px;
	}
</style>
