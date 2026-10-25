<script lang="ts">
	// 校勘: where the two editions read differently, by kind.
	import { app, VARIANT_LABEL } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { Variant } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	type Kind = Variant['kind'];
	const KINDS: Kind[] = ['text', 'graphic', 'taboo', 'form'];
	let show = $state<Record<Kind, boolean>>({ text: true, graphic: true, taboo: true, form: false });

	const variants = $derived(reading.chapter?.variants ?? []);
	const counts = $derived(Object.fromEntries(KINDS.map((k) => [k, variants.filter((v) => v.kind === k).length])) as Record<Kind, number>);
	const list = $derived(variants.filter((v) => show[v.kind]));
	const segById = $derived(new Map((reading.chapter?.segs ?? []).map((x) => [x.id, x])));
	const stats = $derived(reading.chapter?.stats as { restored?: number; kaozheng?: number; aligned?: number; chars?: { d: number; j: number } } | undefined);

	let listEl: HTMLUListElement;
	$effect(() => {
		const id = app.variant;
		if (!id || !listEl) return;
		const v = variants.find((x) => x.id === id);
		if (v && !show[v.kind]) show[v.kind] = true;
		requestAnimationFrame(() => listEl.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }));
	});

	function context(v: Variant) {
		const seg = segById.get(v.seg);
		if (!seg) return { before: '', after: '' };
		const st = seg.d;
		const str = t ? st.t : st.s;
		const m = st.v?.find((x) => x[2] === v.id);
		if (!m) return { before: str.slice(0, 8), after: '' };
		return { before: str.slice(Math.max(0, m[0] - 7), m[0]), after: str.slice(m[0] + m[1], m[0] + m[1] + 7) };
	}
	function pick(v: Variant) {
		app.variant = v.id;
		app.goto(v.seg);
	}
	const read = (x: { s: string; t: string }) => t ? x.t : x.s;
	const eds = $derived(reading.book?.editions);
	const jName = $derived(eds ? eds.j.short : '');
</script>

<div class="var">
	<div class="filters">
		{#each KINDS as k (k)}
			<button class:on={show[k]} class={k} onclick={() => (show[k] = !show[k])}>{VARIANT_LABEL[k]} <small>{counts[k]}</small></button>
		{/each}
	</div>
	{#if stats?.chars}
		<div class="stats">
			{eds?.d.short} {stats.chars.d} {t ? '字' : '字'}，{jName} {stats.chars.j} {t ? '字' : '字'}；{t ? `${eds?.d.short}錄文缺字據${jName}補` : `${eds?.d.short}录文缺字据${jName}补`} {stats.restored ?? 0}{#if stats.kaozheng}，{t ? '考證' : '考证'} {stats.kaozheng} {t ? '條' : '条'}{/if}。
		</div>
	{/if}
	<ul bind:this={listEl}>
		{#each list as v (v.id)}
			{@const c = context(v)}
			<li class:sel={v.id === app.variant} data-id={v.id}>
				<button onclick={() => pick(v)}>
					<span class="kind {v.kind}">{VARIANT_LABEL[v.kind]}</span>
					<span class="ctx">{c.before}<b class="d">{read(v.d) || '‸'}</b>{c.after}</span>
					<span class="pair"
						><em>{eds?.d.short.slice(0, 1)}</em>{#if read(v.d)}<b>{read(v.d)}</b>{:else}<i class="none">{t ? '無' : '无'}</i>{/if}<em>{jName.slice(0, 1)}</em>{#if read(v.j)}<b
								>{read(v.j)}</b
							>{:else}<i class="none">{t ? '無' : '无'}</i>{/if}</span
					>
				</button>
			</li>
		{:else}
			<li class="empty">—</li>
		{/each}
	</ul>
	<div class="foot">
		{t ? '異文：用字不同；形近：形近而訛；避諱：清諱改字；異體：同字異寫。' : '异文：用字不同；形近：形近而讹；避讳：清讳改字；异体：同字异写。'}
	</div>
</div>

<style>
	.var {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.filters {
		display: flex;
		gap: 5px;
		padding: 8px 10px 4px;
	}
	.filters button {
		border: 1px solid var(--panel-edge);
		background: var(--paper);
		border-radius: 3px;
		padding: 2px 8px;
		cursor: pointer;
		font-size: 13px;
		opacity: 0.55;
	}
	.filters button.on {
		opacity: 1;
		border-color: var(--var-dot);
	}
	small {
		color: var(--ink-soft);
	}
	.stats {
		font-size: 13px;
		color: var(--ink-soft);
		padding: 2px 10px 6px;
		line-height: 1.6;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0 6px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}
	li button {
		display: grid;
		grid-template-columns: 2.6em 1fr auto;
		gap: 6px;
		align-items: baseline;
		width: 100%;
		border: none;
		background: none;
		text-align: left;
		padding: 4px;
		cursor: pointer;
		border-bottom: 1px dotted var(--panel-edge);
	}
	li.sel button {
		background: var(--var-sel);
	}
	.kind {
		font-size: 12px;
		color: var(--var-dot);
	}
	.kind.taboo {
		color: var(--accent);
	}
	.kind.form {
		color: var(--ink-soft);
	}
	.ctx {
		color: var(--ink-note);
		font-size: 14.5px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.ctx b {
		color: var(--ink);
	}
	.pair {
		font-size: 15px;
	}
	.pair b {
		font-weight: 400;
		color: var(--ink);
	}
	.none {
		font-style: normal;
		font-size: 12px;
		color: var(--ink-soft);
		border: 1px solid var(--panel-edge);
		border-radius: 2px;
		padding: 0 3px;
	}
	.pair em {
		font-style: normal;
		font-size: 10px;
		color: var(--ink-soft);
		margin: 0 2px 0 6px;
	}
	.empty {
		color: var(--ink-soft);
		padding: 10px;
	}
	.foot {
		font-size: 12px;
		color: var(--ink-soft);
		padding: 6px 10px;
		line-height: 1.6;
	}
</style>
