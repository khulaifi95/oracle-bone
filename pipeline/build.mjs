// Builds everything the interface reads into static/data/. Run with `npm run data`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildShijiChapter } from './text.mjs';
import { loadPlain, PARALLEL_BOOKS } from './plain.mjs';
import { buildBasemap } from './geo.mjs';
import { normChar, toTraditional } from './script.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'static/data');
const SHIJI = [
	{ juan: 7, title: '项羽本纪', t: '項羽本紀', kind: '本纪', n: '第七', era: 'ershi' },
	{ juan: 8, title: '高祖本纪', t: '高祖本紀', kind: '本纪', n: '第八', era: 'ershi' },
	{ juan: 48, title: '陈涉世家', t: '陳涉世家', kind: '世家', n: '第十八', era: 'ershi' },
	{ juan: 55, title: '留侯世家', t: '留侯世家', kind: '世家', n: '第二十五', era: 'han' },
	{ juan: 92, title: '淮阴侯列传', t: '淮陰侯列傳', kind: '列传', n: '第三十二', era: 'han' }
];
const JUAN_ZH = { 7: '卷七', 8: '卷八', 48: '卷四十八', 55: '卷五十五', 92: '卷九十二' };

const readJson = async (rel) => JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
async function write(rel, data) {
	const file = path.join(OUT, rel);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(data));
	console.log('wrote', rel, Math.round(JSON.stringify(data).length / 1024) + 'k');
}

// Characters that differ only by variant form are searched as one.
const SEARCH = { 阬: '坑', 闲: '间', 閒: '间', 度: '渡', 眛: '眜', 昧: '眜', 钜: '巨', 详: '佯' };
const key = (s) => [...s].filter((c) => !/[，。、；：？！「」『』《》〈〉（）\s]/.test(c)).map((c) => SEARCH[normChar(c)] ?? normChar(c)).join('');

// ---------------------------------------------------------------- tagging people and places
const VERB_AFTER = new Set([...'曰乃因遂亦欲使与为谓问对闻至入出见请遣从复已即既益自独素常尝少大怒笑喜恐令击引将归还走去行死']);
const PLACE_BEFORE = new Set([...'至入攻下守于居过还走屯军围拔击徇略之从出渡东西南北在都王']);

function makeMatcher(people, places, juan) {
	const entries = [];
	for (const p of people) {
		for (const a of p.aliases) entries.push({ a, type: 'person', ref: p.id, single: [...a].length === 1 });
		for (const a of p.local?.[String(juan)] ?? []) entries.push({ a, type: 'person', ref: p.id, single: [...a].length === 1 });
	}
	for (const p of places) {
		for (const a of [p.name, ...p.aliases]) entries.push({ a, type: 'place', ref: p.id, single: [...a].length === 1 });
	}
	const byFirst = new Map();
	for (const e of entries) {
		const k = [...e.a][0];
		if (!byFirst.has(k)) byFirst.set(k, []);
		byFirst.get(k).push(e);
	}
	for (const list of byFirst.values()) list.sort((x, y) => [...y.a].length - [...x.a].length);
	return (text) => {
		const chars = [...text];
		const tags = [];
		for (let i = 0; i < chars.length; ) {
			const cands = byFirst.get(chars[i]);
			let hit = null;
			for (const e of cands ?? []) {
				const a = [...e.a];
				if (a.some((c, k) => chars[i + k] !== c)) continue;
				if (e.single) {
					if (e.type === 'person' && !VERB_AFTER.has(chars[i + 1])) continue;
					if (e.type === 'place' && !PLACE_BEFORE.has(chars[i - 1])) continue;
				}
				hit = e;
				break;
			}
			if (hit) {
				const len = [...hit.a].length;
				tags.push([i, len, hit.type === 'person' ? 'p' : 'l', hit.ref]);
				i += len;
			} else i++;
		}
		return tags;
	};
}

