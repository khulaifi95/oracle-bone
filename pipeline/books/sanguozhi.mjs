// 三国志: the 赤壁三分 chapters, read in the 殿本 and the 中华书局点校本, with 裴松之注.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assemble, jinlingStream, sikuStream } from '../text.mjs';
import { parseSanjiazhu } from '../wikitext.mjs';
import { parseSikuSanguo } from '../siku.mjs';
import { normChar } from '../script.mjs';
import { zhNum } from '../dates.mjs';
import { zhJuan } from './shiji.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');

export const chapters = [
	{ juan: 1, title: '武帝纪', t: '武帝紀', kind: '魏书', n: '一', court: 'wei' },
	{ juan: 32, title: '先主传', t: '先主傳', kind: '蜀书', n: '二', court: 'shu' },
	{ juan: 35, title: '诸葛亮传', t: '諸葛亮傳', kind: '蜀书', n: '五', court: 'shu' },
	{ juan: 47, title: '吴主传', t: '吳主傳', kind: '吴书', n: '二', court: 'wu' },
	{ juan: 54, title: '周瑜鲁肃吕蒙传', t: '周瑜魯肅呂蒙傳', kind: '吴书', n: '九', court: 'wu' }
].map((c) => ({ ...c, juanZh: `卷${zhJuan(c.juan)}` }));

// The 裴注 quotes other books by name: each quotation becomes a part of its own, with its source.
const QUOTE = /(?<=[。」』？！])(?=《[^》]{1,12}》(?:曰|云|載|稱|說|注)|臣松之|孫盛曰|習鑿齒曰)/;
// those quoted by name rather than by book
const WHO = /^(孫盛|習鑿齒|傅子|袁宏|干寶|袁子|司馬彪|郭沖|魚豢|張璠|華嶠|虞喜|王隱|徐眾|臣松之)(?:曰|以為|按|案|評|難)?/;
function sourceOf(text) {
	// 〔〕: words the 點校本 restores
	const t = text.replace(/^〔/, '');
	const book = t.match(/^(?:按|案)?(謝承|司馬彪|張璠|袁暐|郭沖|虞溥|華嶠|王沈|韋昭|魚豢)?《([^》]{1,12})》/);
	if (book) return (book[1] ?? '') + book[2];
	if (t.startsWith('臣松之')) return '臣松之';
	const who = t.match(WHO);
	return who ? who[1] : null;
}
const splitParts = (p) =>
	p.text
		.split(QUOTE)
		.filter(Boolean)
		.map((text) => ({ ...p, text, ...(sourceOf(text) ? { src: sourceOf(text) } : {}) }));

export async function buildChapter(c) {
	const n = String(c.juan).padStart(3, '0');
	const wiki = await readFile(path.join(ROOT, 'sources/wikisource', `sanguozhi-${n}.wiki`), 'utf8');
	const siku = await readFile(path.join(ROOT, 'sources/siku', `sanguozhi-${n}.txt`), 'utf8');
	const jParsed = parseSanjiazhu(wiki, { defaultKind: 'pei', splitParts, brackets: true });
	const sikuParsed = parseSikuSanguo(siku);
	const norm = (s) => [...s].filter((x) => !/[，。、；：？！「」『』《》〈〉（）\s]/.test(x)).map(normChar).join('');
	return assemble({
		juan: c.juan,
		J: jinlingStream(jParsed),
		D: sikuStream(sikuParsed),
		header: sikuParsed.header,
		titles: { d: sikuParsed.title, j: jParsed.title },
		kaozheng: sikuParsed.kaozheng,
		// the 殿本 裴注 is cut where the aligned 點校本 note starts a new quotation
		splitD: (note, refParts) => {
			const raw = note.raw;
			const key = [...raw].map(normChar).join('');
			const cuts = [];
			for (const p of refParts.slice(1)) {
				const start = norm(p.s).slice(0, 5);
				const at = start.length >= 3 ? key.indexOf(start, cuts.length ? cuts[cuts.length - 1].at + 1 : 1) : -1;
				if (at > 0) cuts.push({ at, src: p.src });
			}
			const parts = [];
			let last = 0;
			let src = refParts[0]?.src && key.startsWith(norm(refParts[0].s).slice(0, 2)) ? refParts[0].src : undefined;
			for (const cut of cuts) {
				parts.push({ kind: 'pei', text: raw.slice(last, cut.at), src });
				last = cut.at;
				src = cut.src;
			}
			parts.push({ kind: 'pei', text: raw.slice(last), src });
			return parts.filter((p) => p.text);
		}
	});
}

