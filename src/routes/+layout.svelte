<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '@fontsource/noto-serif-sc/400.css';
	import '@fontsource/noto-serif-sc/600.css';
	import '@fontsource/noto-serif-tc/400.css';
	import '@fontsource/noto-serif-tc/600.css';
	import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css';
	import 'lxgw-wenkai-webfont/lxgwwenkai-bold.css';
	import '@fontsource/ma-shan-zheng/400.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		/* 楷書 by default; 宋體 (the printed-book face) can be chosen in the top bar */
		--font-kai: 'LXGW WenKai', 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
		--font-song: 'Noto Serif SC', 'Noto Serif TC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
		--font-brush: 'Ma Shan Zheng', 'LXGW WenKai', serif;
		--font: var(--font-kai);
		--text-font: var(--font-kai);

		/* frame: dark lacquer around light paper */
		--bg: #221b16;
		--chrome: #2b221c;
		--chrome-2: #362b23;
		--chrome-edge: #4d3d30;
		--chrome-ink: #f1e6cc;
		--chrome-soft: #b3a183;
		--panel: #f6eedb;
		--panel-2: #ebdfc3;
		--panel-edge: #cdb98f;

		--ink: #1b1510;
		--ink-note: #5e4630;
		--ink-soft: #85735a;
		--accent: #b8322a;
		--accent-soft: rgba(184, 50, 42, 0.14);
		--gold: #d9a441;
		--paper: #fbf5e6;
		--sel: rgba(217, 164, 65, 0.32);
		--name-line: #b8322a;
		--place-line: #1f5f99;
		--var-dot: #d2691e;
		--var-sel: rgba(210, 105, 30, 0.22);
		--note-sel: rgba(94, 70, 48, 0.16);
		--judou: #c0392b;

		/* the five commentaries, each with its own colour */
		--n-jijie: #285f93;
		--n-suoyin: #2e7d4f;
		--n-zhengyi: #8f5a12;
		--n-kaozheng: #b8322a;
		--n-zan: #6c3d91;

		--scroll-paper: #f4e7c5;
		--paper-grain: radial-gradient(rgba(120, 90, 40, 0.06) 1px, transparent 1px);
		--silk: #24435a;
		--silk-edge: #12283a;
		--silk-light: #d8c9a0;
		--roller: linear-gradient(90deg, #2a1810, #8a5a36 45%, #2a1810);
		--stage: #3a2c22;

		--desk: #5b4231;
		--book-paper: #f4e9cf;
		--frame: #2e231b;
		--rule: rgba(46, 35, 27, 0.55);

		/* map: sea, land and water in the colours of an old printed 輿圖 */
		--map-sea: #9fc0cc;
		--map-land: #f3ead2;
		--map-coast: #4f7788;
		--map-coast-now: #6f8f9c;
		--map-water: #b2d2dc;
		--map-marsh: rgba(120, 175, 190, 0.45);
		--map-river: #2f74a3;
		--map-river-ink: #1f5f8f;
		--map-mount: #8a6239;

		--qin: #3d4a5c;
		--chu: #b8322a;
		--han: #c7891d;
		--other: #2f7d5b;
	}
	:global(html[data-face='song']) {
		--text-font: var(--font-song);
	}
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		font-size: 15px;
	}
	:global(button),
	:global(select),
	:global(input) {
		font: inherit;
		color: inherit;
	}
	:global(*) {
		box-sizing: border-box;
	}
	:global(::selection) {
		background: rgba(163, 50, 42, 0.2);
	}
</style>
