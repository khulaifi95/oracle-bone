// Lays a chapter out on a grid of vertical columns, the way a block-printed page is cut:
// main text one character per cell, commentary as 雙行小注 (two half-width sub-columns),
// and optional punctuation either as 句讀 marks beside characters or as cells of its own.
import type { Chapter, Ed, NoteKind, Script, Segment } from './types';
import type { Punct } from './state.svelte';
import { NOTE_LABEL, NOTE_LABEL_T } from './state.svelte';

export interface Cell {
	/** top, in rows */
	y: number;
	/** height, in rows */
	h: number;
	/** 2: full width; 0: right half; 1: left half */
	x: 0 | 1 | 2;
	ch: string;
	/** m: main text, n: note text, l: note label (陰文), p: punctuation, h: heading */
	k: 'm' | 'n' | 'l' | 'p' | 'h';
	seg?: string;
	i?: number;
	tag?: 'p' | 'l';
	ref?: string;
	tagStart?: boolean;
	tagEnd?: boolean;
	v?: string;
	vk?: string;
	vgap?: string;
	r?: boolean;
	/** 缺筆 taboo form */
	qb?: boolean;
	del?: boolean;
	add?: string;
	mark?: '。' | '、';
	note?: string;
	nk?: NoteKind;
}

export interface Column {
	cells: Cell[];
	/** first segment that starts in this column */
	seg?: string;
	/** segment active at the column's top */
	segAt?: string;
	kind?: 'title' | 'text';
}

export interface Layout {
	cols: Column[];
	segCol: Map<string, number>;
	rows: number;
}

export interface LayoutOptions {
	ed: Ed;
	script: Script;
	punct: Punct;
	notes: Record<NoteKind, boolean>;
	rows: number;
	/** height of a note character, in rows */
	noteH: number;
	/** book form starts with 卷首 lines */
	frontMatter: boolean;
	bookTitle: string;
	juanZh: string;
}

const VERTICAL: Record<string, string> = {
	'，': '︐', '。': '︒', '、': '︑', '：': '︓', '；': '︔', '！': '︕', '？': '︖', '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄',
	'《': '︽', '》': '︾', '〈': '︿', '〉': '﹀', '（': '︵', '）': '︶', '…': '︙', '—': '︱', '·': '・'
};
const FULL_STOP = /[。！？]/;
const PAUSE = /[，、；：]/;

