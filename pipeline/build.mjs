// Builds everything the interface reads into static/data/. Run with `npm run data`.
// Each reading book is described in pipeline/books/<book>.mjs and has its hand-compiled
// data (people, places, events, states by year) in data/<book>/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadPlain, PARALLEL_BOOKS, BOOK_NAMES } from './plain.mjs';
import { buildBasemap } from './geo.mjs';
import { territoryShapes } from './terrain.mjs';
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
const key = (s) => [...s.replace(/\[[一二三四五六七八九十]+\]/g, '')].filter((c) => !/[，。、；：？！「」『』《》〈〉（）\s]/.test(c)).map((c) => SEARCH[normChar(c)] ?? normChar(c)).join('');

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
// a sentence joins an account when a quarter of its wording is in the reference; a new account needs more
const joins = ({ n, r }) => n >= 4 && r >= 0.25;
const starts = ({ n, r }) => n >= 8 && r >= 0.4;
// sentences with fewer 4-grams than this are too short to judge
const SHORT = 4;
// sentences that do not share wording, passed over while the account grows, if one that does follows
const GAP = 1;
// the sentences on each side of another book's account that count as its wording
const AROUND = 8;
// an account grows to at most this many characters past its anchors, and is filled out to at least the shorter
const LONGEST = 500;
const SHORTEST = 60;
const NOTE_PARA = /^注/;
const SENTENCE = /[^。！？]*[。！？]+[」』”’]*/g;

