// What is being read: the loaded data, and what the current position means
// (which event it belongs to, what date it is, who and where is mentioned nearby).
import type { Basemap, BookInfo, Catalog, Chapter, HistEvent, NoteDef, Person, Place, Polity, Script, Side, EditionInfo } from './types';
import { app } from './state.svelte';
import { loadBasemap, loadCatalog, loadChapter, loadEvents, loadPeople, loadPlaces, loadPolities } from './data';
import { eraLabel, monthLabel, julianYear, yearLong } from './dates';

export interface CurrentDate {
	ey: number;
	m: number | null;
	/** the words in the text that give the date, or the event title */
	x: string;
	from: 'event' | 'text' | 'chapter';
}

class Reading {
	catalog = $state<Catalog | null>(null);
	/** the reading book whose people, places and events are loaded */
	bookId = $state('shiji');
	chapter = $state<Chapter | null>(null);
	people = $state<Person[]>([]);
	places = $state<Place[]>([]);
	events = $state<HistEvent[]>([]);
	polities = $state<Record<string, Polity[]>>({});
	basemap = $state<Basemap | null>(null);
	error = $state<string | null>(null);

	personById = $derived(new Map(this.people.map((p) => [p.id, p])));
	placeById = $derived(new Map(this.places.map((p) => [p.id, p])));

	book = $derived<BookInfo | null>(this.catalog?.books[this.bookId] ?? null);
	/** the book's editions, named in the script being read */
	editions = $derived.by(() => {
		const eds = this.book?.editions;
		if (!eds || app.settings.script === 's') return eds ?? null;
		const tr = (e: EditionInfo): EditionInfo => ({ ...e, short: e.shortT, full: e.fullT });
		return { d: tr(eds.d), j: tr(eds.j) };
	});
	noteDefs = $derived(new Map<string, NoteDef>((this.book?.notes ?? []).map((n) => [n.k, n])));
	sideById = $derived(new Map<string, Side>((this.book?.sides ?? []).map((x) => [x.id, x])));
	/** the chapter's entry in the catalog */
	info = $derived(this.chapter ? (this.book?.chapters.find((c) => c.id === this.chapter!.id) ?? null) : null);

	/** what the layout needs from the book: the commentaries' names, the printed title, the chapter number */
	layoutOf(script: Script) {
		const n = this.info?.n ?? '';
		const p = this.book?.printed;
		return {
			labels: Object.fromEntries((this.book?.notes ?? []).map((x) => [x.k, script === 't' ? x.t : x.s])),
			bookTitle: p ? (script === 't' ? p.t : p.s) : '',
			juanZh: this.info?.juanZh ?? '',
			headingNo: n ? (n.startsWith('第') ? n : `第${n}`) : '',
			jz: this.book?.jingzhuan ? app.settings.jz : undefined
		};
	}

	noteLabel(k: string, script: Script) {
		const n = this.noteDefs.get(k);
		return n ? (script === 't' ? n.t : n.s) : k;
	}
	sideLabel(id: string, script: Script) {
		const x = this.sideById.get(id);
		return x ? (script === 't' ? x.t : x.s) : '';
	}
	bookName(id: string, script: Script) {
		const n = this.catalog?.names[id];
		return n ? n[script === 't' ? 1 : 0] : id;
	}
	/** 建安十三年十二月 · 公元208年 */
	dateText(ey: number, m: number | null, script: Script, approx = false) {
		const cal = this.book?.calendar;
		if (!cal) return '';
		return `${eraLabel(ey, cal, script, this.info?.court)}${monthLabel(m)}${approx ? (script === 't' ? '前後' : '前后') : ''} · ${yearLong(julianYear(ey, m, cal))}`;
	}

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
			this.catalog = await loadCatalog();
		} catch (e) {
			this.error = String(e);
		}
	}

	/** Load a reading book's people, places, events, states and map. */
	async loadBook(id: string) {
		const b = this.catalog?.books[id];
		if (!b) throw new Error(`no book ${id}`);
		const [people, places, events, polities, basemap] = await Promise.all([
			loadPeople(id),
			loadPlaces(id),
			loadEvents(id),
			loadPolities(id),
			loadBasemap(b.map.period)
		]);
		// commentaries never set take the book's defaults
		for (const n of b.notes) app.settings.notes[n.k] ??= n.on;
		this.people = people;
		this.places = places;
		this.events = events;
		this.polities = polities;
		this.basemap = basemap;
		this.bookId = id;
		app.person = null;
		app.place = null;
		app.note = null;
		app.variant = null;
	}

	async open(id: string, seg?: string | null) {
		try {
			const book = id.split('-')[0];
			if (!this.catalog?.books[book]?.chapters.some((c) => c.id === id)) throw new Error(`no chapter ${id}`);
			const ch = await loadChapter(id);
			if (book !== this.bookId || !this.basemap) await this.loadBook(book);
			if (this.chapter?.id !== ch.id) {
				app.event = null;
				app.seg = seg && ch.segs.some((s) => s.id === seg) ? seg : null;
				this.chapter = ch;
			} else if (seg) app.goto(seg);
			app.settings.chapter = id;
			app.settings.chapters[book] = id;
			app.save();
		} catch (e) {
			this.error = String(e);
		}
	}
}

export const reading = new Reading();

/** The chapter of the current book a segment id belongs to (for links between chapters). */
export function chapterOfSeg(seg: string): string {
	return `${reading.bookId}-${seg.split('.')[0]}`;
}
