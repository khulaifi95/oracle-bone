<script lang="ts">
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';
	import type { NoteKind } from '#lib/types.js';

	const s = app.settings;
	const t = $derived(s.script === 't');
	const book = $derived(reading.book);
	const chapters = $derived(book?.chapters ?? []);
	const notes = $derived(book?.notes ?? []);
	const shelf = $derived(Object.values(reading.catalog?.books ?? {}));
	let help = $state(false);
	let shelfOpen = $state(false);

	function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
		s[k] = v;
		app.save();
	}
	function toggleNote(k: NoteKind) {
		s.notes[k] = !s.notes[k];
		app.save();
	}
	function openBook(id: string) {
		shelfOpen = false;
		const b = reading.catalog?.books[id];
		if (!b || id === reading.bookId) return;
		const last = s.chapters[id];
		reading.open(last && b.chapters.some((c) => c.id === last) ? last : b.chapters[0].id);
	}
	const zh = (simp: string, trad: string) => (t ? trad : simp);
</script>

<svelte:window
	onclick={(e) => {
		if (shelfOpen && !(e.target as HTMLElement).closest('.shelf-wrap')) shelfOpen = false;
	}}
	onkeydown={(e) => e.key === 'Escape' && (shelfOpen = false)}
/>

<header class="bar">
	<div class="shelf-wrap">
		<button class="brand" class:open={shelfOpen} onclick={() => (shelfOpen = !shelfOpen)} title={zh('书架：换一部书', '書架：換一部書')}
			>{zh('史读', '史讀')}<span>{book ? `${t ? book.t : book.title} · ${t ? book.cluster.t : book.cluster.s}` : ''}</span><i>▾</i></button
		>
		{#if shelfOpen}
			<div class="shelf" role="dialog" aria-label={zh('书架', '書架')}>
				{#each shelf as b (b.id)}
					<button class="tao" class:on={b.id === reading.bookId} onclick={() => openBook(b.id)}>
						<span class="qian">{t ? b.t : b.title}</span>
						<span class="what">{t ? b.cluster.t : b.cluster.s}</span>
						<span class="count">{b.chapters.length}{zh('篇', '篇')}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<select
		class="chapter"
		value={reading.chapter?.id ?? s.chapter}
		onchange={(e) => reading.open((e.target as HTMLSelectElement).value)}
		aria-label="篇章"
	>
		{#each chapters as c (c.id)}
			<option value={c.id}>{c.juanZh} {t ? c.t : c.title}</option>
		{/each}
	</select>

	{#if book}
		<div class="field">
			<span class="cap">{zh('版本', '版本')}</span>
			<div class="group" role="group" aria-label="版本">
				<button class:on={s.edition === 'd'} onclick={() => set('edition', 'd')} title={book.editions.d.full}>{book.editions.d.short}</button>
				<button class:on={s.edition === 'j'} onclick={() => set('edition', 'j')} title={book.editions.j.full}>{book.editions.j.short}</button>
				<button class:on={s.edition === 'both'} onclick={() => set('edition', 'both')} title={zh('两本对照', '兩本對照')}>{zh('对照', '對照')}</button>
			</div>
		</div>
	{/if}

	{#if book?.jingzhuan}
		<div class="field">
			<div class="group" role="group" aria-label="经传">
				<button class:on={s.jz === 'all'} onclick={() => set('jz', 'all')} title={zh('经与传合读', '經與傳合讀')}>{zh('经传', '經傳')}</button>
				<button class:on={s.jz === 'jing'} onclick={() => set('jz', 'jing')} title={zh('只读春秋经文', '只讀春秋經文')}>{zh('经', '經')}</button>
				<button class:on={s.jz === 'zhuan'} onclick={() => set('jz', 'zhuan')} title={zh('只读左氏传文', '只讀左氏傳文')}>{zh('传', '傳')}</button>
			</div>
		</div>
	{/if}

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
			{#each notes as n (n.k)}
				<button
					class="nk"
					class:on={s.notes[n.k]}
					style="--c:var(--n-{n.k})"
					disabled={!!n.only && s.edition !== 'both' && s.edition !== n.only}
					onclick={() => toggleNote(n.k)}
					title="{t ? n.t : n.s}：{n.who}{t ? n.info.t : n.info.s}">{t ? n.t : n.s}</button
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
				<p class="lead">{book ? (t ? book.notesLead.t : book.notesLead.s) : ''}</p>
				{#each notes as n (n.k)}
					<div class="row">
						<span class="lab" style="background:var(--n-{n.k})">{t ? n.t : n.s}</span>
						<div><b>{n.who}</b> {t ? n.info.t : n.info.s}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="field">
		<div class="group" role="group" aria-label="标记">
			<button class:on={s.names} onclick={() => set('names', !s.names)} title="人名直线，地名虚线">{zh('专名线', '專名線')}</button>
			<button class:on={s.variants} onclick={() => set('variants', !s.variants)} title={zh('两本异文处加标记', '兩本異文處加標記')}>{zh('异文', '異文')}</button>
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
		/* on a narrow window the controls scroll rather than push the page wider */
		overflow-x: auto;
		scrollbar-width: none;
	}
	.shelf-wrap {
		position: relative;
	}
	.brand {
		font-family: var(--font-brush);
		font-size: 26px;
		letter-spacing: 0.12em;
		color: var(--gold);
		background: none;
		border: none;
		padding: 2px 6px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: baseline;
	}
	.brand:hover,
	.brand.open {
		background: var(--chrome-2);
	}
	.brand span {
		font-family: var(--font);
		font-size: 13px;
		color: var(--chrome-soft);
		margin-left: 8px;
		letter-spacing: 0.1em;
	}
	.brand i {
		font-style: normal;
		font-family: var(--font);
		font-size: 11px;
		color: var(--chrome-soft);
		margin-left: 4px;
	}
	/* 書架: each book as a 函 (case) with its 題簽 pasted on */
	.shelf {
		position: fixed;
		top: 52px;
		left: 10px;
		display: flex;
		flex-direction: row-reverse;
		gap: 12px;
		padding: 16px 18px 14px;
		background: var(--desk);
		border: 1px solid var(--chrome-edge);
		border-radius: 6px;
		box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
		z-index: 20;
	}
	.tao {
		position: relative;
		width: 92px;
		height: 196px;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		background: var(--silk);
		background-image: repeating-linear-gradient(0deg, transparent 0 5px, rgba(255, 255, 255, 0.05) 5px 6px);
		box-shadow: inset 0 0 0 3px var(--silk-edge), 0 3px 8px rgba(0, 0, 0, 0.35);
		color: var(--ink);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 14px 0 10px;
		transition: transform 0.15s;
	}
	.tao:hover {
		transform: translateY(-3px);
	}
	.tao.on {
		box-shadow: inset 0 0 0 3px var(--gold), 0 3px 8px rgba(0, 0, 0, 0.35);
	}
	.qian {
		writing-mode: vertical-rl;
		background: var(--book-paper);
		border: 1px solid var(--frame);
		outline: 1px solid var(--frame);
		outline-offset: -4px;
		padding: 8px 4px;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: 0.2em;
		min-height: 104px;
	}
	.what {
		writing-mode: vertical-rl;
		margin-top: 8px;
		font-size: 12px;
		letter-spacing: 0.15em;
		color: var(--chrome-ink);
		flex: 1;
	}
	.count {
		font-size: 11px;
		color: var(--chrome-soft);
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
		position: fixed;
		top: 54px;
		right: 12px;
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
	@media (max-width: 1760px) {
		.cap {
			display: none;
		}
		.bar {
			gap: 10px;
		}
		.group button {
			padding: 5px 8px;
		}
	}
</style>
