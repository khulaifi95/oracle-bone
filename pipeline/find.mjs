// Dev helper: node pipeline/find.mjs 鸿门 项伯乃夜驰 → shows where phrases occur in every text.
// Reads the reading books from static/data/text (run `npm run data` first); BOOK=sanguozhi limits
// the reading books and the parallel books to one book's set.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadPlain, PARALLEL_BOOKS } from './plain.mjs';
import { normChar } from './script.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const norm = (s) => [...s].filter((c) => !/[，。、；：？！「」『』《》〈〉（）\s]/.test(c)).map(normChar).join('');
const phrases = process.argv.slice(2).map(norm);
const catalog = JSON.parse(await readFile(path.join(ROOT, 'static/data/catalog.json'), 'utf8'));
const only = process.env.BOOK;
const texts = [];
const wanted = new Set();
for (const [id, b] of Object.entries(catalog.books)) {
	if (only && id !== only) continue;
	for (const c of b.chapters) {
		const ch = JSON.parse(await readFile(path.join(ROOT, 'static/data/text', `${c.id}.json`), 'utf8'));
		const byPara = new Map();
		for (const s of ch.segs) byPara.set(s.para, (byPara.get(s.para) ?? '') + s.j.s);
		for (const [p, s] of byPara) texts.push([`${c.id} p${p}`, norm(s)]);
	}
	for (const pid of b.parallels.chapters) wanted.add(pid);
}
for (const [book, info] of Object.entries(PARALLEL_BOOKS))
	for (const j of Object.keys(info.chapters)) {
		if (only && !wanted.has(`${book}-${j}`)) continue;
		for (const p of await loadPlain(book, j)) texts.push([`${book}-${j} p${p.i} ${p.heading ?? ''}`, norm(p.s)]);
	}
for (const ph of phrases) {
	console.log(`== ${ph}`);
	for (const [label, s] of texts) {
		let at = s.indexOf(ph);
		while (at >= 0) {
			console.log(`  ${label}: …${s.slice(Math.max(0, at - 12), at + ph.length + 12)}…`);
			at = s.indexOf(ph, at + 1);
		}
	}
}
