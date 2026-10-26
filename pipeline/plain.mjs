// The parallel texts (漢書, 後漢書, 資治通鑑, 國語, and the 史記 chapters read beside the 春秋):
// punctuated paragraphs, simplified and traditional.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePlain, parseSanjiazhu } from './wikitext.mjs';
import { toSimplified, isPunct, normChar } from './script.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Book names, for every book the interface shows text from. */
export const BOOK_NAMES = {
	shiji: ['史记', '史記'],
	hanshu: ['汉书', '漢書'],
	houhanshu: ['后汉书', '後漢書'],
	tongjian: ['资治通鉴', '資治通鑑'],
	guoyu: ['国语', '國語'],
	sanguozhi: ['三国志', '三國志'],
	chunqiu: ['春秋左传', '春秋左傳'],
	gongyang: ['公羊传', '公羊傳'],
	guliang: ['穀梁传', '穀梁傳']
};

/** The plain chapters read as parallels, by book; `form` names the parser for the page. */
export const PARALLEL_BOOKS = {
	hanshu: { chapters: { 1: '高帝纪', 31: '陈胜项籍传', 34: '韩彭英卢吴传', 40: '张陈王周传' } },
	tongjian: {
		chapters: {
			7: '秦纪二', 8: '秦纪三', 9: '汉纪一', 10: '汉纪二', 11: '汉纪三', 12: '汉纪四',
			62: '汉纪五十四', 63: '汉纪五十五', 64: '汉纪五十六', 65: '汉纪五十七', 66: '汉纪五十八', 67: '汉纪五十九', 68: '汉纪六十', 69: '魏纪一'
		}
	},
	houhanshu: { chapters: { 9: '孝献帝纪', '74a': '袁绍列传', '74b': '刘表列传' } },
	guoyu: { chapters: { 10: '晋语四' } },
	shiji: { form: 'sanjiazhu', chapters: { 5: '秦本纪', 39: '晋世家', 40: '楚世家', 42: '郑世家' } }
};

/** 9 → 009, 74a → 074a */
export const padJuan = (j) => {
	const m = String(j).match(/^(\d+)(.*)$/);
	return m[1].padStart(3, '0') + m[2];
};

export async function loadPlain(book, juan) {
	const src = await readFile(path.join(ROOT, 'sources/wikisource', `${book}-${padJuan(juan)}.wiki`), 'utf8');
	const raw =
		PARALLEL_BOOKS[book]?.form === 'sanjiazhu'
			? // the main text only, without the commentary
				parseSanjiazhu(src).paragraphs.map((para) => ({ heading: null, text: para.filter((t) => t.t === 'text').map((t) => t.s).join('') })).filter((p) => p.text)
			: parsePlain(src);
	const paras = raw.map((p, i) => {
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
