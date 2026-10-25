// What is being read: the loaded data, and what the current position means
// (which event it belongs to, what date it is, who and where is mentioned nearby).
import type { Basemap, Catalog, Chapter, HistEvent, Person, Place, Polity } from './types';
import { app } from './state.svelte';
import { loadBasemap, loadCatalog, loadChapter, loadEvents, loadPeople, loadPlaces, loadPolities } from './data';

export interface CurrentDate {
	ey: number;
	m: number | null;
	/** the words in the text that give the date, or the event title */
	x: string;
	from: 'event' | 'text' | 'chapter';
}

class Reading {
	catalog = $state<Catalog | null>(null);
	chapter = $state<Chapter | null>(null);
	people = $state<Person[]>([]);
	places = $state<Place[]>([]);
	events = $state<HistEvent[]>([]);
	polities = $state<Record<string, Polity[]>>({});
	basemap = $state<Basemap | null>(null);
	error = $state<string | null>(null);

	personById = $derived(new Map(this.people.map((p) => [p.id, p])));
	placeById = $derived(new Map(this.places.map((p) => [p.id, p])));

	/** segment id → position in the chapter */
	order = $derived(new Map((this.chapter?.segs ?? []).map((s, i) => [s.id, i])));
	segIndex = $derived(app.seg ? (this.order.get(app.seg) ?? -1) : -1);

	/** events told in this chapter, in the order the chapter tells them */
	chapterEvents = $derived.by(() => {
		const ch = this.chapter;
		if (!ch) return [];
		const out: { e: HistEvent; from: number; to: number }[] = [];
		for (const e of this.events)
			for (const a of e.accounts)
				if (a.ref === ch.id && a.segs) {
					const from = this.order.get(a.segs[0]);
					const to = this.order.get(a.segs[1]);
					if (from != null && to != null) out.push({ e, from, to });
				}
		return out.sort((a, b) => a.from - b.from);
	});

	/** the event the current passage belongs to (the narrowest one containing it) */
	event = $derived.by(() => {
		const i = this.segIndex;
		if (i < 0) return null;
		let best: { e: HistEvent; from: number; to: number } | null = null;
		for (const x of this.chapterEvents)
			if (x.from <= i && i <= x.to && (!best || x.to - x.from < best.to - best.from)) best = x;
		return best?.e ?? null;
	});

	/** the last event told at or before the current passage (for 對讀 between events) */
	lastEvent = $derived.by(() => {
		const i = this.segIndex;
		let best: HistEvent | null = null;
		for (const x of this.chapterEvents) if (x.from <= i) best = x.e;
		return best ?? this.chapterEvents[0]?.e ?? null;
	});

	date = $derived.by((): CurrentDate | null => {
		const ch = this.chapter;
		if (!ch) return null;
		const ev = this.event;
		if (ev) return { ey: ev.ey, m: ev.m, x: ev.title, from: 'event' };
		const i = Math.max(0, this.segIndex);
		for (let k = i; k >= 0; k--) {
			const dt = ch.segs[k].dt;
			if (dt?.length) {
				const d = dt[dt.length - 1];
				return { ey: d.ey, m: d.m, x: d.x, from: 'text' };
			}
		}
		// before the first date in the chapter: the first event it tells
		const first = this.chapterEvents[0]?.e;
		return first ? { ey: first.ey, m: first.m, x: first.title, from: 'chapter' } : null;
	});

	/** people and places tagged within a few segments of the current one */
	nearby = $derived.by(() => {
		const ch = this.chapter;
		const people = new Map<string, number>();
		const places = new Map<string, number>();
		if (!ch) return { people, places };
		const i = Math.max(0, this.segIndex);
		const ed = app.settings.edition === 'j' ? 'j' : 'd';
		for (let k = Math.max(0, i - 3); k <= Math.min(ch.segs.length - 1, i + 6); k++)
			for (const [, , type, id] of ch.segs[k][ed].g ?? []) {
				const m = type === 'p' ? people : places;
				m.set(id, (m.get(id) ?? 0) + 1);
			}
		return { people, places };
	});

	async init() {
		try {
			const [catalog, people, places, events, polities, basemap] = await Promise.all([
				loadCatalog(),
				loadPeople(),
				loadPlaces(),
				loadEvents(),
				loadPolities(),
				loadBasemap()
			]);
			this.catalog = catalog;
			this.people = people;
			this.places = places;
			this.events = events;
			this.polities = polities;
			this.basemap = basemap;
		} catch (e) {
			this.error = String(e);
		}
	}

	async open(id: string, seg?: string | null) {
		try {
			const ch = await loadChapter(id);
			if (this.chapter?.id !== ch.id) {
				app.event = null;
				app.seg = seg && ch.segs.some((s) => s.id === seg) ? seg : null;
				this.chapter = ch;
			} else if (seg) app.goto(seg);
			app.settings.chapter = id;
			app.save();
		} catch (e) {
			this.error = String(e);
		}
	}
}

export const reading = new Reading();

/** Map a 史记 chapter id and segment to its place in the book (for links between chapters). */
export function chapterOfSeg(seg: string): string {
	return `shiji-${seg.split('.')[0]}`;
}