// ---------------------------------------------------------------- dates in the text
const NUM = { 元: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 正: 1, 端: 1, 腊: 12 };
function zhNum(s) {
	if (s === '元' || s === '正' || s === '端') return 1;
	if (s === '腊') return 12;
	if (s.length === 1) return NUM[s];
	if (s[0] === '十') return 10 + (NUM[s[1]] ?? 0);
	if (s[1] === '十') return NUM[s[0]] * 10 + (NUM[s[2]] ?? 0);
	return null;
}
const MONTH_ORDER = (m) => (m >= 10 ? m - 10 : m + 3);
const DATE_RE = /(秦二世|二世皇帝|二世|汉之|汉王|汉|高祖|高帝|始皇帝|始皇)?([元一二三四五六七八九十]{1,3})年(?:(春|夏|秋|冬))?(?:(正|端|腊|后九|[一二三四五六七八九十]{1,2})月)?|(其|后|是|至|以)?(正|腊|后九|[一二三四五六七八九十]{1,2})月|(?<![一-龥])(春|夏|秋|冬)(?=[，。])/g;
const SEASON_MONTH = { 春: 1, 夏: 4, 秋: 7, 冬: 10 };

function dateScanner(defaultEra) {
	let era = defaultEra;
	let cur = null;
	return (text) => {
		const found = [];
		for (const m of text.matchAll(DATE_RE)) {
			const [all, eraWord, yearNum, season, month, monthPrefix, monthOnly, seasonOnly] = m;
			// Durations (「三年灭秦」「火三月不灭」) are not dates: a bare year or month must open the sentence.
			const opens = m.index === 0 || !!monthPrefix;
			if (yearNum) {
				if (!eraWord && !opens) continue;
				if (eraWord) era = /二世/.test(eraWord) ? 'ershi' : /始皇/.test(eraWord) ? 'shihuang' : 'han';
				const n = zhNum(yearNum);
				if (!n || (era === 'ershi' && n > 3) || (era === 'han' && n > 12) || (era === 'shihuang' && n > 37)) continue;
				const year = era === 'shihuang' ? -(246 - (n - 1)) : era === 'ershi' ? -209 + (n - 1) : -206 + (n - 1);
				const mm = month ? (month === '后九' ? 9 : zhNum(month)) : season ? SEASON_MONTH[season] : null;
				cur = { ey: year, m: mm };
				found.push({ at: m.index, text: all, ey: year, m: mm, era, n });
			} else if (monthOnly && cur && opens) {
				const mm = monthOnly === '后九' ? 9 : zhNum(monthOnly);
				if (!mm || mm > 12) continue;
				if (cur.m && MONTH_ORDER(mm) < MONTH_ORDER(cur.m)) cur = { ey: cur.ey + 1, m: mm };
				else cur = { ey: cur.ey, m: mm };
				found.push({ at: m.index, text: all, ey: cur.ey, m: mm, era });
			} else if (seasonOnly && cur && m.index === 0) {
				const mm = SEASON_MONTH[seasonOnly];
				if (cur.m && MONTH_ORDER(mm) < MONTH_ORDER(cur.m)) cur = { ey: cur.ey + 1, m: mm };
				else cur = { ey: cur.ey, m: mm };
				found.push({ at: m.index, text: all, ey: cur.ey, m: mm, era });
			}
		}
		return found;
	};
}

// ---------------------------------------------------------------- main
const people = (await readJson('data/people.json')).people;
const places = (await readJson('data/places.json')).places;
const events = (await readJson('data/events.json')).events;
const polities = (await readJson('data/polities.json')).years;
const editions = await readJson('data/editions.json');

