// Builds one 史記 chapter: two editions aligned segment by segment, with punctuation,
// commentary, 異文 and the 點校 marks.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { diffArrays } from 'diff';
import { parseSanjiazhu } from './wikitext.mjs';
import { parseSiku, splitNote, QUEBI, isPUA, fixPUA } from './siku.mjs';
import { normChar, toSimplified, toTraditional, PUNCT_AFTER, PUNCT_BEFORE } from './script.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PLACEHOLDER = new Set(['防', '□', '�']);
const isPlaceholder = (c) => PLACEHOLDER.has(c) || isPUA(c);
// Kinds of difference between the editions. 'form': variant glyphs of one word (異體字);
// 'taboo': the Qing 殿本 avoiding an emperor's or Confucius' name (避諱); 'graphic': look-alike
// characters, often a transcription slip; 'text': a real textual variant (異文).
const GRAPHIC = ['己已巳', '曰日', '未末', '士土', '戊戌戍', '人入', '刺剌', '汨汩', '母毋', '决快', '起午', '荣荥', '泛汜', '昧眛'];
const FORMS = ['间闲閒', '奈柰', '钜巨', '巵卮', '羙美', '舎舍', '寳宝', '禆裨', '諌谏', '恱说悦', '扫埽', '禝稷', '釡釜', '爼俎',
	'鄊乡', '畨番', '聼听', '匝帀', '羮羹', '只祇', '輙辄', '刼劫', '苖苗', '郤却', '毫豪', '瞠瞋', '强彊', '阬坑', '鉅巨',
	'于於', '迺乃', '亡无', '鑪炉', '脩修', '嚮向', '缐线', '藉借', '沈沉', '蚤早', '飡餐', '馀余', '徧遍', '僊仙', '谿溪',
	'磨摩', '帖贴', '鴈雁', '鬭斗', '睢雎', '卮巵', '筴策', '筞策', '効效', '隷隶', '晳皙', '旂旗', '蔿蒍', '胷胸', '凾函',
	'乆久', '杰桀', '圗图', '貎貌', '廐厩', '胷匈', '佣庸', '弊獘', '亨烹', '臈腊', '岀出', '辨辩', '禇褚', '最冣', '觧解',
	'鬪斗', '皓晧', '着著', '镒溢', '戯戏', '塲场', '邉边', '寜宁', '綘绛', '兎兔', '杂襍', '熟孰', '戮勠', '袴胯', '局跼',
	'阵陈', '凖准', '劵券', '妬妒', '陜陕', '罢獘', '睂眉', '虚墟', '墬地', '凖準', '蔾藜', '雝雍', '頴颍', '颕颍'];
const VERTICAL_PUNCT = { '︰': '：', '︓': '：', '︐': '，', '︑': '、', '︒': '。', '︔': '；', '︕': '！', '︖': '？' };
const TABOO = [['邱', '丘'], ['元', '玄'], ['宏', '弘'], ['', '玄'], ['歴', '曆'], ['厯', '曆']];
function kindOf(a, b) {
	if (TABOO.some(([x, y]) => a === x && b === y)) return 'taboo';
	if (a.length === 1 && b.length === 1) {
		if (GRAPHIC.some((g) => g.includes(a) && g.includes(b))) return 'graphic';
		if (FORMS.some((g) => g.includes(a) && g.includes(b))) return 'form';
	}
	if (a.length === b.length && a.length > 1 && [...a].every((c, i) => c === [...b][i] || FORMS.some((g) => g.includes(c) && g.includes([...b][i])))) return 'form';
	return 'text';
}

