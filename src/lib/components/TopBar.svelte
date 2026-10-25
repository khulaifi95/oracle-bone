<script lang="ts">
	import { app, NOTE_LABEL, NOTE_LABEL_T, NOTE_INFO } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { NoteKind } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const chapters = $derived(reading.catalog?.books.shiji.chapters ?? []);
	const NOTE_KINDS: NoteKind[] = ['jijie', 'suoyin', 'zhengyi', 'kaozheng', 'zan'];
	let help = $state(false);

	function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
		s[k] = v;
		app.save();
	}
	function toggleNote(k: NoteKind) {
		s.notes[k] = !s.notes[k];
		app.save();
	}
	const zh = (simp: string, trad: string) => (t ? trad : simp);
	const label = $derived(t ? NOTE_LABEL_T : NOTE_LABEL);
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

	<div class="field">
		<span class="cap">{zh('版本', '版本')}</span>
		<div class="group" role="group" aria-label="版本">
			<button class:on={s.edition === 'd'} onclick={() => set('edition', 'd')} title="清乾隆四年武英殿本（四库本）">殿本</button>
			<button class:on={s.edition === 'j'} onclick={() => set('edition', 'j')} title="清同治金陵书局本（点校本底本）">金陵本</button>
			<button class:on={s.edition === 'both'} onclick={() => set('edition', 'both')} title="两本对照">{zh('对照', '對照')}</button>
		</div>
	</div>

	<div class="field">
		<span class="cap">{zh('形制', '形制')}</span>
		<div class="group" role="group" aria-label="形制">
			<button class:on={s.form === 'scroll'} onclick={() => set('form', 'scroll')}>{zh('卷轴', '卷軸')}</button>
			<button class:on={s.form === 'book'} onclick={() => set('form', 'book')}>{zh('线装', '線裝')}</button>
		</div>
	</div>

	<div class="field">
		<span class="cap">{zh('字', '字')}</span>
		<div class="group" role="group" aria-label="字形">
			<button class:on={s.script === 's'} onclick={() => set('script', 's')}>简</button>
			<button class:on={s.script === 't'} onclick={() => set('script', 't')}>繁</button>
		</div>
		<div class="group" role="group" aria-label="字体">
			<button class:on={s.face === 'kai'} onclick={() => set('face', 'kai')} title="楷书（霞鹜文楷）">楷</button>
			<button class:on={s.face === 'song'} onclick={() => set('face', 'song')} title="宋体，近于刻本">宋</button>
		</div>
	</div>

	<div class="field">
		<span class="cap">{zh('标点', '標點')}</span>
		<div class="group" role="group" aria-label="标点">
			<button class:on={s.punct === 'none'} onclick={() => set('punct', 'none')} title="不加标点">白文</button>
			<button class:on={s.punct === 'judou'} onclick={() => set('punct', 'judou')} title="圈点句读">{zh('句读', '句讀')}</button>
			<button class:on={s.punct === 'full'} onclick={() => set('punct', 'full')} title="点校本新式标点">{zh('新式', '新式')}</button>
		</div>
	</div>

	<div class="field notes">
		<span class="cap">{zh('注', '注')}</span>
		<div class="group" role="group" aria-label="注">
			{#each NOTE_KINDS as k (k)}
				<button
					class="nk"
					class:on={s.notes[k]}
					style="--c:var(--n-{k})"
					disabled={k === 'kaozheng' && s.edition === 'j'}
					onclick={() => toggleNote(k)}
					title="{label[k]}：{NOTE_INFO[k].who}{t ? NOTE_INFO[k].t : NOTE_INFO[k].s}">{label[k]}</button
				>
			{/each}
		</div>
		<div class="group" role="group" aria-label="注的显示">
			<button class:on={s.notesMode === 'inline'} onclick={() => set('notesMode', 'inline')} title="以双行小注夹在正文中">{zh('夹注', '夾注')}</button>
			<button class:on={s.notesMode === 'mark'} onclick={() => set('notesMode', 'mark')} title="正文中只留色点，点击在左栏展开">{zh('点记', '點記')}</button>
		</div>
		<button class="help" class:open={help} onclick={() => (help = !help)} aria-label="注是什么">?</button>
		{#if help}
			<div class="pop" role="dialog">
				<p class="lead">
					{zh(
						'《史记》流传最广的是“三家注”本：南朝宋裴骃、唐司马贞、唐张守节三家的注，以双行小字夹在正文中。殿本另附清代馆臣的《考证》。各家颜色不同，可分别开关；“点记”只在正文留色点，读起来更清爽。',
						'《史記》流傳最廣的是「三家注」本：南朝宋裴駰、唐司馬貞、唐張守節三家的注，以雙行小字夾在正文中。殿本另附清代館臣的《考證》。各家顏色不同，可分別開關；「點記」只在正文留色點，讀起來更清爽。'
					)}
				</p>
				{#each NOTE_KINDS as k (k)}
					<div class="row">
						<span class="lab" style="background:var(--n-{k})">{label[k]}</span>
						<div><b>{NOTE_INFO[k].who}</b> {t ? NOTE_INFO[k].t : NOTE_INFO[k].s}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="field">
		<div class="group" role="group" aria-label="标记">
			<button class:on={s.names} onclick={() => set('names', !s.names)} title="人名直线，地名虚线">{zh('专名线', '專名線')}</button>
			<button class:on={s.variants} onclick={() => set('variants', !s.variants)} title="两本异文处加点">{zh('异文', '異文')}</button>
		</div>
		<div class="group" role="group" aria-label="字号">
			<button onclick={() => set('size', Math.max(16, s.size - 2))} disabled={s.form === 'book'} aria-label="缩小">A−</button>
			<button onclick={() => set('size', Math.min(48, s.size + 2))} disabled={s.form === 'book'} aria-label="放大">A+</button>
		</div>
	</div>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 14px;
		height: 52px;
		background: var(--chrome);
		color: var(--chrome-ink);
		border-bottom: 2px solid var(--accent);
		white-space: nowrap;
		position: relative;
		z-index: 10;
	}
	.brand {
		font-family: var(--font-brush);
		font-size: 26px;
		letter-spacing: 0.12em;
		color: var(--gold);
	}
	.brand span {
		font-family: var(--font);
		font-size: 13px;
		color: var(--chrome-soft);
		margin-left: 8px;
		letter-spacing: 0.1em;
	}
	.chapter {
		background: var(--chrome-2);
		color: var(--chrome-ink);
		border: 1px solid var(--chrome-edge);
		border-radius: 4px;
		padding: 5px 8px;
		font-size: 15px;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 6px;
		position: relative;
	}
	.cap {
		font-size: 12px;
		color: var(--chrome-soft);
		letter-spacing: 0.1em;
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
		padding: 5px 10px;
		cursor: pointer;
		font-size: 14px;
		color: var(--chrome-ink);
		border-left: 1px solid var(--chrome-edge);
	}
	.group button:first-child {
		border-left: none;
	}
	.group button:hover:not(:disabled) {
		background: var(--chrome-2);
	}
	.group button.on,
	.group button.on:hover {
		background: var(--accent);
		color: #fff8ee;
	}
	/* each commentary keeps its own colour: an underline when off, filled when on */
	.group button.nk {
		box-shadow: inset 0 -3px 0 var(--c);
	}
	.group button.nk.on,
	.group button.nk.on:hover {
		background: var(--c);
		box-shadow: none;
	}
	.group button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.help {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--chrome-soft);
		background: none;
		color: var(--chrome-ink);
		cursor: pointer;
		font-size: 13px;
		padding: 0;
	}
	.help.open {
		background: var(--gold);
		color: var(--chrome);
		border-color: var(--gold);
	}
	.pop {
		position: absolute;
		top: 44px;
		left: 0;
		width: 440px;
		white-space: normal;
		background: var(--panel);
		color: var(--ink);
		border: 1px solid var(--panel-edge);
		border-radius: 6px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		padding: 12px 14px;
		font-size: 14px;
		line-height: 1.7;
	}
	.pop .lead {
		margin: 0 0 8px;
		color: var(--ink-note);
	}
	.pop .row {
		display: flex;
		gap: 10px;
		align-items: baseline;
		padding: 4px 0;
		border-top: 1px dotted var(--panel-edge);
	}
	.pop .lab {
		flex-shrink: 0;
		color: #fff;
		font-size: 12px;
		padding: 1px 6px;
		border-radius: 2px;
	}
	@media (max-width: 1500px) {
		.cap {
			display: none;
		}
	}
	@media (max-width: 1280px) {
		.bar {
			overflow-x: auto;
		}
	}
</style>