const catalogBooks = {};
const periods = new Set();
/** each book's holdings by year, drawn as shapes once its base map is built */
const territoryJobs = [];
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

	const misses = [];
	// Match the parallel accounts by wording, sentence by sentence. The hand anchors fix the first
	// (and, with `to`, the last) sentence of each account. Each account then grows over the sentences
	// next to it that share enough wording with the other books' accounts of the event, and sentences
	// elsewhere that retell the event closely are added as accounts of their own (marked `auto`).
	// A sentence belongs to one event only: growth stops at another event's sentences.
	const unitsOf = {};
	const unitsFor = (ref) => {
		if (unitsOf[ref]) return unitsOf[ref];
		const units = [];
		if (index[ref]) for (const seg of index[ref].segs) units.push({ p: seg.para, seg: seg.id, text: seg.j.s });
		else
			for (const p of plain[ref] ?? []) {
				// the 後漢書 carries 李賢's notes as paragraphs of their own: they tell no event
				if (NOTE_PARA.test(p.s)) continue;
				let end = 0;
				for (const m of p.s.matchAll(SENTENCE)) {
					units.push({ p: p.i, c0: m.index, c1: m.index + m[0].length, text: m[0] });
					end = m.index + m[0].length;
				}
				if (end < p.s.length && p.s.slice(end).trim()) units.push({ p: p.i, c0: end, c1: p.s.length, text: p.s.slice(end) });
			}
		let k = '';
		const unitAt = [];
		units.forEach((u, n) => {
			u.g = gramsOf(u.text);
			const ku = key(u.text);
			u.len = ku.length;
			k += ku;
			for (let i = 0; i < ku.length; i++) unitAt.push(n);
		});
		return (unitsOf[ref] = { units, k, unitAt });
	};
	// sentence → the account it belongs to, and account → its event
	const claim = new Map();
	const owner = (ref, n) => claim.get(`${ref}:${n}`);
	const eventOf = new Map();
	for (const e of events) {
		e.t = toTraditional(e.title);
		for (const a of e.accounts) {
			eventOf.set(a, e);
			const U = unitsFor(a.ref);
			const kat = key(a.at);
			const from = U.k.indexOf(kat);
			let to = -1;
			if (from >= 0 && a.to) {
				const kto = key(a.to);
				const i = U.k.indexOf(kto, from);
				const j = i >= 0 ? i : U.k.indexOf(kto);
				if (j >= 0) to = U.unitAt[j + kto.length - 1];
			} else if (from >= 0) to = U.unitAt[from + kat.length - 1];
			if (from < 0 || to < 0) {
				misses.push(`${e.id} ${a.ref} ${a.at}${a.to ? ' … ' + a.to : ''}`);
				a.span = null;
			} else {
				const u0 = U.unitAt[from];
				a.span = [Math.min(u0, to), Math.max(u0, to)];
				if (B.book.parallels.whole && index[a.ref]) {
					const { units } = U;
					while (a.span[0] > 0 && units[a.span[0] - 1].p === units[a.span[0]].p) a.span[0]--;
					while (a.span[1] < units.length - 1 && units[a.span[1] + 1].p === units[a.span[1]].p) a.span[1]++;
				}
				for (let n = a.span[0]; n <= a.span[1]; n++) if (!owner(a.ref, n)) claim.set(`${a.ref}:${n}`, a);
			}
			delete a.to;
		}
	}
	if (misses.length) {
		console.error(`Unresolved event passages in ${id}:\n` + misses.join('\n'));
		process.exitCode = 1;
	}
	const parallelIds = B.book.parallels.chapters;
	for (const pid of parallelIds) unitsFor(pid);
	for (const cid of Object.keys(index)) unitsFor(cid);
	// the wording of an event in every book but `except`, from its accounts and the sentences around them
	const reference = (e, except, around) => {
		const base = new Set();
		for (const b of e.accounts) {
			if (b.ref === except || !b.span) continue;
			const { units } = unitsOf[b.ref];
			for (let n = Math.max(0, b.span[0] - around); n <= Math.min(units.length - 1, b.span[1] + around); n++) for (const g of units[n].g) base.add(g);
		}
		return base;
	};
	// grow an account one way while the next sentences share wording with the reference;
	// a sentence too short to judge, or one sentence that does not, is kept only if a joining one follows
	const lenOf = (units, [s0, s1]) => {
		let n = 0;
		for (let k = s0; k <= s1; k++) n += units[k].len;
		return n;
	};
	const grow = (e, a, base) => {
		const { units } = unitsOf[a.ref];
		const free = (n) => n >= 0 && n < units.length && (!owner(a.ref, n) || owner(a.ref, n) === a);
		let room = Math.max(0, LONGEST - lenOf(units, a.span));
		for (const dir of [-1, 1]) {
			const start = dir < 0 ? a.span[0] : a.span[1];
			let edge = start;
			let skipped = 0;
			let taken = 0;
			for (let n = start + dir; free(n); n += dir) {
				const u = units[n];
				taken += u.len;
				if (taken > room) break;
				if (u.g.size < SHORT) continue;
				if (joins(shared(u.g, base))) (edge = n), (skipped = 0);
				else if (++skipped > GAP) break;
			}
			a.span[dir < 0 ? 0 : 1] = edge;
			room -= lenOf(units, [Math.min(start, edge), Math.max(start, edge)]) - units[start].len;
		}
		// an account too short to follow goes on to the next sentences of its paragraph
		for (let n = a.span[1] + 1; lenOf(units, a.span) < SHORTEST && free(n) && units[n].p === units[n - 1].p; n++) a.span[1] = n;
		for (let m = a.span[0]; m <= a.span[1]; m++) claim.set(`${a.ref}:${m}`, a);
	};
	let widened = 0;
	let added = 0;
	for (const e of events)
		for (const a of e.accounts) {
			if (!a.span) continue;
			const before = a.span.join();
			grow(e, a, reference(e, a.ref, AROUND));
			if (a.span.join() !== before) widened++;
		}
	// retellings elsewhere: a sentence close to one event's accounts starts an account of its own
	for (const ref of Object.keys(unitsOf)) {
		const { units } = unitsOf[ref];
		const bases = events.map((e) => reference(e, ref, 0));
		units.forEach((u, n) => {
			if (owner(ref, n) || u.g.size < SHORT * 2) return;
			let best = -1;
			let bestN = 0;
			bases.forEach((base, i) => {
				if (!base.size) return;
				const sc = shared(u.g, base);
				if (starts(sc) && sc.n > bestN) (best = i), (bestN = sc.n);
			});
			if (best < 0) return;
			const e = events[best];
			// just after an account of the same event: that account goes on
			const near = owner(ref, n - 1) ?? owner(ref, n - 2);
			const prev = near && eventOf.get(near) === e ? near : null;
			if (prev) {
				for (let m = prev.span[1] + 1; m <= n; m++) claim.set(`${ref}:${m}`, prev);
				prev.span[1] = n;
				grow(e, prev, bases[best]);
				return;
			}
			const a = { ref, at: '', span: [n, n], auto: true };
			claim.set(`${ref}:${n}`, a);
			eventOf.set(a, e);
			grow(e, a, bases[best]);
			e.accounts.push(a);
			added++;
		});
	}
	for (const e of events) {
		for (const a of e.accounts) {
			if (!a.span) {
				a.paras = [-1, -1];
				continue;
			}
			const { units } = unitsOf[a.ref];
			const [u0, u1] = [units[a.span[0]], units[a.span[1]]];
			a.paras = [u0.p, u1.p];
			if (index[a.ref]) a.segs = [u0.seg, u1.seg];
			else a.cut = [u0.c0, u1.c1];
		}
		const order = [id, ...B.book.parallels.books];
		const bookOf = (r) => (index[r] ? id : plainIndex[r]?.book);
		const juanOf = (r) => parseFloat(r.split('-')[1]);
		e.accounts.sort((x, y) => order.indexOf(bookOf(x.ref)) - order.indexOf(bookOf(y.ref)) || juanOf(x.ref) - juanOf(y.ref) || x.span?.[0] - y.span?.[0]);
	}
	console.log(`${id} parallels: ${widened} accounts widened, ${added} found by wording`);
	if (process.env.PARALLEL_REPORT)
		for (const e of events)
			for (const a of e.accounts) {
				if (!a.span) continue;
				const { units } = unitsOf[a.ref];
				const text = units.slice(a.span[0], a.span[1] + 1).map((u) => u.text).join('');
				console.log(`  ${a.auto ? '+' : ' '} ${e.id} ${a.ref} s${a.span[0]}-${a.span[1]} ${text.length}字 ${text.slice(0, 24)}`);
			}
	for (const e of events) for (const a of e.accounts) delete a.span;

	// Who was what to whom, and when (data/<book>/relations.json): each pair is written once and
	// shown on both cards, every phase with its own label for each side.
	const relations = (await readJson(`${dir}/relations.json`).catch(() => null))?.relations ?? [];
	const relOf = new Map();
	const known = new Set(people.map((p) => p.id));
	for (const r of relations) {
		if (!known.has(r.a) || !known.has(r.b)) {
			console.error(`relations.json in ${id}: unknown person in ${r.a} ${r.b}`);
			process.exit(1);
		}
		const noteT = r.note ? toTraditional(r.note) : undefined;
		for (const [me, other, side] of [[r.a, r.b, 3], [r.b, r.a, 4]]) {
			if (!relOf.has(me)) relOf.set(me, []);
			relOf.get(me).push({
				id: other,
				p: r.p.map((x) => [x[0], x[1], x[2], x[side], toTraditional(x[side])]),
				...(r.note ? { note: r.note, noteT } : {})
			});
		}
	}
	const peopleOut = people.map((p) => ({
		...p,
		...(relOf.has(p.id) ? { rel: relOf.get(p.id) } : {}),
		bioT: toTraditional(p.bio),
		t: p.t ?? toTraditional(p.name),
		...(portraits[p.id]?.image ? { portrait: { image: portraits[p.id].image, source: portraits[p.id].source, page: portraits[p.id].page } } : {})
	}));
	const placesOut = places.map((p) => ({ ...p, t: toTraditional(p.name) }));
	await write(`${id}/people.json`, peopleOut);
	await write(`${id}/places.json`, placesOut);
	await write(`${id}/events.json`, events);
	// Who held what: each place goes to the polity of that year whose line holds it (data/<book>/territory.json).
	const territory = await readJson(`${dir}/territory.json`).catch(() => null);
	const holderAt = (place, year) => {
		let line = null;
		for (const [y, l] of territory.held[place] ?? territory.default ?? []) if (y <= year) line = l;
		return line;
	};
	if (territory) {
		const ids = new Set(places.map((p) => p.id));
		const bad = Object.keys(territory.held).filter((p) => !ids.has(p));
		const unnamed = [...new Set(Object.values(polities).flat().map((p) => p.name))].filter((n) => !territory.lines[n]);
		if (bad.length || unnamed.length) {
			console.error(`territory.json in ${id}: unknown places ${bad.join(' ')}; polities without a line ${unnamed.join(' ')}`);
			process.exitCode = 1;
		}
	}
	const politiesOut = Object.fromEntries(
		Object.entries(polities).map(([y, list]) => [
			y,
			list.map((p) => {
				const line = territory?.lines[p.name];
				const holds = line ? places.filter((pl) => holderAt(pl.id, Number(y)) === line).map((pl) => pl.id) : [];
				return { ...p, t: toTraditional(p.name), ...(p.who ? { whoT: toTraditional(p.who) } : {}), ...(territory ? { holds } : {}) };
			})
		])
	);
	await write(`${id}/polities.json`, politiesOut);
	if (territory) territoryJobs.push({ id, period: B.book.map.period, places, years: politiesOut });

	catalogBooks[id] = {
		...B.book,
		chapters: chapterInfo.map((c) => ({ id: `${id}-${c.juan}`, juan: c.juan, juanZh: c.juanZh, title: c.title, t: c.t, kind: c.kind, n: c.n, court: c.court, stats: c.stats })),
		// each edition's names in both scripts
		editions: Object.fromEntries(Object.entries(editions).map(([k, e]) => [k, { ...e, shortT: toTraditional(e.short), fullT: toTraditional(e.full) }]))
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
	for (const job of territoryJobs.filter((j) => j.period === period)) {
		const years = Object.fromEntries(Object.entries(job.years).map(([y, list]) => [y, list.map((p) => ({ name: p.name, holds: p.holds }))]));
		await write(`${job.id}/territory.json`, await territoryShapes(basemap, job.places, years));
	}
}