// ---------------------------------------------------------------- 年號
// from and to are the Julian years of the first and last 正月 (夏正) of the era
const ERAS = [
	['han', '永寿', '永壽', 155, 158], ['han', '延熹', '延熹', 158, 167], ['han', '永康', '永康', 167, 167], ['han', '建宁', '建寧', 168, 172],
	['han', '熹平', '熹平', 172, 178], ['han', '光和', '光和', 178, 184], ['han', '中平', '中平', 184, 189], ['han', '初平', '初平', 190, 193],
	['han', '兴平', '興平', 194, 195], ['han', '建安', '建安', 196, 220], ['han', '延康', '延康', 220, 220],
	['wei', '黄初', '黃初', 220, 226], ['wei', '太和', '太和', 227, 233], ['wei', '青龙', '青龍', 233, 237], ['wei', '景初', '景初', 237, 239],
	['wei', '正始', '正始', 240, 249], ['wei', '嘉平', '嘉平', 249, 254],
	['shu', '章武', '章武', 221, 223], ['shu', '建兴', '建興', 223, 237], ['shu', '延熙', '延熙', 238, 257], ['shu', '景耀', '景耀', 258, 263],
	['wu', '黄武', '黃武', 222, 229], ['wu', '黄龙', '黃龍', 229, 231], ['wu', '嘉禾', '嘉禾', 232, 238], ['wu', '赤乌', '赤烏', 238, 251],
	['wu', '太元', '太元', 251, 252], ['wu', '神凤', '神鳳', 252, 252]
].map(([court, name, t, from, to]) => ({ court, name, t, from, to }));

const ERA_RE = ERAS.map((e) => e.name).join('|');
const DATE_RE = new RegExp(
	`(${ERA_RE})?(元|[一二三四五六七八九十有]{1,4})年(?:(春|夏|秋|冬))?(?:(正|闰|[一二三四五六七八九十有]{1,3})月)?|(明年|明岁)(?:(春|夏|秋|冬))?(?:(正|闰|[一二三四五六七八九十有]{1,3})月)?|(其|是|至|以)?(正|闰|[一二三四五六七八九十有]{1,3})月|(?<![一-龥])(春|夏|秋|冬)(?=[，。])`,
	'g'
);
const SEASON_MONTH = { 春: 1, 夏: 4, 秋: 7, 冬: 10 };

/** Reads the 年號 dates of a chapter's sentences in order; a bare year continues the last era. */
export function dateScanner(c) {
	let era = null;
	let cur = null;
	const month = (s, prev) => (s === '闰' ? prev ?? null : zhNum(s));
	return (seg) => {
		const text = seg.j.s;
		const found = [];
		for (const m of text.matchAll(DATE_RE)) {
			const [all, eraName, yearNum, season, mon, next, nSeason, nMon, monthPrefix, monthOnly, seasonOnly] = m;
			const opens = m.index === 0 || /[，。；：]/.test(text[m.index - 1] ?? '') || !!monthPrefix;
			if (yearNum) {
				let e = era;
				if (eraName) {
					const cands = ERAS.filter((x) => x.name === eraName);
					e = cands.find((x) => x.court === c.court) ?? cands[0];
				} else if (!opens) continue;
				const n = zhNum(yearNum);
				if (!e || !n || n > e.to - e.from + 1) continue;
				era = e;
				const ey = e.from + n - 1;
				const mm = mon ? month(mon, cur?.m) : season ? SEASON_MONTH[season] : null;
				cur = { ey, m: mm };
				found.push({ ey, m: mm, x: all });
			} else if (next && cur) {
				const mm = nMon ? month(nMon, null) : nSeason ? SEASON_MONTH[nSeason] : null;
				cur = { ey: cur.ey + 1, m: mm };
				found.push({ ey: cur.ey, m: mm, x: all });
			} else if (monthOnly && cur && opens) {
				const mm = month(monthOnly, cur.m);
				if (!mm || mm > 12) continue;
				cur = { ey: cur.ey, m: mm };
				found.push({ ey: cur.ey, m: mm, x: all });
			} else if (seasonOnly && cur && m.index === 0) {
				cur = { ey: cur.ey, m: SEASON_MONTH[seasonOnly] };
				found.push({ ey: cur.ey, m: cur.m, x: all });
			}
		}
		return found;
	};
}