/** Character stream of the 金陵本 (Wikisource 史記三家註), 底本 readings. */
function jinlingStream(parsed) {
	const chars = [];
	const notes = [];
	let pendingBefore = '';
	let pendingNotes = [];
	parsed.paragraphs.forEach((para, pi) => {
		for (const tok of para) {
			if (tok.t === 'note') {
				const id = `j${notes.length}`;
				notes.push({ id, parts: tok.parts.map((p) => ({ k: p.kind, t: p.text, marks: p.marks })) });
				const last = chars[chars.length - 1];
				if (last && last.para === pi) last.notes.push(id);
				else pendingNotes.push(id);
				continue;
			}
			const edits = [...tok.edits];
			let pos = 0;
			for (const c0 of tok.s) {
				// vertical presentation forms in the transcription are ordinary punctuation
				const c = VERTICAL_PUNCT[c0] ?? c0;
				const here = edits.filter((e) => e.at === pos);
				pos++;
				if (PUNCT_BEFORE.has(c)) {
					pendingBefore += c;
					continue;
				}
				if (PUNCT_AFTER.has(c)) {
					const last = chars[chars.length - 1];
					if (last) last.after += c;
					continue;
				}
				const ch = { c, para: pi, before: pendingBefore, after: '', notes: [], notesBefore: pendingNotes, edits: [] };
				for (const e of here) ch.edits.push(e);
				pendingBefore = '';
				pendingNotes = [];
				chars.push(ch);
			}
			// An 增 at the very end of a text run attaches to the last character.
			for (const e of edits.filter((e) => e.at >= tok.s.length)) chars[chars.length - 1]?.edits.push({ ...e, end: true });
		}
	});
	// Mark the characters covered by a 刪 edit.
	for (let i = 0; i < chars.length; i++) {
		for (const e of chars[i].edits) {
			if (e.type !== 'del') continue;
			let left = [...e.text].filter((c) => !PUNCT_AFTER.has(c) && !PUNCT_BEFORE.has(c)).length;
			for (let k = i; left > 0 && k < chars.length; k++, left--) chars[k].del = true;
		}
	}
	return { chars, notes };
}

/** Character stream of the 四庫/殿本 text. */
function sikuStream(parsed) {
	const chars = [];
	const notes = [];
	for (const tok of parsed.tokens) {
		if (tok.t === 'note') {
			const id = `d${notes.length}`;
			notes.push({ id, raw: fixPUA(tok.raw) });
			if (chars.length) chars[chars.length - 1].notes.push(id);
			continue;
		}
		for (const c of tok.s) chars.push(QUEBI[c] ? { c: QUEBI[c], notes: [], quebi: true } : { c, notes: [] });
	}
	return { chars, notes };
}

/** Align two strings by normalised characters; returns per-index maps and changed regions. */
export function align(aChars, bChars) {
	const parts = diffArrays(aChars.map(normChar), bChars.map(normChar));
	const aToB = new Array(aChars.length).fill(-1);
	const bToA = new Array(bChars.length).fill(-1);
	const aBefore = new Array(bChars.length + 1).fill(0); // A chars before each B index
	const regions = [];
	let a = 0;
	let b = 0;
	let open = null;
	const close = () => {
		if (open) regions.push(open);
		open = null;
	};
	for (const p of parts) {
		if (!p.added && !p.removed) {
			close();
			for (let k = 0; k < p.count; k++) {
				aToB[a] = b;
				bToA[b] = a;
				aBefore[b] = a;
				a++;
				b++;
			}
		} else if (p.removed) {
			open ??= { a0: a, a1: a, b0: b, b1: b };
			a += p.count;
			open.a1 = a;
		} else {
			open ??= { a0: a, a1: a, b0: b, b1: b };
			for (let k = 0; k < p.count; k++) aBefore[b++] = a;
			open.b1 = b;
		}
	}
	close();
	aBefore[bChars.length] = a;
	return { aToB, bToA, aBefore, regions };
}

/** Traditional form of a simplified string, borrowing characters from an aligned traditional text. */
function tradVia(sText, tRef) {
	const s = [...sText];
	if (!tRef) return toTraditional(sText);
	const t = [...tRef];
	const { aToB } = align(s, t);
	const fallback = [...toTraditional(sText)];
	return s.map((c, i) => (aToB[i] >= 0 ? t[aToB[i]] : fallback[i])).join('');
}

const SENTENCE_END = /[。？！]/;

