<script lang="ts">
	// 注: the commentary at a point in the text, in full, with the other edition's note there.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { Ed, NotePart } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const defs = $derived(reading.book?.notes ?? []);
	const label = (k: string) => reading.noteLabel(k, s.script);
	const who = (k: string) => reading.noteDefs.get(k)?.who ?? '';
	const srcOf = (p: NotePart) => (p.src ? (t ? p.src : (p.srcS ?? p.src)) : '');
	const sel = $derived(app.note);
	const ch = $derived(reading.chapter);
	const seg = $derived(sel && ch ? ch.segs.find((x) => x.id === sel.seg) : null);

	function noteAt(ed: Ed) {
		if (!sel || !seg || !ch) return null;
		if (ed === sel.ed) return { id: sel.id, note: ch.notes[ed][sel.id], at: seg[ed].n?.find((n) => n[1] === sel.id)?.[0] ?? -1 };
		// the other edition: the note nearest the same point of the same sentence
		const here = seg[sel.ed].n?.find((n) => n[1] === sel.id)?.[0] ?? 0;
		const cands = (seg[ed].n ?? []).filter((n) => !n[1].startsWith('k'));
		if (!cands.length) return null;
		const best = cands.reduce((a, b) => (Math.abs(b[0] - here) < Math.abs(a[0] - here) ? b : a));
		return { id: best[1], note: ch.notes[ed][best[1]], at: best[0] };
	}
	const mine = $derived(noteAt(sel?.ed ?? 'd'));
	const other = $derived(sel ? noteAt(sel.ed === 'd' ? 'j' : 'd') : null);
	const lemma = $derived.by(() => {
		if (!seg || !sel || !mine) return '';
		const st = seg[sel.ed];
		const str = t ? st.t : st.s;
		return mine.at < 0 ? '' : str.slice(Math.max(0, mine.at - 11), mine.at + 1);
	});
	const edName = (ed: Ed) => reading.book?.editions[ed].short ?? ed;

	// 裴注 by source: which books this chapter's notes quote, how often, and where
	const ed0 = $derived<Ed>(s.edition === 'j' ? 'j' : 'd');
	const sources = $derived.by(() => {
		const ch = reading.chapter;
		const out = new Map<string, { name: string; n: number; at: { note: string; seg: string; text: string }[] }>();
		if (!ch) return [];
		for (const seg of ch.segs)
			for (const [, id] of seg[ed0].n ?? [])
				for (const p of ch.notes[ed0][id]?.parts ?? []) {
					if (!p.src) continue;
					const name = srcOf(p);
					const x = out.get(name) ?? { name, n: 0, at: [] };
					x.n++;
					x.at.push({ note: id, seg: seg.id, text: (t ? p.t : p.s).slice(0, 40) });
					out.set(name, x);
				}
		return [...out.values()].sort((a, b) => b.n - a.n);
	});
	let source = $state<string | null>(null);
	const picked = $derived(sources.find((x) => x.name === source) ?? null);
	function openNote(a: { note: string; seg: string }) {
		app.note = { ed: ed0, id: a.note, seg: a.seg };
		app.goto(a.seg);
	}
</script>