export function layoutChapter(ch: Chapter, o: LayoutOptions): Layout {
	const R = o.rows;
	const cols: Column[] = [];
	const segCol = new Map<string, number>();
	let col: Column = { cells: [], kind: 'text' };
	let y = 0;
	let currentSeg: string | undefined;

	const newCol = (kind: Column['kind'] = 'text') => {
		if (col.cells.length || col.kind === 'title') cols.push(col);
		col = { cells: [], kind, segAt: currentSeg };
		y = 0;
	};
	const ensure = (h: number) => {
		if (y + h > R + 1e-6) newCol();
	};
	const place = (c: Omit<Cell, 'y'>) => {
		ensure(c.h);
		col.cells.push({ ...c, y } as Cell);
		y += c.h;
	};

	// 卷首: book title and juan, author lines, then the chapter heading.
	if (o.frontMatter) {
		col = { cells: [], kind: 'title' };
		[...`${o.bookTitle}${o.juanZh}`].forEach((c, k) => col.cells.push({ y: k, h: 1, x: 2, ch: c, k: 'h' }));
		cols.push(col);
		for (const line of ch.header) {
			const chars = [...(o.script === 's' ? line.s : line.t)];
			const start = Math.max(1, R - chars.length - 1);
			col = { cells: [], kind: 'title' };
			chars.forEach((c, k) => col.cells.push({ y: Math.min(start + k, R - 1), h: 1, x: 2, ch: c, k: 'h' }));
			cols.push(col);
		}
	}
	col = { cells: [], kind: 'text' };
	const heading = [...(o.script === 's' ? ch.title.s : ch.title.t) + headingNo(ch, o.ed)];
	heading.forEach((c, k) => col.cells.push({ y: 1 + k, h: 1, x: 2, ch: c, k: 'h' }));
	// the text starts on the column after the heading, as in the printed book
	col.kind = 'title';
	cols.push(col);
	col = { cells: [], kind: 'text' };
	y = 0;

	const notesOf = (id: string) => ch.notes[o.ed][id];
	const label = o.script === 's' ? NOTE_LABEL : NOTE_LABEL_T;

	const placeNote = (id: string, seg: string) => {
		const note = notesOf(id);
		if (!note) return;
		const chars: { ch: string; k: 'n' | 'l'; nk: NoteKind }[] = [];
		for (const part of note.parts) {
			if (!o.notes[part.k]) continue;
			for (const c of label[part.k]) chars.push({ ch: c, k: 'l', nk: part.k });
			for (const c of o.script === 's' ? part.s : part.t) chars.push({ ch: c, k: 'n', nk: part.k });
		}
		if (!chars.length) return;
		let rest = chars;
		while (rest.length) {
			let rowsFit = Math.floor((R - y) / o.noteH + 1e-6);
			if (rowsFit < 1) {
				newCol();
				rowsFit = Math.floor(R / o.noteH + 1e-6);
			}
			const k = Math.min(rowsFit, Math.ceil(rest.length / 2));
			const chunk = rest.slice(0, 2 * k);
			rest = rest.slice(2 * k);
			const right = Math.ceil(chunk.length / 2);
			chunk.forEach((c, n) => {
				const half = n < right ? 0 : 1;
				const row = half === 0 ? n : n - right;
				col.cells.push({ y: y + row * o.noteH, h: o.noteH, x: half, ch: c.ch, k: c.k, nk: c.nk, note: id, seg });
			});
			y += k * o.noteH;
		}
	};

	let lastPara = -1;
	for (const seg of ch.segs) {
		const t = seg[o.ed];
		const text = [...(o.script === 's' ? t.s : t.t)];
		if (seg.para !== lastPara && lastPara !== -1) newCol();
		lastPara = seg.para;
		currentSeg = seg.id;
		if (!col.segAt) col.segAt = seg.id;

		const after = new Map(t.p ?? []);
		const before = new Map(t.q ?? []);
		const notes = new Map<number, string[]>();
		for (const [i, id] of t.n ?? []) notes.set(i, [...(notes.get(i) ?? []), id]);
		const tagAt = new Map<number, [number, 'p' | 'l', string]>();
		for (const [i, len, type, ref] of t.g ?? []) tagAt.set(i, [len, type, ref]);
		const varAt = new Map<number, string>();
		const gapAt = new Map<number, string>();
		for (const [i, len, vid] of t.v ?? []) {
			if (len === 0) gapAt.set(Math.max(0, i - 1), vid);
			for (let k = 0; k < len; k++) varAt.set(i + k, vid);
		}
		const restored = new Set(t.x ?? []);
		const quebi = new Set(t.b ?? []);
		const dels = new Set<number>();
		const adds = new Map<number, string>();
		for (const [i, len, type, txt] of t.e ?? []) {
			if (type === 'del') for (let k = 0; k < Math.max(1, len); k++) dels.add(i + k);
			else adds.set(i, txt ?? '');
		}

		for (const id of notes.get(-1) ?? []) placeNote(id, seg.id);
		let tagLeft = 0;
		let tag: [number, 'p' | 'l', string] | undefined;
		text.forEach((c, i) => {
			if (o.punct === 'full' && before.has(i)) for (const p of before.get(i)!) place({ h: 0.5, x: 2, ch: VERTICAL[p] ?? p, k: 'p', seg: seg.id });
			if (tagAt.has(i)) {
				tag = tagAt.get(i);
				tagLeft = tag![0];
			}
			ensure(1);
			if (!segCol.has(seg.id)) {
				segCol.set(seg.id, cols.length);
				col.seg ??= seg.id;
			}
			const p = after.get(i);
			const cell: Cell = { y, h: 1, x: 2, ch: c, k: 'm', seg: seg.id, i };
			if (tagLeft > 0 && tag) {
				cell.tag = tag[1];
				cell.ref = tag[2];
				cell.tagStart = tagLeft === tag[0];
				cell.tagEnd = tagLeft === 1;
				tagLeft--;
			}
			const vid = varAt.get(i);
			if (vid) cell.v = vid;
			if (gapAt.has(i)) cell.vgap = gapAt.get(i);
			if (restored.has(i)) cell.r = true;
			if (quebi.has(i)) cell.qb = true;
			if (dels.has(i)) cell.del = true;
			if (adds.has(i)) cell.add = adds.get(i);
			if (o.punct === 'judou' && p) cell.mark = FULL_STOP.test(p) ? '。' : PAUSE.test(p) ? '、' : undefined;
			col.cells.push(cell);
			y += 1;
			if (o.punct === 'full' && p) for (const pc of p) place({ h: 0.5, x: 2, ch: VERTICAL[pc] ?? pc, k: 'p', seg: seg.id });
			for (const id of notes.get(i) ?? []) placeNote(id, seg.id);
		});
		if (!text.length) for (const [, id] of t.n ?? []) placeNote(id, seg.id);
	}
	if (col.cells.length) cols.push(col);
	return { cols, segCol, rows: R };
}

function headingNo(ch: Chapter, ed: Ed): string {
	const h = ch.heading[ed] ?? '';
	const m = h.match(/第.+$/);
	return m ? m[0] : '';
}

/** The segment shown at a column (for mapping a scroll position back to the text). */
export function segOfColumn(layout: Layout, i: number): string | undefined {
	for (let k = Math.min(i, layout.cols.length - 1); k >= 0; k--) {
		const c = layout.cols[k];
		const seg = c.cells.find((x) => x.seg)?.seg ?? c.segAt;
		if (seg) return seg;
	}
	return undefined;
}

export function segIndex(ch: Chapter): Map<string, Segment> {
	return new Map(ch.segs.map((s) => [s.id, s]));
}
