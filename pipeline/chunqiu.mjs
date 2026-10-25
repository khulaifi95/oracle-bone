// Parsers for the 春秋 sources: the punctuated 春秋左傳正義 and the 四庫 春秋左傳注疏 from
// Wikisource, and the 公羊 and 穀梁 經傳 read beside them.
import { parseTree, text } from './wikitext.mjs';
import { normChar } from './script.mjs';
import { zhNum } from './dates.mjs';

// The 魯 dukes: the Julian year of each one's 元年.
export const DUKES = { 隱: -722, 隐: -722, 桓: -711, 莊: -693, 庄: -693, 閔: -661, 闵: -661, 僖: -659, 文: -626 };
const YEAR_HEAD = /^(隱|隐|桓|莊|庄|閔|闵|僖|文)公(元|[一二三四五六七八九十有]+)年(經|傳)?$/;
export function yearOf(duke, n) {
	return DUKES[duke] + zhNum(n) - 1;
}

/** Join the lines of a template that runs over several lines. */
function joinLines(src) {
	const out = [];
	let open = '';
	for (const raw of src.split(/\n/)) {
		open = open ? open + raw : raw;
		const depth = (open.match(/\{\{/g) ?? []).length - (open.match(/\}\}/g) ?? []).length;
		if (depth > 0) continue;
		out.push(open);
		open = '';
	}
	if (open) out.push(open);
	return out;
}

const LABELS = [
	['【注】', 'du'],
	['【音義】', 'yinyi'],
	['【疏】', 'shu']
];
/** Split commentary text on its 【注】【音義】【疏】 labels. */
function labelled(s, fallback) {
	s = s.replace(/^[（(]|[）)]$/g, '').replace(/[\s　]+/g, '');
	const parts = [];
	let kind = fallback;
	let buf = '';
	for (let i = 0; i < s.length; ) {
		const hit = LABELS.find(([l]) => s.startsWith(l, i));
		if (hit) {
			if (buf) parts.push({ kind, text: buf, marks: [] });
			buf = '';
			kind = hit[1];
			i += hit[0].length;
			continue;
		}
		buf += s[i++];
	}
	if (buf) parts.push({ kind, text: buf, marks: [] });
	// 音義 starts with ○, a mark of the 釋文 entry, which reads better left out
	for (const p of parts) if (p.kind === 'yinyi') p.text = p.text.replace(/^○/, '');
	return parts.filter((p) => p.text);
}

/**
 * 春秋左傳正義 (Wikisource) → paragraphs of text and note tokens, like parseSanjiazhu.
 * Each text token carries k ('jing' or 'zhuan') and y (the Julian year).
 * Two transcription styles occur: 卷一 sets each phrase in {{++|經}} or {{+|傳}} with its notes
 * on lines of their own; later 卷 have plain lines with {{annotate|（【注】…【音義】…）}} inline and
 * 【疏】 paragraphs between the text.
 */
export function parseZhengyi(src) {
	const paragraphs = [];
	let k = null;
	let y = null;
	let started = false;
	let para = null;
	let afterShu = false;
	const newPara = () => {
		para = [];
		paragraphs.push(para);
	};
	const addText = (s) => {
		s = s.replace(/[\s　]+/g, '');
		if (!s) return;
		if (!para) newPara();
		const last = para[para.length - 1];
		if (last && last.t === 'text' && last.k === k && last.y === y) last.s += s;
		else para.push({ t: 'text', s, edits: [], k, y });
	};
	const addNote = (parts) => {
		if (!parts.length) return;
		if (!para) newPara();
		// notes at one point of the text are one note with several parts, as in the 注疏本
		const last = para[para.length - 1];
		if (last && last.t === 'note') last.parts.push(...parts);
		else para.push({ t: 'note', parts });
	};
	for (const raw of joinLines(src)) {
		const line = raw.trim();
		if (!line) continue;
		const h = line.match(/^==\s*(.+?)\s*==$/);
		if (h) {
			const head = text(parseTree(h[1])).trim();
			const m = head.match(YEAR_HEAD);
			if (m) {
				started = true;
				k = m[3] === '經' ? 'jing' : 'zhuan';
				y = yearOf(m[1], m[2]);
				para = null;
			} else if (/^(隱|隐|桓|莊|閔|僖|文)公$/.test(head)) {
				// the 傳 of 隱公 opens before its first year
				started = true;
				k = 'zhuan';
				y = DUKES[head[0]];
				para = null;
			}
			continue;
		}
		if (!started || line.startsWith('{{Header') || line.startsWith('|')) continue;
		if (line.startsWith('【疏】')) {
			addNote(labelled(line, 'shu'));
			afterShu = true;
			continue;
		}
		const tree = parseTree(line);
		// style of 卷一: the whole line is one template
		if (tree.length === 1 && typeof tree[0] === 'object' && ['++', '+', '~', 'annotate', '*'].includes(tree[0].tpl)) {
			const n = tree[0];
			const body = text(n.args[0] ?? []);
			if (n.tpl === '++' || n.tpl === '+') {
				// a new paragraph begins indented
				if (/^[\s　]{2}/.test(body) || !para) newPara();
				addText(body);
			} else addNote(labelled(body, n.tpl === '~' ? 'du' : n.tpl === 'annotate' ? 'yinyi' : 'shu'));
			continue;
		}
		// later style: 經 entries are each a paragraph; in the 傳 a 疏 does not end the paragraph
		if (!(k === 'zhuan' && afterShu)) newPara();
		afterShu = false;
		for (const n of tree) {
			if (typeof n === 'string') {
				// a label left in the plain text starts a note there
				const at = n.search(/【(注|音義|疏)】/);
				if (at < 0) addText(n);
				else {
					addText(n.slice(0, at));
					addNote(labelled(n.slice(at), 'du'));
				}
			}
			else if (n.tpl === 'annotate' || n.tpl === '~' || n.tpl === '*') addNote(labelled(text(n.args[0] ?? []), n.tpl === '*' ? 'shu' : 'du'));
			else addText(text([n]));
		}
	}
	return { title: '', headings: [], paragraphs: paragraphs.filter((p) => p.length) };
}

