<script lang="ts">
	import { app, NOTE_LABEL, NOTE_LABEL_T } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { NoteKind } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const chapters = $derived(reading.catalog?.books.shiji.chapters ?? []);
	const NOTE_KINDS: NoteKind[] = ['jijie', 'suoyin', 'zhengyi', 'kaozheng', 'zan'];

	function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
		s[k] = v;
		app.save();
	}
	function toggleNote(k: NoteKind) {
		s.notes[k] = !s.notes[k];
		app.save();
	}
	const zh = (simp: string, trad: string) => (t ? trad : simp);
</script>

<header class="bar">
	<div class="brand" title="史读">{zh('史读', '史讀')}<span>{zh('秦汉之际', '秦漢之際')}</span></div>

	<select
		class="chapter"
		value={reading.chapter?.id ?? s.chapter}
		onchange={(e) => reading.open((e.target as HTMLSelectElement).value)}
		aria-label="篇章"
	>
		{#each chapters as c (c.id)}
			<option value={c.id}>{zh('史记', '史記')}{c.juanZh} {t ? c.t : c.title}</option>
		{/each}
	</select>

	<div class="group" role="group" aria-label="版本">
		<button class:on={s.edition === 'd'} onclick={() => set('edition', 'd')} title="清乾隆四年武英殿本（四库本）">殿本</button>
		<button class:on={s.edition === 'j'} onclick={() => set('edition', 'j')} title="清同治金陵书局本（点校本底本）">{zh('金陵本', '金陵本')}</button>
		<button class:on={s.edition === 'both'} onclick={() => set('edition', 'both')} title="两本对照">{zh('对照', '對照')}</button>
	</div>

	<div class="group" role="group" aria-label="形制">
		<button class:on={s.form === 'scroll'} onclick={() => set('form', 'scroll')}>{zh('卷轴', '卷軸')}</button>
		<button class:on={s.form === 'book'} onclick={() => set('form', 'book')}>{zh('线装', '線裝')}</button>
	</div>

	<div class="group" role="group" aria-label="字形">
		<button class:on={s.script === 's'} onclick={() => set('script', 's')}>简</button>
		<button class:on={s.script === 't'} onclick={() => set('script', 't')}>繁</button>
	</div>

	<div class="group" role="group" aria-label="标点">
		<button class:on={s.punct === 'none'} onclick={() => set('punct', 'none')} title="不加标点">白文</button>
		<button class:on={s.punct === 'judou'} onclick={() => set('punct', 'judou')} title="圈点句读">{zh('句读', '句讀')}</button>
		<button class:on={s.punct === 'full'} onclick={() => set('punct', 'full')} title="点校本新式标点">{zh('标点', '標點')}</button>
	</div>

	<div class="group notes" role="group" aria-label="注">
		{#each NOTE_KINDS as k (k)}
			<button
				class:on={s.notes[k]}
				disabled={k === 'kaozheng' && s.edition === 'j'}
				onclick={() => toggleNote(k)}
				title={k === 'kaozheng' ? '殿本卷末考证，移至所考之处' : k === 'zan' ? '索隐述赞（卷末）' : undefined}
				>{(t ? NOTE_LABEL_T : NOTE_LABEL)[k]}</button
			>
		{/each}
	</div>

	<div class="group" role="group" aria-label="标记">
		<button class:on={s.names} onclick={() => set('names', !s.names)} title="人名直线，地名虚线">{zh('专名线', '專名線')}</button>
		<button class:on={s.variants} onclick={() => set('variants', !s.variants)} title="两本异文处加点">{zh('异文', '異文')}</button>
	</div>

	<div class="group" role="group" aria-label="字号">
		<button onclick={() => set('size', Math.max(16, s.size - 2))} disabled={s.form === 'book'} aria-label="缩小">A−</button>
		<button onclick={() => set('size', Math.min(44, s.size + 2))} disabled={s.form === 'book'} aria-label="放大">A+</button>
	</div>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		height: 46px;
		background: var(--chrome);
		border-bottom: 1px solid var(--chrome-edge);
		overflow-x: auto;
		scrollbar-width: none;
		white-space: nowrap;
	}
	.brand {
		font-weight: 600;
		font-size: 18px;
		letter-spacing: 0.15em;
		color: var(--accent);
		margin-right: 4px;
	}
	.brand span {
		font-size: 12px;
		font-weight: 400;
		color: var(--ink-soft);
		margin-left: 8px;
		letter-spacing: 0.1em;
	}
	.chapter {
		background: var(--paper);
		border: 1px solid var(--chrome-edge);
		border-radius: 4px;
		padding: 4px 6px;
		font-size: 14px;
	}
	.group {
		display: inline-flex;
		border: 1px solid var(--chrome-edge);
		border-radius: 4px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.group button {
		border: none;
		background: transparent;
		padding: 4px 9px;
		cursor: pointer;
		font-size: 13px;
		border-left: 1px solid var(--chrome-edge);
	}
	.group button:first-child {
		border-left: none;
	}
	.group button:hover:not(:disabled) {
		background: var(--accent-soft);
	}
	.group button.on,
	.group button.on:hover {
		background: var(--accent);
		color: #fff8ee;
	}
	.group button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
