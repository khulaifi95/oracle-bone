// Builds everything the interface reads into static/data/. Run with `npm run data`.
// Each reading book is described in pipeline/books/<book>.mjs and has its hand-compiled
// data (people, places, events, states by year) in data/<book>/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadPlain, PARALLEL_BOOKS, BOOK_NAMES } from './plain.mjs';
import { buildBasemap } from './geo.mjs';
import { normChar, toSimplified, toTraditional } from './script.mjs';
import * as shiji from './books/shiji.mjs';
import * as sanguozhi from './books/sanguozhi.mjs';
import * as chunqiu from './books/chunqiu.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'static/data');
const BOOKS = [shiji, sanguozhi, chunqiu];
const only = process.env.BOOK ? new Set(process.env.BOOK.split(',')) : null;

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

// ---------------------------------------------------------------- the parallel books
const plain = {};
const plainIndex = {};
for (const [book, info] of Object.entries(PARALLEL_BOOKS)) {
	for (const [juan, title] of Object.entries(info.chapters)) {
		const paras = await loadPlain(book, juan);
		const id = `${book}-${juan}`;
		plain[id] = paras;
		plainIndex[id] = { book, juan: parseInt(juan), title, t: toTraditional(title) };
		await write(`text/${id}.json`, {
			id,
			book,
			juan: parseInt(juan),
			title: { s: title, t: toTraditional(title) },
			paras: paras.map((p) => ({ h: p.heading, s: p.s, t: p.t }))
		});
	}
}

// ---------------------------------------------------------------- the reading books
const GRAM = 4;
const gramsOf = (s) => {
	const c = [...key(s)];
	const g = new Set();
	for (let i = 0; i + GRAM <= c.length; i++) g.add(c.slice(i, i + GRAM).join(''));
	return g;
};
const shared = (g, base) => {
	let n = 0;
	for (const x of g) if (base.has(x)) n++;
	return { n, r: g.size ? n / g.size : 0 };
};
// a neighbour joins an account when a quarter of its wording is in the reference; a new account needs more
const joins = ({ n, r }) => n >= 12 && r >= 0.25;
const starts = ({ n, r }) => n >= 30 && r >= 0.3;

