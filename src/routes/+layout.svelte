<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '@fontsource/noto-serif-sc/400.css';
	import '@fontsource/noto-serif-sc/600.css';
	import '@fontsource/noto-serif-tc/400.css';
	import '@fontsource/noto-serif-tc/600.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--font: 'Noto Serif SC', 'Noto Serif TC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
		--font-t: 'Noto Serif TC', 'Noto Serif SC', 'Source Han Serif TC', 'Songti TC', serif;

		--bg: #e9e2d3;
		--chrome: #f4efe4;
		--chrome-edge: #d6ccb8;
		--panel: #f8f4ec;
		--ink: #26201a;
		--ink-note: #5a4a3a;
		--ink-soft: #8a7b68;
		--accent: #a3322a;
		--accent-soft: rgba(163, 50, 42, 0.12);
		--paper: #f8f3e8;
		--sel: rgba(214, 170, 70, 0.22);
		--name-line: #a3322a;
		--place-line: #2f5f8a;
		--var-dot: #c0602b;
		--var-sel: rgba(192, 96, 43, 0.22);
		--note-sel: rgba(90, 74, 58, 0.14);
		--judou: #b0362c;

		--scroll-paper: #efe3c8;
		--paper-grain: radial-gradient(rgba(120, 90, 40, 0.05) 1px, transparent 1px);
		--silk: #6b4a3a;
		--silk-edge: #4a3024;
		--silk-light: #d9c9a6;
		--roller: linear-gradient(90deg, #3a2418, #7a5238 45%, #3a2418);

		--desk: #cdbf9f;
		--book-paper: #f1e7cf;
		--frame: #3a2e24;
		--rule: rgba(58, 46, 36, 0.55);

		--qin: #4a4a52;
		--chu: #a3322a;
		--han: #b8862b;
		--other: #4f7a5a;
	}
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		font-size: 14px;
	}
	:global(html[data-script='t']) {
		font-family: var(--font-t);
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
