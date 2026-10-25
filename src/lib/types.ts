// Shapes of the files in static/data (written by pipeline/build.mjs).

export type Ed = 'd' | 'j';
export type Script = 's' | 't';
/** a commentary: jijie, suoyin, zhengyi, kaozheng, zan (史記); pei (三國志); du, yinyi, shu (春秋) */
export type NoteKind = string;

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
	/** 春秋: 經 or 傳, and the year it stands under */
	k?: 'jing' | 'zhuan';
	y?: number;
}

export interface NotePart {
	k: NoteKind;
	s: string;
	t: string;
	/** 裴注: the book a passage quotes (traditional, and simplified) */
	src?: string;
	srcS?: string;
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
	/** a 卷 with several lives: where each one begins */
	sub?: { seg: string; s: string; t: string }[];
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
	/** top: what the 版心 prints above the fishtail, if anything */
	layout: { cols: number; rows: number; noteRows: number; frame: string; mouth: string; fishtail: number; desc: string; top?: string };
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
	/** the court (三國) or state (春秋) the chapter belongs to */
	court?: string;
	stats?: Record<string, unknown>;
}

/** simplified and traditional forms of a text */
export interface ST {
	s: string;
	t: string;
}

export interface NoteDef {
	k: NoteKind;
	s: string;
	t: string;
	color: string;
	/** shown by default */
	on: boolean;
	who: string;
	info: ST;
	/** found in one edition only */
	only?: Ed;
}

export interface Era {
	name: string;
	t?: string;
	from: number;
	to?: number;
	court?: string;
}

export interface Calendar {
	/** the month the year begins with (秦曆: 十月) */
	start: number;
	/** months the first month lies after January (秦曆, 夏正: 1; 周正: -1) */
	m1: number;
	/** how years are named: one line of eras, by court (三國), or by state (春秋) */
	mode?: 'courts' | 'states';
	courts?: { id: string; s: string; t: string }[];
	eras: Era[];
	note: ST;
}

export interface Side {
	id: string;
	s: string;
	t: string;
	color: string;
}

export interface BookInfo {
	id: string;
	title: string;
	t: string;
	cluster: ST;
	/** the title the editions print in the 卷首 and the 版心 */
	printed: ST;
	notes: NoteDef[];
	notesLead: ST;
	calendar: Calendar;
	sides: Side[];
	timeline: { breaks: [number, number][]; from: number; to: number; major: [number, number]; minor: number[]; marks: { ey: number; s: string; t: string }[] };
	map: { period: string; home: [number, number, number, number]; named: string[]; marshNames: string[]; empty: ST; purpose: ST; key: ST; about: ST };
	parallels: { books: string[]; chapters: string[]; how: ST; sources: ST };
	data: ST;
	legend: { person: [string, string]; place: [string, string] };
	chapters: ChapterInfo[];
	editions: Record<Ed, EditionInfo>;
	/** a 卷 can hold several lives */
	subheadings?: boolean;
	/** 經 and 傳 stand apart (春秋) */
	jingzhuan?: boolean;
}

export interface Catalog {
	books: Record<string, BookInfo>;
	/** names of every book read or quoted */
	names: Record<string, [string, string]>;
	/** the chapters of the parallel books */
	plain: Record<string, { book: string; juan: number; title: string; t: string }>;
}

/** 三傳: for each 經 entry of a 春秋 chapter, the 左氏 telling and the 公羊 and 穀梁 readings */
export interface SanzhuanEntry {
	seg: string;
	y: number;
	zuo: ST;
	/** the 傳 paragraph (its first segment) that tells the entry */
	told?: string;
	/** 杜注 says the 左氏 has no 傳 here */
	noZhuan?: boolean;
	gong?: { jing: ST; zhuan: ST | null };
	gu?: { jing: ST; zhuan: ST | null };
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
	/** a side of the book (its `sides`) */
	side: string;
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
	/** found by shared wording with the reading book's accounts, not anchored by hand */
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
	/** the ruler's name when the people list has no card for them */
	who?: string;
	capital: string;
	side: string;
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