export async function buildShijiChapter(juan) {
	const n = String(juan).padStart(3, '0');
	const wiki = await readFile(path.join(ROOT, 'sources/wikisource', `shiji-${n}.wiki`), 'utf8');
	const siku = await readFile(path.join(ROOT, 'sources/siku', `shiji-${n}.txt`), 'utf8');
	const J = jinlingStream(parseSanjiazhu(wiki));
	const sikuParsed = parseSiku(siku);
	const D = sikuStream(sikuParsed);

	const bChars = J.chars.map((c) => c.c);
	let aChars = D.chars.map((c) => c.c);
	const al = align(aChars, bChars);

	// Restore placeholder glyphs in the 四庫 transcription from the aligned 金陵本 text.
	const restored = new Set();
	const variants = [];
	for (const r of al.regions) {
		const aSeg = aChars.slice(r.a0, r.a1);
		if (aSeg.length && aSeg.length === r.b1 - r.b0 && aSeg.some(isPlaceholder)) {
			// same length: put the 金陵本 character in place of each placeholder; what still
			// differs afterwards is a real variant
			for (let k = 0; k < aSeg.length; k++) {
				if (!isPlaceholder(aSeg[k])) continue;
				aChars[r.a0 + k] = toSimplified(bChars[r.b0 + k]);
				restored.add(r.a0 + k);
			}
			const same = aSeg.every((c, k) => isPlaceholder(c) || normChar(c) === normChar(toSimplified(bChars[r.b0 + k])));
			for (let k = 0; k < aSeg.length; k++) {
				al.aToB[r.a0 + k] = r.b0 + k;
				al.bToA[r.b0 + k] = r.a0 + k;
			}
			if (same) continue;
		}
		variants.push(r);
	}

	// Segments follow the 點校 sentence punctuation of the 金陵本 text.
	const segs = [];
	let start = 0;
	for (let i = 0; i < J.chars.length; i++) {
		const ch = J.chars[i];
		const next = J.chars[i + 1];
		const paraEnd = !next || next.para !== ch.para;
		const long = i - start >= 60 && /[；：]/.test(ch.after);
		if (paraEnd || SENTENCE_END.test(ch.after) || long) {
			segs.push({ b0: start, b1: i + 1, para: ch.para });
			start = i + 1;
		}
	}
	const paraCount = {};
	for (const s of segs) {
		paraCount[s.para] = (paraCount[s.para] ?? 0) + 1;
		s.id = `${juan}.${s.para + 1}.${paraCount[s.para]}`;
		s.a0 = al.aBefore[s.b0];
		s.a1 = s.b1 >= J.chars.length ? aChars.length : al.aBefore[s.b1];
	}
	const segOfB = new Array(J.chars.length);
	segs.forEach((s, si) => {
		for (let b = s.b0; b < s.b1; b++) segOfB[b] = si;
	});
	const segOfA = new Array(aChars.length);
	segs.forEach((s, si) => {
		for (let a = s.a0; a < s.a1; a++) segOfA[a] = si;
	});

	// Simplified / traditional forms.
	const bS = [...toSimplified(bChars.join(''))];
	const aS = aChars.map((c, i) => (restored.has(i) ? c : isPUA(c) ? '〓' : normChar(c)));
	const aTfallback = [...toTraditional(aS.join(''))];
	// traditional forms of the 殿本 text come from the aligned 金陵本 character where the two agree
	const aT = aS.map((c, i) => {
		const b = al.aToB[i] >= 0 ? bChars[al.aToB[i]] : null;
		return b && normChar(toSimplified(b)) === normChar(c) ? b : aTfallback[i];
	});

	// Notes of the 金陵本.
	const jNotes = {};
	for (const note of J.notes) {
		jNotes[note.id] = { parts: note.parts.map((p) => ({ k: p.k, s: toSimplified(p.t), t: p.t })) };
	}
	// Notes of the 四庫/殿本, labelled and traditionalised with help from the aligned 金陵本 notes.
	const dNotes = {};
	const noteAt = new Map();
	D.chars.forEach((c, a) => {
		for (const id of c.notes) noteAt.set(id, a);
	});
	for (const note of D.notes) {
		const a = noteAt.get(note.id) ?? 0;
		let b = al.aToB[a];
		for (let k = a; b < 0 && k >= 0; k--) b = al.aToB[k];
		const ref = b >= 0 ? J.chars[b].notes.map((id) => jNotes[id]) : [];
		const refParts = ref.flatMap((x) => x.parts);
		const suoyinStarts = refParts.filter((p) => p.k === 'suoyin').map((p) => p.s.replace(/[，。、；：？！「」『』《》]/g, '').slice(0, 4));
		const refText = refParts.map((p) => p.t.replace(/[，。、；：？！「」『』《》〈〉（）　]/g, '')).join('');
		dNotes[note.id] = {
			parts: splitNote(note.raw, suoyinStarts).map((p) => {
				const s = [...p.text].map(normChar).join('');
				return { k: p.kind, s, t: tradVia(s, refText) };
			})
		};
	}
	// 殿本考證, anchored after its lemma.
	const aKeys = aS;
	const indexOf = (sub, from = 0) => {
		outer: for (let i = from; i + sub.length <= aKeys.length; i++) {
			for (let k = 0; k < sub.length; k++) if (aKeys[i + k] !== sub[k]) continue outer;
			return i;
		}
		return -1;
	};
	let searchFrom = 0;
	const kaozheng = [];
	for (const kz of sikuParsed.kaozheng) {
		const lemma = [...kz.lemma].map(normChar);
		let pos = -1;
		for (let len = lemma.length; len >= 3 && pos < 0; len--) {
			const probe = lemma.slice(lemma.length - len);
			pos = indexOf(probe, searchFrom);
			if (pos < 0) pos = indexOf(probe);
			if (pos >= 0) pos += probe.length - 1;
		}
		if (pos < 0) pos = indexOf(lemma.slice(0, 3));
		const id = `k${kaozheng.length}`;
		const cite = [...kz.cite].map(normChar).join('');
		const s = [...kz.text].map(normChar).join('');
		dNotes[id] = { parts: [{ k: 'kaozheng', s: `${cite}　${s}`, t: toTraditional(`${cite}　${s}`) }] };
		kaozheng.push(id);
		if (pos >= 0) {
			D.chars[pos].notes.push(id);
			searchFrom = pos;
		} else D.chars[D.chars.length - 1].notes.push(id);
	}

	// Variant records.
	const vars = [];
	for (const r of variants) {
		const a = aS.slice(r.a0, r.a1).join('');
		const b = bS.slice(r.b0, r.b1).join('');
		if (a === b) continue;
		// text only in 殿本 belongs with the sentence it follows
		const at = r.b0 === r.b1 && r.b0 > 0 ? r.b0 - 1 : r.b0;
		const si = at < J.chars.length ? segOfB[Math.min(at, J.chars.length - 1)] : segs.length - 1;
		vars.push({
			id: `v${vars.length}`,
			seg: segs[si].id,
			d: { s: a, t: aT.slice(r.a0, r.a1).join('') },
			j: { s: b, t: bChars.slice(r.b0, r.b1).join('') },
			kind: kindOf(a, b),
			r
		});
	}

	// Per-segment edition records.
	const out = segs.map((s) => ({ id: s.id, para: s.para, d: rec('d', s), j: rec('j', s) }));
	function rec(ed, s) {
		const isD = ed === 'd';
		const i0 = isD ? s.a0 : s.b0;
		const i1 = isD ? s.a1 : s.b1;
		const r = { s: '', t: '', p: [], q: [], n: [], v: [], e: [], x: [], b: [] };
		r.s = (isD ? aS : bS).slice(i0, i1).join('');
		r.t = (isD ? aT : bChars).slice(i0, i1).join('');
		for (let i = i0; i < i1; i++) {
			const k = i - i0;
			const b = isD ? al.aToB[i] : i;
			if (b >= 0) {
				const jc = J.chars[b];
				if (jc.after) r.p.push([k, jc.after]);
				if (jc.before) r.q.push([k, jc.before]);
			}
			if (isD) {
				for (const id of D.chars[i].notes) r.n.push([k, id]);
				if (restored.has(i)) r.x.push(k);
				if (D.chars[i].quebi) r.b.push(k);
			} else {
				const jc = J.chars[i];
				for (const id of jc.notesBefore) r.n.push([k - 1, id]);
				for (const id of jc.notes) r.n.push([k, id]);
				if (jc.del) r.e.push([k, 1, 'del']);
				for (const e of jc.edits) if (e.type === 'add') r.e.push([e.end ? k : k - 1, 0, 'add', e.text]);
			}
		}
		for (const v of vars) {
			const a0 = isD ? v.r.a0 : v.r.b0;
			const a1 = isD ? v.r.a1 : v.r.b1;
			if (a0 >= i0 && a0 <= i1 && (a0 < i1 || a1 === a0) && v.seg === s.id) r.v.push([a0 - i0, a1 - a0, v.id]);
		}
		for (const key of Object.keys(r)) if (Array.isArray(r[key]) && !r[key].length) delete r[key];
		return r;
	}
	for (const v of vars) delete v.r;

	return {
		segs: out,
		notes: { d: dNotes, j: jNotes },
		variants: vars,
		header: sikuParsed.header,
		titles: { d: sikuParsed.title, j: parseSanjiazhu(wiki).title },
		stats: {
			chars: { d: aChars.length, j: bChars.length },
			aligned: al.aToB.filter((x) => x >= 0).length,
			restored: restored.size,
			variants: vars.length,
			quebi: D.chars.filter((c) => c.quebi).length,
			kinds: vars.reduce((m, v) => ((m[v.kind] = (m[v.kind] ?? 0) + 1), m), {}),
			notes: { d: D.notes.length, j: J.notes.length },
			kaozheng: kaozheng.length
		}
	};
}