<div class="note">
	{#if sel && mine?.note}
		<div class="lemma">{#if lemma}「…{lemma}」{/if}<button onclick={() => app.goto(sel.seg)}>{t ? '回到正文' : '回到正文'}</button></div>
		<section>
			<h3>{edName(sel.ed)}</h3>
			{#each mine.note.parts as p, k (k)}
				<p><span class="lab" style="background:var(--n-{p.k})" title={who(p.k)}>{label(p.k)}</span>{#if p.src}<button class="src" onclick={() => ((source = srcOf(p)), (app.note = null))}>{srcOf(p)}</button>{/if}{t ? p.t : p.s}</p>
			{/each}
		</section>
		{#if other?.note && !sel.id.startsWith('k')}
			<section class="other">
				<h3>{edName(sel.ed === 'd' ? 'j' : 'd')}{t ? '此處' : '此处'}</h3>
				{#each other.note.parts as p, k (k)}
					<p><span class="lab" style="background:var(--n-{p.k})" title={who(p.k)}>{label(p.k)}</span>{#if p.src}<button class="src" onclick={() => ((source = srcOf(p)), (app.note = null))}>{srcOf(p)}</button>{/if}{t ? p.t : p.s}</p>
				{/each}
			</section>
		{/if}
	{:else}
		<div class="empty">
			<p>{t ? '點擊正文中的雙行小注，在此展開全文。' : '点击正文中的双行小注，在此展开全文。'}</p>
			{#each defs as n (n.k)}
				<p class="kind"><span class="lab" style="background:var(--n-{n.k})">{t ? n.t : n.s}</span><b>{n.who}</b> {t ? n.info.t : n.info.s}</p>
			{/each}
			{#if sources.length}
				<h4>{t ? '本篇裴注所引' : '本篇裴注所引'}<small>{t ? '點書名看各條' : '点书名看各条'}</small></h4>
				<div class="sources">
					{#each sources as x (x.name)}
						<button class:on={x.name === source} onclick={() => (source = source === x.name ? null : x.name)}>{x.name}<i>{x.n}</i></button>
					{/each}
				</div>
				{#if picked}
					<ol class="quotes">
						{#each picked.at as a, k (k)}
							<li><button onclick={() => openNote(a)}>{a.text}……</button></li>
						{/each}
					</ol>
				{/if}
			{/if}
			<p>{t ? '上方「注」一欄可分別開關各家；選「點記」則正文只留色點，讀來清爽。' : '上方“注”一栏可分别开关各家；选“点记”则正文只留色点，读来清爽。'}</p>
		</div>
	{/if}
</div>

<style>
	.note {
		padding: 10px;
		overflow-y: auto;
		height: 100%;
	}
	.lemma {
		font-size: 15px;
		margin-bottom: 8px;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.lemma button {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		cursor: pointer;
		font-size: 13px;
		flex-shrink: 0;
	}
	section {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 4px;
		padding: 8px 10px;
		margin-bottom: 10px;
	}
	section.other {
		opacity: 0.85;
	}
	h3 {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--ink-soft);
		font-weight: 400;
		letter-spacing: 0.2em;
	}
	p {
		margin: 6px 0;
		line-height: 1.8;
		font-size: 15px;
		color: var(--ink-note);
	}
	.lab {
		display: inline-block;
		background: var(--ink-note);
		color: var(--paper);
		font-size: 12px;
		padding: 0 4px;
		margin-right: 6px;
		border-radius: 2px;
		vertical-align: 1px;
	}
	p {
		font-family: var(--text-font);
	}
	.kind b {
		color: var(--ink);
		font-weight: 600;
	}
	.src {
		display: inline-block;
		border: 1px solid var(--n-pei, var(--ink-note));
		color: var(--n-pei, var(--ink-note));
		background: none;
		font-size: 12px;
		padding: 0 4px;
		margin-right: 6px;
		border-radius: 2px;
		vertical-align: 1px;
		cursor: pointer;
		font-family: var(--font);
	}
	h4 {
		margin: 14px 0 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
		letter-spacing: 0.1em;
	}
	h4 small {
		font-weight: 400;
		color: var(--ink-soft);
		margin-left: 8px;
		font-size: 12px;
	}
	.sources {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.sources button {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		padding: 2px 7px;
		cursor: pointer;
		font-size: 13.5px;
	}
	.sources button.on {
		border-color: var(--accent);
		color: var(--accent);
	}
	.sources i {
		font-style: normal;
		font-size: 11px;
		color: var(--ink-soft);
		margin-left: 4px;
	}
	.quotes {
		margin: 8px 0;
		padding-left: 22px;
	}
	.quotes li {
		margin: 3px 0;
		color: var(--ink-soft);
	}
	.quotes button {
		border: none;
		background: none;
		text-align: left;
		padding: 0;
		cursor: pointer;
		font-family: var(--text-font);
		font-size: 14px;
		color: var(--ink-note);
		line-height: 1.6;
	}
	.quotes button:hover {
		color: var(--accent);
	}
	.empty p {
		font-size: 14.5px;
		color: var(--ink-soft);
	}
</style>