// ---------------------------------------------------------------- 四庫 注疏
/** A missing glyph ({{SKchar|n}}) as a private-use character, restored later from the other edition. */
export const skChar = (code) => String.fromCodePoint(0xf0000 + Number(code));
export const isSkChar = (c) => c.codePointAt(0) >= 0xf0000;

/** Flatten SKQS wikitext to text, with SK notes as {note} markers. */
function skNodes(nodes, out = []) {
	for (const n of nodes) {
		if (typeof n === 'string') out.push(...[...n.replace(/[\s　]+/g, '')]);
		else if (n.tpl === 'SKchar') out.push(skChar(text(n.args[0] ?? [])));
		else if (n.tpl === 'SK notes') out.push({ note: skNodes(n.args[0] ?? []).filter((x) => typeof x === 'string').join('') });
		else if (n.tpl === 'SK anchor' || n.tpl === 'YL') skNodes(n.args[0] ?? [], out);
	}
	return out;
}

/**
 * 春秋左傳注疏 (四庫全書本) → the full inline character stream, with 注 still inline
 * (the transcription marks only its start, with 注), and the 音義 and 疏 as notes at their
 * points. Also returns the 考證.
 */
export function parseZhushu(src) {
	const poem = src.match(/<poem>([\s\S]*?)<\/poem>/)?.[1] ?? src;
	const lines = poem.split('\n').map((l) => l.trim()).filter(Boolean);
	const titleAt = lines.findIndex((l) => /注疏卷/.test(l));
	// the title line spells 傳 with a missing glyph in some 卷: that glyph also marks 傳 in the text
	const titleChars = skNodes(parseTree(lines[titleAt]));
	const markers = new Set(['經', '傳']);
	const zhuanGlyph = titleChars[3];
	if (typeof zhuanGlyph === 'string' && isSkChar(zhuanGlyph)) markers.add(zhuanGlyph);
	const end = lines.findIndex((l, i) => i > titleAt && /^\{\{SK anchor\|春秋左傳注疏卷[^}]*\}\}$/.test(l));
	const kzHead = lines.findIndex((l) => /考証$|考證$/.test(text(parseTree(l))));
	const body = lines.slice(titleAt + 2, end < 0 ? kzHead : end);

	const chars = []; // {c, line, marker?, notes: [{kind, raw}]}
	body.forEach((line, li) => {
		const items = skNodes(parseTree(line));
		const inline = items.filter((x) => typeof x === 'string').join('');
		// a line naming the duke alone (隱公) heads the 卷 and has no counterpart in the 正義
		if (/^.公(疏|音義)*$/.test(inline)) return;
		items.forEach((x, i) => {
			if (typeof x === 'string') {
				chars.push({ c: x, line: li, first: i === 0, notes: [] });
				return;
			}
			// the label of a note is written just before it in the text
			let kind = 'shu';
			const tail = chars.slice(-2).map((c) => c.c).join('');
			if (tail === '音義') {
				kind = 'yinyi';
				chars.splice(-2);
			} else if (chars.at(-1)?.c === '疏') {
				chars.pop();
			}
			const host = chars.at(-1);
			if (host) host.notes.push({ kind, raw: x.note });
		});
	});
	for (const c of chars) if (c.first && markers.has(c.c)) c.marker = true;

	const kaozheng = [];
	for (const line of kzHead < 0 ? [] : lines.slice(kzHead + 1)) {
		const s = skNodes(parseTree(line))
			.map((x) => (typeof x === 'string' ? x : x.note))
			.join('');
		if (!s || /考証$|考證$/.test(s) || s.startsWith('<')) continue;
		const cut = s.indexOf('○');
		if (cut < 0) continue;
		const cite = s.slice(0, cut);
		let lemma = cite.replace(/^[經傳]/, '');
		const at = lemma.search(/注|疏|音義/);
		if (at > 0) lemma = lemma.slice(0, at);
		kaozheng.push({ lemma, cite, text: s.slice(cut + 1).replace(/○/g, '　') });
	}
	return { chars, kaozheng };
}