const catalogBooks = {};
const periods = new Set();
for (const B of BOOKS) {
	const id = B.book.id;
	const dir = `data/${id}`;
	const people = (await readJson(`${dir}/people.json`)).people;
	const places = (await readJson(`${dir}/places.json`)).places;
	const events = (await readJson(`${dir}/events.json`)).events;
	const polities = (await readJson(`${dir}/polities.json`)).years;
	const editions = await readJson(`${dir}/editions.json`);
	const portraits = await readJson(`${dir}/portraits.json`).catch(() => ({}));
	periods.add(B.book.map.period);

	// Chapters: text, tags, dates.
	const index = {};
	const chapterInfo = [];
	for (const c of B.chapters) {
		const chId = `${id}-${c.juan}`;
		if (only && !only.has(id)) {
			// keep what was built before
			const prev = await readJson(`static/data/text/${chId}.json`);
			index[chId] = { segs: prev.segs, paraText: new Map() };
			for (const s of prev.segs) index[chId].paraText.set(s.para, (index[chId].paraText.get(s.para) ?? '') + s.j.s);
			chapterInfo.push({ ...c, stats: prev.stats });
			continue;
		}
		const built = await B.buildChapter(c);
		const match = makeMatcher(people, places, c.juan);
		const scan = B.dateScanner(c);
		const counts = {};
		for (const seg of built.segs) {
			for (const ed of ['d', 'j']) {
				const tags = match(seg[ed].s);
				if (tags.length) seg[ed].g = tags;
				if (ed === 'j') for (const [, , , ref] of tags) counts[ref] = (counts[ref] ?? 0) + 1;
			}
			const dates = scan(seg);
			if (dates.length) seg.dt = dates.map((d) => ({ ey: d.ey, m: d.m, x: d.x }));
		}
		index[chId] = { segs: built.segs, paraText: new Map() };
		for (const s of built.segs) index[chId].paraText.set(s.para, (index[chId].paraText.get(s.para) ?? '') + s.j.s);
		await write(`text/${chId}.json`, {
			id: chId,
			book: id,
			juan: c.juan,
			title: { s: c.title, t: c.t },
			heading: { d: built.titles.d, j: built.titles.j },
			header: built.header.map((h) => ({ s: toSimplified(h), t: toTraditional(h) })),
			...(B.book.subheadings && built.sub?.length > 1 ? { sub: built.sub.map(([seg, h]) => ({ seg, s: normHeading(h), t: h })) } : {}),
			segs: built.segs,
			notes: built.notes,
			variants: built.variants,
			mentions: counts,
			stats: built.stats
		});
		for (const extra of built.extra ?? []) await write(extra.file, extra.data);
		chapterInfo.push({ ...c, stats: built.stats });
	}

	// Resolve event accounts to paragraphs (and, in the reading book, to segment ranges).
	const misses = [];
	const segsOf = (ref, [p0, p1]) => {
		const segs = index[ref].segs.filter((s) => s.para >= p0 && s.para <= p1);
		return [segs[0].id, segs[segs.length - 1].id];
	};
	for (const e of events) {
		for (const a of e.accounts) {
			const findPara = (phrase) => {
				const k = key(phrase);
				if (index[a.ref]) {
					for (const [p, s] of index[a.ref].paraText) if (key(s).includes(k)) return p;
				} else for (const p of plain[a.ref] ?? []) if (key(p.s).includes(k)) return p.i;
				return -1;
			};
			const from = findPara(a.at);
			const to = a.to ? findPara(a.to) : from;
			if (from < 0 || to < 0) misses.push(`${e.id} ${a.ref} ${a.at}`);
			a.paras = [from, Math.max(from, to)];
			if (index[a.ref] && from >= 0) a.segs = segsOf(a.ref, a.paras);
			delete a.to;
		}
		e.t = toTraditional(e.title);
	}
	if (misses.length) {
		console.error(`Unresolved event passages in ${id}:\n` + misses.join('\n'));
		process.exitCode = 1;
	}

	// Match the parallel accounts by wording. The hand anchors fix one sentence of each account;
	// the accounts in the reading book then serve as the reference text. Each account is widened
	// over the neighbouring paragraphs that share enough wording with the reference, and paragraphs
	// elsewhere that retell the same passage are added as accounts of their own (marked `auto`).
	const parallelIds = B.book.parallels.chapters;
	const paraGrams = {};
	for (const [cid, ix] of Object.entries(index)) paraGrams[cid] = [...ix.paraText.keys()].sort((x, y) => x - y).map((p) => gramsOf(ix.paraText.get(p)));
	for (const pid of parallelIds) paraGrams[pid] = plain[pid].map((p) => gramsOf(p.s));
	let widened = 0;
	let added = 0;
	for (const e of events) {
		const reference = (except) => {
			const base = new Set();
			for (const a of e.accounts)
				if (index[a.ref] && a.ref !== except && a.paras[0] >= 0) for (let p = a.paras[0]; p <= a.paras[1]; p++) for (const g of paraGrams[a.ref][p]) base.add(g);
			return base;
		};
		const covered = new Set(e.accounts.flatMap((a) => Array.from({ length: a.paras[1] - a.paras[0] + 1 }, (_, k) => `${a.ref}:${a.paras[0] + k}`)));
		const widen = (a, base) => {
			const pg = paraGrams[a.ref];
			if (!pg) return;
			const before = a.paras.join();
			while (a.paras[0] > 0 && !covered.has(`${a.ref}:${a.paras[0] - 1}`) && joins(shared(pg[a.paras[0] - 1], base))) covered.add(`${a.ref}:${--a.paras[0]}`);
			while (a.paras[1] < pg.length - 1 && !covered.has(`${a.ref}:${a.paras[1] + 1}`) && joins(shared(pg[a.paras[1] + 1], base))) covered.add(`${a.ref}:${++a.paras[1]}`);
			if (a.paras.join() !== before) widened++;
			if (index[a.ref]) a.segs = segsOf(a.ref, a.paras);
		};
		for (const a of [...e.accounts]) {
			const base = reference(a.ref);
			if (base.size && a.paras[0] >= 0) widen(a, base);
		}
		for (const [ref, pg] of Object.entries(paraGrams)) {
			const base = reference(ref);
			if (!base.size) continue;
			pg.forEach((g, p) => {
				if (covered.has(`${ref}:${p}`) || !starts(shared(g, base))) return;
				const a = { ref, at: '', paras: [p, p], auto: true };
				covered.add(`${ref}:${p}`);
				widen(a, base);
				e.accounts.push(a);
				added++;
			});
		}
		const order = [id, ...B.book.parallels.books];
		const bookOf = (r) => (index[r] ? id : plainIndex[r]?.book);
		const juanOf = (r) => parseFloat(r.split('-')[1]);
		e.accounts.sort((x, y) => order.indexOf(bookOf(x.ref)) - order.indexOf(bookOf(y.ref)) || juanOf(x.ref) - juanOf(y.ref) || x.paras[0] - y.paras[0]);
	}
	console.log(`${id} parallels: ${widened} accounts widened, ${added} found by wording`);
	if (process.env.PARALLEL_REPORT)
		for (const e of events)
			for (const a of e.accounts) if (a.auto) console.log(`  + ${e.id} ${a.ref} p${a.paras[0]}-${a.paras[1]} ${(plain[a.ref]?.[a.paras[0]].s ?? index[a.ref].paraText.get(a.paras[0])).slice(0, 30)}`);

	const peopleOut = people.map((p) => ({
		...p,
		bioT: toTraditional(p.bio),
		t: p.t ?? toTraditional(p.name),
		...(portraits[p.id]?.image ? { portrait: { image: portraits[p.id].image, source: portraits[p.id].source, page: portraits[p.id].page } } : {})
	}));
	const placesOut = places.map((p) => ({ ...p, t: toTraditional(p.name) }));
	await write(`${id}/people.json`, peopleOut);
	await write(`${id}/places.json`, placesOut);
	await write(`${id}/events.json`, events);
	await write(`${id}/polities.json`, polities);

	catalogBooks[id] = {
		...B.book,
		chapters: chapterInfo.map((c) => ({ id: `${id}-${c.juan}`, juan: c.juan, juanZh: c.juanZh, title: c.title, t: c.t, kind: c.kind, n: c.n, court: c.court, stats: c.stats })),
		editions
	};
}

function normHeading(h) {
	return [...h].map(normChar).join('');
}

await write('catalog.json', {
	books: catalogBooks,
	names: BOOK_NAMES,
	plain: plainIndex
});
for (const period of periods) {
	const basemap = await buildBasemap(period);
	for (const k of ['rivers', 'marshes', 'mountains']) for (const x of basemap[k]) x.t = toTraditional(x.name);
	await write(`basemap-${period}.json`, basemap);
}
