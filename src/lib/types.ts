// Shapes of the files in static/data (written by pipeline/build.mjs).

export type Ed = 'd' | 'j';
export type Script = 's' | 't';
export type NoteKind = 'jijie' | 'suoyin' | 'zhengyi' | 'kaozheng' | 'zan';

/** One edition's text for a segment. Offsets are character indexes into s/t. */
export interface SegText {
	s: string;
	t: string;
	/** punctuation after character i (點校本) */
	p?: [number, string][];
	/** punctuation before character i (opening quotes) */
	q?: [number, string][];
	/** commentary note after character i (-1: before the segment) */
	n?: [number, string][];
	/** 異文: [start, length, variant id] */
	v?: [number, number, string][];
	/** 點校 marks: [i, len, 'del'] or [i, 0, 'add', text] */
	e?: [number, number, string, string?][];
	/** characters restored from the other edition */
	x?: number[];
	/** 缺筆: printed with the last stroke left off to avoid a 清 emperor's name */
	b?: number[];
	/** tags: [start, length, 'p' person | 'l' place, id] */
	g?: [number, number, 'p' | 'l', string][];
}

export interface Segment {
	id: string;
	para: number;
	d: SegText;
	j: SegText;
	dt?: { ey: number; m: number | null; x: string }[];
}

export interface NotePart {
	k: NoteKind;
	s: string;
	t: string;
}

export interface Variant {
	id: string;
	seg: string;
	d: { s: string; t: string };
	j: { s: string; t: string };
	kind: 'text' | 'form' | 'taboo' | 'graphic';
}

export interface Chapter {
	id: string;
	book: string;
	juan: number;
	title: { s: string; t: string };
	heading: { d: string; j: string };
	header: { s: string; t: string }[];
	segs: Segment[];
	notes: Record<Ed, Record<string, { parts: NotePart[] }>>;
	variants: Variant[];
	mentions: Record<string, number>;
	stats: Record<string, unknown>;
}

export interface PlainChapter {
	id: string;
	book: string;
	juan: number;
	title: { s: string; t: string };
	paras: { h: string | null; s: string; t: string }[];
}

export interface EditionInfo {
	id: Ed;
	name: string;
	t: string;
	short: string;
	full: string;
	date: string;
	layout: { cols: number; rows: number; noteRows: number; frame: string; mouth: string; fishtail: number; desc: string };
	commentary: NoteKind[];
	source: { name: string; url: string; licence: string; basis: string };
}

export interface ChapterInfo {
	id: string;
	juan: number;
	juanZh?: string;
	title: string;
	t: string;
	kind?: string;
	n?: string;
}

export interface Catalog {
	books: Record<string, { title: string; t: string; chapters: ChapterInfo[] }>;
	editions: Record<Ed, EditionInfo>;
}

export interface Person {
	id: string;
	name: string;
	t: string;
	zi?: string;
	aliases: string[];
	local?: Record<string, string[]>;
	born: number | null;
	bornNote?: string;
	died: number | null;
	deathPlace?: string;
	side: 'qin' | 'chu' | 'han' | 'other';
	titles?: [string, string, string][];
	bio: string;
	bioT: string;
	/** a public-domain portrait (woodcut or painting) and where it comes from */
	portrait?: { image: string; source: string; page?: string };
	chapter?: string;
}

export interface Place {
	id: string;
	name: string;
	t: string;
	aliases: string[];
	lon: number;
	lat: number;
	modern: string;
	kind: string;
	note?: string;
}

export interface Account {
	ref: string;
	at: string;
	paras: [number, number];
	segs?: [string, string];
	/** found by shared wording with the 史記 accounts, not anchored by hand */
	auto?: boolean;
}

export interface HistEvent {
	id: string;
	title: string;
	t: string;
	era: string;
	ey: number;
	m: number | null;
	approx?: boolean;
	places: string[];
	people: string[];
	accounts: Account[];
	/** books that do not tell the event, with a note */
	absent?: Record<string, string>;
}

export interface Polity {
	name: string;
	ruler: string;
	capital: string;
	side: 'qin' | 'chu' | 'han' | 'other';
}

export interface Basemap {
	bbox: [number, number, number, number];
	coast: [number, number][][];
	lakes: [number, number][][];
	rivers: { name: string; t: string; major?: boolean; ancient?: boolean; line: [number, number][] }[];
	land: [number, number][][];
	/** land built out since about 200 BC, shown as sea: `coast` is the old shore */
	hanSea: { name: string; coast: [number, number][]; ring: [number, number][] }[];
	marshes: { name: string; t: string; c: [number, number]; ring: [number, number][] }[];
	mountains: { name: string; t: string; lon: number; lat: number }[];
}
