// Dev helper: node pipeline/find.mjs 鸿门 项伯乃夜驰 → shows where phrases occur in every text.
import { loadPlain, PARALLEL_BOOKS } from './plain.mjs';
import { buildShijiChapter } from './text.mjs';
import { normChar } from './script.mjs';
const phrases = process.argv.slice(2).map((p) => [...p].map(normChar).join(''));
const texts = [];
for (const j of [7, 8, 48, 55, 92]) {
	const c = await buildShijiChapter(j);
	const byPara = new Map();
	for (const s of c.segs) byPara.set(s.para, (byPara.get(s.para) ?? '') + s.j.s);
	for (const [p, s] of byPara) texts.push([`shiji-${j} p${p + 1}`, [...s].map(normChar).join('')]);
}
for (const [book, info] of Object.entries(PARALLEL_BOOKS))
	for (const j of Object.keys(info.chapters)) for (const p of await loadPlain(book, j)) texts.push([`${book}-${j} p${p.i} ${p.heading ?? ''}`, p.key]);
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