export const book = {
	id: 'sanguozhi',
	title: '三国志',
	t: '三國志',
	cluster: { s: '赤壁三分', t: '赤壁三分' },
	// the title the edition prints in the 卷首 and the 版心
	printed: { s: '三国志', t: '三國志' },
	// a 卷 can hold several lives, each under its own heading
	subheadings: true,
	notes: [
		{
			k: 'pei', s: '裴注', t: '裴注', color: '#285f93', on: true, who: '南朝宋 裴松之',
			info: {
				s: '宋文帝元嘉六年（429）奏上。不重训诂而重补阙：广引《魏书》《魏略》《江表传》《汉晋春秋》《英雄记》等二百余种书，有异同者并存，又以“臣松之案”“臣松之以为”评断是非。所引之书多已亡佚，赖此得存。',
				t: '宋文帝元嘉六年（429）奏上。不重訓詁而重補闕：廣引《魏書》《魏略》《江表傳》《漢晉春秋》《英雄記》等二百餘種書，有異同者並存，又以「臣松之案」「臣松之以為」評斷是非。所引之書多已亡佚，賴此得存。'
			}
		},
		{
			k: 'kaozheng', s: '考证', t: '考證', color: '#b8322a', on: false, who: '清 武英殿校刊诸臣', only: 'd',
			info: {
				s: '乾隆四年殿本所附《考证》，以宋本、监本、毛本及《通鉴》《册府元龟》等校勘文字。殿本独有，原附卷末，此处移到所考之字下。',
				t: '乾隆四年殿本所附《考證》，以宋本、監本、毛本及《通鑑》《冊府元龜》等校勘文字。殿本獨有，原附卷末，此處移到所考之字下。'
			}
		}
	],
	notesLead: {
		s: '陈寿《三国志》叙事简严，裴松之作注，广采异闻，篇幅几与本书相当。左栏“注”可按所引之书归类，跟读《江表传》《魏略》等一书的记载。殿本另附清代馆臣的《考证》。',
		t: '陳壽《三國志》敘事簡嚴，裴松之作注，廣採異聞，篇幅幾與本書相當。左欄「注」可按所引之書歸類，跟讀《江表傳》《魏略》等一書的記載。殿本另附清代館臣的《考證》。'
	},
	// 夏正: 正月 is about February; years are counted by the 年號 of each court
	calendar: {
		start: 1,
		m1: 1,
		mode: 'courts',
		courts: [
			{ id: 'han', s: '汉', t: '漢' },
			{ id: 'wei', s: '魏', t: '魏' },
			{ id: 'shu', s: '蜀', t: '蜀' },
			{ id: 'wu', s: '吴', t: '吳' }
		],
		eras: ERAS,
		note: {
			s: '年代据各朝年号推算，用夏正，正月约当公历二月。延康元年（220）以后三国各有年号，日期栏先列本篇所属之国，再列他国。岁数为虚岁。时间轴由右向左。',
			t: '年代據各朝年號推算，用夏正，正月約當公曆二月。延康元年（220）以後三國各有年號，日期欄先列本篇所屬之國，再列他國。歲數為虛歲。時間軸由右向左。'
		}
	},
	sides: [
		{ id: 'han', s: '汉室', t: '漢室', color: '#c7891d' },
		{ id: 'wei', s: '魏', t: '魏', color: '#2c5a8c' },
		{ id: 'shu', s: '蜀', t: '蜀', color: '#2f7d4f' },
		{ id: 'wu', s: '吴', t: '吳', color: '#b8322a' },
		{ id: 'qun', s: '群雄', t: '群雄', color: '#6d5a86' }
	],
	timeline: {
		breaks: [[183, 0], [196, 0.12], [223, 0.88], [253, 1]],
		from: 184,
		to: 252,
		major: [196, 223],
		minor: [184, 190, 200, 230, 234, 240, 252],
		marks: [
			{ ey: 196, s: '建安', t: '建安' },
			{ ey: 220, s: '黄初', t: '黃初' },
			{ ey: 221, s: '章武', t: '章武' },
			{ ey: 222, s: '黄武', t: '黃武' }
		]
	},
	map: {
		period: 'sanguo',
		home: [103, 26.5, 122.5, 38.8],
		named: ['河', '江', '淮水', '渭水', '汉水', '济水', '汴渠', '颍水', '湘水', '沔水', '白沟', '漳水', '西汉水'],
		marshNames: ['云梦泽', '巢湖', '彭蠡泽'],
		empty: { s: '', t: '' },
		purpose: {
			s: '此图随所读之处而变：方框是当年群雄与三国的治所，颜色分魏、蜀、吴、汉室与群雄；着色之地是当年各家所据，虚线为界，城点也按所属着色；蓝点是本段前后提到的地方，红点是本事发生之地。山川依东汉末的形势。点地名看详情。',
			t: '此圖隨所讀之處而變：方框是當年群雄與三國的治所，顏色分魏、蜀、吳、漢室與群雄；著色之地是當年各家所據，虛線為界，城點也按所屬著色；藍點是本段前後提到的地方，紅點是本事發生之地。山川依東漢末的形勢。點地名看詳情。'
		},
		key: { s: '河依东汉王景所治河道，约略', t: '河依東漢王景所治河道，約略' },
		about: {
			s: '（公有领域），再改绘为东汉末的形势：黄河下游依东汉王景治河后的河道，经濮阳、平原至千乘入海；济水别出东北流；补绘白沟、汴渠；云梦泽已缩小，巢湖、彭蠡等仍在；海岸依东汉时的古海岸线约略绘出，今海岸以虚线示之。以上均据谭其骧《中国历史地图集》第二、三册约略绘出。地名坐标取古城遗址或今治所的约略位置。',
			t: '（公有領域），再改繪為東漢末的形勢：黃河下游依東漢王景治河後的河道，經濮陽、平原至千乘入海；濟水別出東北流；補繪白溝、汴渠；雲夢澤已縮小，巢湖、彭蠡等仍在；海岸依東漢時的古海岸線約略繪出，今海岸以虛線示之。以上均據譚其驤《中國歷史地圖集》第二、三冊約略繪出。地名坐標取古城遺址或今治所的約略位置。'
		}
	},
	parallels: {
		books: ['houhanshu', 'tongjian'],
		chapters: ['houhanshu-9', 'houhanshu-74a', 'houhanshu-74b', 'tongjian-62', 'tongjian-63', 'tongjian-64', 'tongjian-65', 'tongjian-66', 'tongjian-67', 'tongjian-68', 'tongjian-69'],
		how: {
			s: '每一事先由人工在《三国志》各篇、《后汉书》《资治通鉴》中各定一句起句（及止句）；再以别书所载本事为准，逐句向前后推展，凡与之四字连文相合达四分之一者并入，至不合处为止，一句只归一事；他处与本事文句相合达四成的，也照此找出，标为“同文”。同一事在《三国志》的魏、蜀、吴诸篇往往各记一面，比读可见陈寿的互见之法。标色之字是与底本措辞不同处，百分数是该段文字见于底本的比例。',
			t: '每一事先由人工在《三國志》各篇、《後漢書》《資治通鑑》中各定一句起句（及止句）；再以別書所載本事為準，逐句向前後推展，凡與之四字連文相合達四分之一者併入，至不合處為止，一句只歸一事；他處與本事文句相合達四成的，也照此找出，標為「同文」。同一事在《三國志》的魏、蜀、吳諸篇往往各記一面，比讀可見陳壽的互見之法。標色之字是與底本措辭不同處，百分數是該段文字見於底本的比例。'
		},
		sources: {
			s: '《后汉书》卷九献帝纪、卷七十四袁绍刘表列传，《资治通鉴》卷六十二至六十九，录文据维基文库（CC BY-SA 4.0）。',
			t: '《後漢書》卷九獻帝紀、卷七十四袁紹劉表列傳，《資治通鑑》卷六十二至六十九，錄文據維基文庫（CC BY-SA 4.0）。'
		}
	},
	data: {
		s: '人物、地名、事件、群雄年表为本项目据《三国志》《后汉书》《资治通鉴》整理；生卒年据本传，未详者阙。',
		t: '人物、地名、事件、群雄年表為本項目據《三國志》《後漢書》《資治通鑑》整理；生卒年據本傳，未詳者闕。'
	},
	legend: { person: ['孔明', '孔明'], place: ['赤壁', '赤壁'] }
};
