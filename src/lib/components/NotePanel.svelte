<script lang="ts">
	// 注: the commentary at a point in the text, in full, with the other edition's note there.
	import { app, NOTE_LABEL, NOTE_LABEL_T, NOTE_INFO } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { Ed, NoteKind } from '#lib/types.js';

	const KINDS: NoteKind[] = ['jijie', 'suoyin', 'zhengyi', 'kaozheng', 'zan'];
	const s = app.settings;
	const t = $derived(s.script === 't');
	const label = $derived(t ? NOTE_LABEL_T : NOTE_LABEL);
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
	const edName = (ed: Ed) => reading.catalog?.editions[ed].short ?? ed;
</script>

<div class="note">
	{#if sel && mine?.note}
		<div class="lemma">{#if lemma}「…{lemma}」{/if}<button onclick={() => app.goto(sel.seg)}>{t ? '回到正文' : '回到正文'}</button></div>
		<section>
			<h3>{edName(sel.ed)}</h3>
			{#each mine.note.parts as p, k (k)}
				<p><span class="lab" style="background:var(--n-{p.k})" title={NOTE_INFO[p.k].who}>{label[p.k]}</span>{t ? p.t : p.s}</p>
			{/each}
		</section>
		{#if other?.note && !sel.id.startsWith('k')}
			<section class="other">
				<h3>{edName(sel.ed === 'd' ? 'j' : 'd')}{t ? '此處' : '此处'}</h3>
				{#each other.note.parts as p, k (k)}
					<p><span class="lab" style="background:var(--n-{p.k})" title={NOTE_INFO[p.k].who}>{label[p.k]}</span>{t ? p.t : p.s}</p>
				{/each}
			</section>
		{/if}
	{:else}
		<div class="empty">
			<p>{t ? '點擊正文中的雙行小注，在此展開全文。' : '点击正文中的双行小注，在此展开全文。'}</p>
			{#each KINDS as k (k)}
				<p class="kind"><span class="lab" style="background:var(--n-{k})">{label[k]}</span><b>{NOTE_INFO[k].who}</b> {t ? NOTE_INFO[k].t : NOTE_INFO[k].s}</p>
			{/each}
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
	.empty p {
		font-size: 14.5px;
		color: var(--ink-soft);
	}
</style>
