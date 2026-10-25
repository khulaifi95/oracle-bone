<script lang="ts">
	// A name seal (姓名印) for people without a portrait: 項籍 → 項籍之印, read in columns
	// from the right, cut in red.
	let { name, size = 96, color = 'var(--accent)' }: { name: string; size?: number; color?: string } = $props();

	const chars = $derived.by(() => {
		const c = [...name];
		const full = c.length >= 4 ? c.slice(0, 4) : c.length === 3 ? [...c, '印'] : [...c, '之', '印'];
		// two columns, right column first
		return [full[0], full[1], full[2], full[3]];
	});
</script>

<div class="seal" style="width:{size}px;height:{size}px;--c:{color};font-size:{size * 0.36}px" aria-label="{name}之印">
	<span style="grid-area:1/2">{chars[0]}</span>
	<span style="grid-area:2/2">{chars[1]}</span>
	<span style="grid-area:1/1">{chars[2]}</span>
	<span style="grid-area:2/1">{chars[3]}</span>
</div>

<style>
	.seal {
		display: grid;
		grid-template: 1fr 1fr / 1fr 1fr;
		place-items: center;
		background: var(--c);
		color: var(--paper);
		border-radius: 6px;
		box-shadow: inset 0 0 0 3px var(--c), inset 0 0 0 5px var(--paper);
		font-family: var(--font-brush);
		line-height: 1;
		padding: 8%;
		flex-shrink: 0;
	}
</style>
