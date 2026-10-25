// Click handling shared by the scroll and book views (event delegation on the text).
import { app } from './state.svelte';
import type { Ed } from './types';

export function onTextClick(e: MouseEvent, ed: Ed) {
	const el = (e.target as HTMLElement).closest<HTMLElement>('.c');
	if (!el) return;
	const d = el.dataset;
	if (d.seg) app.seg = d.seg;
	// a 經 mark opens the 三傳 for that year's entries
	if (d.k === 'jing') {
		app.settings.panel = 'sanzhuan';
		return;
	}
	if (d.note) {
		app.note = { ed, id: d.note, seg: d.seg ?? '' };
		app.settings.panel = 'note';
		return;
	}
	if (d.ref && d.tag === 'p') {
		app.person = d.ref;
		app.settings.panel = 'people';
		return;
	}
	if (d.ref && d.tag === 'l') {
		app.place = d.ref;
		app.settings.panel = 'map';
		return;
	}
	if (d.v) {
		app.variant = d.v;
		app.settings.panel = 'variants';
	}
}
