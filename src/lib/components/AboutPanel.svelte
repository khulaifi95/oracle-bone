<script lang="ts">
	// 凡例: how to read the marks, and where every text comes from.
	import { app } from '#lib/state.svelte.js';
	import { reading } from '#lib/reading.svelte.js';

	const t = $derived(app.settings.script === 't');
	const eds = $derived(reading.catalog ? Object.values(reading.catalog.editions) : []);
</script>

<div class="about">
	<h3>{t ? '凡例' : '凡例'}</h3>
	<ul class="legend">
		<li><span class="m tp">項羽</span>{t ? '人名：左側直線' : '人名：左侧直线'}</li>
		<li><span class="m tl">彭城</span>{t ? '地名：左側虛線' : '地名：左侧虚线'}</li>
		<li><span class="m v">己</span>{t ? '兩本異文：字旁圓點，點擊查看' : '两本异文：字旁圆点，点击查看'}</li>
		<li><span class="m r">之</span>{t ? '四庫錄文缺字，據金陵本補' : '四库录文缺字，据金陵本补'}</li>
		<li><span class="m qb">玄</span>{t ? '缺筆避諱：殿本刻作缺末筆，避康熙、乾隆名諱' : '缺笔避讳：殿本刻作缺末笔，避康熙、乾隆名讳'}</li>
		<li><span class="m del">而</span>{t ? '點校本刪去之字（金陵本）' : '点校本删去之字（金陵本）'}</li>
		<li><span class="m add">也</span>{t ? '點校本補字，懸停可見' : '点校本补字，悬停可见'}</li>
		<li><span class="lab">集解</span>{t ? '雙行小注，點擊在左欄展開' : '双行小注，点击在左栏展开'}</li>
	</ul>
	<p class="small">
		{t
			? '年代以秦曆推算：歲首十月，故「元年十月」在前一年冬。歲數為虛歲。時間軸由右向左，與書寫方向一致。'
			: '年代以秦历推算：岁首十月，故「元年十月」在前一年冬。岁数为虚岁。时间轴由右向左，与书写方向一致。'}
	</p>

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
		<p class="small">
			{t ? '《漢書》卷一、三十一、三十四、四十，《資治通鑑》卷七至十一，錄文據' : '《汉书》卷一、三十一、三十四、四十，《资治通鉴》卷七至十一，录文据'}
			<a href="https://zh.wikisource.org/" target="_blank" rel="noreferrer">{t ? '維基文庫' : '维基文库'}</a>（CC BY-SA 4.0）。
		</p>
		<p class="small">
			{t ? '底圖據' : '底图据'} <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>{t
				? '（公有領域）；黃河下游改繪為西漢故道，今黃河下游一線標為濟水。地名坐標取古城遺址或今治所的約略位置。'
				: '（公有领域）；黄河下游改绘为西汉故道，今黄河下游一线标为济水。地名坐标取古城遗址或今治所的约略位置。'}
		</p>
		<p class="small">
			{t
				? '人物、地名、事件、諸侯年表為本項目據史記、漢書整理；人物生年多由本文推得，見人物卡說明。'
				: '人物、地名、事件、诸侯年表为本项目据史记、汉书整理；人物生年多由本文推得，见人物卡说明。'}
		</p>
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
		font-size: 13px;
		line-height: 1.7;
	}
	h3 {
		font-size: 13px;
		letter-spacing: 0.3em;
		color: var(--accent);
		margin: 14px 0 6px;
	}
	h3:first-child {
		margin-top: 0;
	}
	section {
		background: var(--paper);
		border: 1px solid var(--chrome-edge);
		border-radius: 4px;
		padding: 6px 10px;
		margin-bottom: 8px;
	}
	p {
		margin: 4px 0;
	}
	.small {
		font-size: 12px;
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
		right: 0.9em;
		top: 50%;
		width: 5px;
		height: 5px;
		margin-top: -2px;
		border-radius: 50%;
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
		font-size: 11px;
		border-radius: 2px;
	}
</style>
