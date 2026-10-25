// The parallel texts (漢書, 資治通鑑): punctuated paragraphs, simplified and traditional.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePlain } from './wikitext.mjs';
import { toSimplified, isPunct, normChar } from './script.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

export const PARALLEL_BOOKS = {
	hanshu: { title: '汉书', t: '漢書', chapters: { 1: '高帝纪', 31: '陈胜项籍传', 34: '韩彭英卢吴传', 40: '张陈王周传' } },
	tongjian: { title: '资治通鉴', t: '資治通鑑', chapters: { 7: '秦纪二', 8: '秦纪三', 9: '汉纪一', 10: '汉纪二', 11: '汉纪三', 12: '汉纪四' } }
};

export async function loadPlain(book, juan) {
	const n = String(juan).padStart(3, '0');
	const src = await readFile(path.join(ROOT, 'sources/wikisource', `${book}-${n}.wiki`), 'utf8');
	const paras = parsePlain(src).map((p, i) => {
		const t = p.text;
		const s = toSimplified(t);
		// key: punctuation-free normalised text, with a map back to positions in s
		const key = [];
		const pos = [];
		[...s].forEach((c, k) => {
			if (!isPunct(c) && !/[\s：，。；！？、]/.test(c)) {
				key.push(normChar(c));
				pos.push(k);
			}
		});
		return { i, heading: p.heading, s, t, key: key.join(''), pos };
	});
	return paras;
}
