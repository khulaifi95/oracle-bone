<script lang="ts">
	// 凡例: how to read the marks, and where every text comes from.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';

	const t = $derived(app.settings.script === 't');
	const book = $derived(reading.book);
	const eds = $derived(book ? Object.values(book.editions) : []);
	const read = (x: { s: string; t: string } | undefined) => (x ? (t ? x.t : x.s) : '');
	const firstNote = $derived(book?.notes[0]);
</script>

<div class="about">
	<h3>{t ? '凡例' : '凡例'}</h3>
	<ul class="legend">
		<li><span class="m tp">{book?.legend.person[t ? 0 : 1]}</span>{t ? '人名：左側直線' : '人名：左侧直线'}</li>
		<li><span class="m tl">{book?.legend.place[t ? 0 : 1]}</span>{t ? '地名：左側虛線' : '地名：左侧虚线'}</li>
		<li><span class="m v">己</span>{t ? '兩本異文：字旁橙色短豎，點擊查看；楔形表示他本此處多字' : '两本异文：字旁橙色短竖，点击查看；楔形表示他本此处多字'}</li>
		<li><span class="m r">之</span>{t ? `${book?.editions.d.short ?? ''}錄文缺字，據${book?.editions.j.short ?? ''}補` : `${book?.editions.d.short ?? ''}录文缺字，据${book?.editions.j.short ?? ''}补`}</li>
		<li><span class="m qb">玄</span>{t ? '缺筆避諱：殿本刻作缺末筆，避康熙、乾隆名諱' : '缺笔避讳：殿本刻作缺末笔，避康熙、乾隆名讳'}</li>
		<li><span class="m del">而</span>{t ? `點校本刪去之字（${book?.editions.j.short ?? ''}）` : `点校本删去之字（${book?.editions.j.short ?? ''}）`}</li>
		<li><span class="m add">也</span>{t ? '點校本補字，懸停可見' : '点校本补字，悬停可见'}</li>
		{#if firstNote}<li><span class="lab">{t ? firstNote.t : firstNote.s}</span>{t ? '雙行小注，點擊在左欄展開' : '双行小注，点击在左栏展开'}</li>{/if}
		{#if book?.jingzhuan}<li><span class="lab jz">{t ? '經' : '经'}</span>{t ? '經、傳各以陰文標起；點「經」字看三傳' : '经、传各以阴文标起；点“经”字看三传'}</li>{/if}
		{#if book?.subheadings}<li><span class="lab src">江表傳</span>{t ? '裴注所引之書；「注」欄可按書檢看' : '裴注所引之书；“注”栏可按书检看'}</li>{/if}
	</ul>
	<p class="small">{read(book?.calendar.note)}</p>

	<h3>{t ? '版本' : '版本'}</h3>
	{#each eds as e (e.id)}
		<section>
			<b>{t ? e.t : e.name}</b> <span class="small">{e.date}</span>
			<p>{e.full}</p>
			<p class="small">{e.layout.desc}</p>
			<p class="small">{t ? '錄文' : '录文'}：<a href={e.source.url} target="_blank" rel="noreferrer">{e.source.name}</a>（{e.source.licence}）。{e.source.basis}</p>
		</section>
	{/each}

	<h3>{t ? '對讀與地圖' : '对读与地图'}</h3>
	<section>
		<p class="small">{read(book?.parallels.sources)}</p>
		<p class="small">
			{t ? '底圖據' : '底图据'} <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>{read(book?.map.about)}
		</p>
		<p class="small">{read(book?.data)}</p>
	</section>
	<h3>{t ? '操作' : '操作'}</h3>
	<p class="small">
		{t
			? '卷軸：滾輪或拖動捲軸左右移動。線裝：← → 鍵或滾輪翻葉。點擊人名、地名、小注、異文，左欄顯示詳情；點擊時間軸上的事件跳至該段。'
			: '卷轴：滚轮或拖动卷轴左右移动。线装：← → 键或滚轮翻叶。点击人名、地名、小注、异文，左栏显示详情；点击时间轴上的事件跳至该段。'}
	</p>
</div>

<style>
	.about {
		padding: 10px 12px;
		overflow-y: auto;
		height: 100%;
		font-size: 14.5px;
		line-height: 1.7;
	}
	h3 {
		font-size: 14.5px;
		letter-spacing: 0.3em;
		color: var(--accent);
		margin: 14px 0 6px;
	}
	h3:first-child {
		margin-top: 0;
	}
	section {
		background: var(--paper);
		border: 1px solid var(--panel-edge);
		border-radius: 4px;
		padding: 6px 10px;
		margin-bottom: 8px;
	}
	p {
		margin: 4px 0;
	}
	.small {
		font-size: 13px;
		color: var(--ink-note);
	}
	a {
		color: var(--place-line);
	}
	.legend {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.lab.jz {
		background: var(--ink);
	}
	.lab.src {
		background: none;
		color: var(--n-pei);
		border: 1px solid var(--n-pei);
	}
	.legend li {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 2px 0;
	}
	.m {
		position: relative;
		display: inline-block;
		width: 3.2em;
		text-align: center;
		font-size: 15px;
	}
	.m.tp {
		border-left: 1.5px solid var(--name-line);
	}
	.m.tl {
		border-left: 1.5px dashed var(--place-line);
	}
	.m.v::after {
		content: '';
		position: absolute;
		right: 0.8em;
		top: 20%;
		bottom: 20%;
		width: 3px;
		border-radius: 2px;
		background: var(--var-dot);
	}
	.m.r {
		text-decoration: underline dotted var(--ink-soft);
	}
	.m.qb::before {
		content: '';
		position: absolute;
		right: 1em;
		bottom: 2px;
		width: 5px;
		height: 5px;
		border-right: 1.5px solid var(--var-dot);
		border-bottom: 1.5px solid var(--var-dot);
	}
	.m.del {
		color: var(--ink-soft);
	}
	.m.add::after {
		content: '⁺';
		color: var(--accent);
	}
	.lab {
		width: 3.2em;
		text-align: center;
		background: var(--ink-note);
		color: var(--paper);
		font-size: 12px;
		border-radius: 2px;
	}
</style>