const shijiIndex = {};
for (const ch of SHIJI) {
	const c = await buildShijiChapter(ch.juan);
	const match = makeMatcher(people, places, ch.juan);
	const scan = dateScanner(ch.era);
	const counts = {};
	for (const seg of c.segs) {
		for (const ed of ['d', 'j']) {
			const tags = match(seg[ed].s);
			if (tags.length) seg[ed].g = tags;
			if (ed === 'j') for (const [, , , ref] of tags) counts[ref] = (counts[ref] ?? 0) + 1;
		}
		const dates = scan(seg.j.s);
		if (dates.length) seg.dt = dates.map((d) => ({ ey: d.ey, m: d.m, x: d.text }));
	}
	const id = `shiji-${ch.juan}`;
	shijiIndex[id] = { segs: c.segs, paraText: new Map() };
	for (const s of c.segs) shijiIndex[id].paraText.set(s.para, (shijiIndex[id].paraText.get(s.para) ?? '') + s.j.s);
	await write(`text/${id}.json`, {
		id,
		book: 'shiji',
		juan: ch.juan,
		title: { s: ch.title, t: ch.t },
		heading: { d: c.titles.d, j: c.titles.j },
		header: c.header.map((h) => ({ s: h, t: toTraditional(h) })),
		segs: c.segs,
		notes: c.notes,
		variants: c.variants,
		mentions: counts,
		stats: c.stats
	});
	ch.stats = c.stats;
}

// Parallel books.
const plain = {};
for (const [book, info] of Object.entries(PARALLEL_BOOKS)) {
	for (const juan of Object.keys(info.chapters)) {
		const paras = await loadPlain(book, juan);
		const id = `${book}-${juan}`;
		plain[id] = paras;
		await write(`text/${id}.json`, {
			id,
			book,
			juan: Number(juan),
			title: { s: info.chapters[juan], t: toTraditional(info.chapters[juan]) },
			paras: paras.map((p) => ({ h: p.heading, s: p.s, t: p.t }))
		});
	}
}

// Resolve event accounts to paragraphs (and, in the 史記, to segment ranges).
const misses = [];
for (const e of events) {
	for (const a of e.accounts) {
		const findPara = (phrase) => {
			const k = key(phrase);
			if (a.ref.startsWith('shiji')) {
				for (const [p, s] of shijiIndex[a.ref].paraText) if (key(s).includes(k)) return p;
			} else for (const p of plain[a.ref] ?? []) if (key(p.s).includes(k)) return p.i;
			return -1;
		};
		const from = findPara(a.at);
		const to = a.to ? findPara(a.to) : from;
		if (from < 0 || to < 0) misses.push(`${e.id} ${a.ref} ${a.at}`);
		a.paras = [from, Math.max(from, to)];
		if (a.ref.startsWith('shiji') && from >= 0) {
			const segs = shijiIndex[a.ref].segs.filter((s) => s.para >= a.paras[0] && s.para <= a.paras[1]);
			a.segs = [segs[0].id, segs[segs.length - 1].id];
		}
		delete a.to;
	}
	e.t = toTraditional(e.title);
}
if (misses.length) {
	console.error('Unresolved event passages:\n' + misses.join('\n'));
	process.exitCode = 1;
}

const peopleOut = people.map((p) => ({ ...p, bioT: toTraditional(p.bio), t: p.t ?? toTraditional(p.name) }));
const placesOut = places.map((p) => ({ ...p, t: toTraditional(p.name) }));

await write('catalog.json', {
	books: {
		shiji: { title: '史记', t: '史記', chapters: SHIJI.map((c) => ({ id: `shiji-${c.juan}`, juan: c.juan, juanZh: JUAN_ZH[c.juan], title: c.title, t: c.t, kind: c.kind, n: c.n, stats: c.stats })) },
		...Object.fromEntries(
			Object.entries(PARALLEL_BOOKS).map(([b, info]) => [b, { title: info.title, t: info.t, chapters: Object.entries(info.chapters).map(([j, title]) => ({ id: `${b}-${j}`, juan: Number(j), title, t: toTraditional(title) })) }])
		)
	},
	editions
});
await write('people.json', peopleOut);
await write('places.json', placesOut);
await write('events.json', events);
await write('polities.json', polities);
await write('basemap.json', await buildBasemap());