// ---------------------------------------------------------------- 公羊 and 穀梁
/**
 * The 公羊 or 穀梁 page of one duke → years of entries [{y, jing, zhuan}]. Where the page
 * sets the 傳 in {{*|}} after each 經 the two are given apart; where it runs them together, the
 * 經 is found later by matching against the 左氏 經 (see matchSanzhuan).
 */
export function parseSanzhuanPage(src) {
	const entries = [];
	let y = null;
	for (const raw of joinLines(src)) {
		const line = raw.trim();
		const h = line.match(/^==\s*(.+?)\s*==$/);
		if (h) {
			// some pages write twenty and thirty as 廿 and 卅
			const m = text(parseTree(h[1])).trim().replace(/廿/g, '二十').replace(/卅/g, '三十').match(YEAR_HEAD);
			if (m) y = yearOf(m[1], m[2]);
			continue;
		}
		if (y == null || !line || line.startsWith('[[') || line.startsWith('{{header') || line.startsWith('----') || line.startsWith('<')) continue;
		const tree = parseTree(line);
		const note = tree.find((n) => typeof n === 'object' && n.tpl === '*');
		const jing = text(tree.filter((n) => typeof n === 'string' || n.tpl !== '*')).replace(/[\s　]+/g, '');
		if (!jing) continue;
		entries.push({ y, jing, zhuan: note ? text(note.args[0] ?? []).replace(/[\s　]+/g, '') : null, split: !!note });
	}
	return entries;
}

const bare = (s) => [...s].filter((c) => !/[，。、；：？！「」『』《》〈〉（）—\s]/.test(c)).map(normChar);
function similarity(a, b) {
	const A = bare(a);
	const B = bare(b);
	if (!A.length || !B.length) return 0;
	const count = new Map();
	for (const c of A) count.set(c, (count.get(c) ?? 0) + 1);
	let n = 0;
	for (const c of B) if (count.get(c)) (n++, count.set(c, count.get(c) - 1));
	return n / Math.max(A.length, B.length);
}

/** For each 左氏 經 entry, the 公羊 or 穀梁 entry of the same year that reads most like it. */
export function matchSanzhuan(zuoEntries, pageEntries) {
	const out = new Map();
	const used = new Set();
	for (const z of zuoEntries) {
		let best = null;
		for (const [i, e] of pageEntries.entries()) {
			if (e.y !== z.y || used.has(i)) continue;
			let jing = e.jing;
			let zhuan = e.zhuan;
			if (!e.split) {
				// 經 and 傳 run together: the 經 is the run of sentences that reads most like the 左氏 經
				const cuts = [...e.jing.matchAll(/。/g)].map((m) => m.index + 1).slice(0, 4);
				let bestCut = cuts[0] ?? e.jing.length;
				let bestSim = -1;
				for (const cut of cuts) {
					const sim = similarity(z.text, e.jing.slice(0, cut));
					if (sim > bestSim + 0.02) (bestSim = sim), (bestCut = cut);
				}
				jing = e.jing.slice(0, bestCut);
				zhuan = e.jing.slice(bestCut) || null;
			}
			const sim = similarity(z.text, jing);
			if (sim >= 0.45 && (!best || sim > best.sim)) best = { i, sim, jing, zhuan };
		}
		if (best) {
			used.add(best.i);
			out.set(z.seg, { jing: best.jing, zhuan: best.zhuan });
		}
	}
	return out;
}

export { similarity };
