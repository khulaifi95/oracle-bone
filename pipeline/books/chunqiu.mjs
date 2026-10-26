// 春秋: 經 with 左傳, the 晉文之霸 chapters of the 注疏本, read in the 殿本 (四庫) and the
// punctuated 正義, with 杜預注, 陸德明音義, 孔穎達疏; and the 公羊 and 穀梁 readings of each 經.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assemble, align, jinlingStream } from '../text.mjs';
import { parseZhengyi, zuoParagraphs, parseZhushu, parseSanzhuanPage, matchSanzhuan, isSkChar, similarity } from '../chunqiu.mjs';
import { fixPUA } from '../siku.mjs';
import { normChar, toSimplified, isPunct } from '../script.mjs';
import { zhNum } from '../dates.mjs';
import { zhJuan } from './shiji.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const src = (f) => readFile(path.join(ROOT, 'sources/wikisource', f), 'utf8');

export const chapters = [
	{ juan: 1, title: '隐公元年至二年', t: '隱公元年至二年', kind: '注疏', duke: '隐', from: -722, to: -721 },
	{ juan: 14, title: '僖公二十二年至二十四年', t: '僖公二十二年至二十四年', kind: '注疏', duke: '僖', from: -638, to: -636 },
	{ juan: 15, title: '僖公二十五年至二十八年', t: '僖公二十五年至二十八年', kind: '注疏', duke: '僖', from: -635, to: -632 },
	{ juan: 16, title: '僖公二十九年至三十三年', t: '僖公二十九年至三十三年', kind: '注疏', duke: '僖', from: -631, to: -627 }
].map((c) => ({ ...c, juanZh: `卷${zhJuan(c.juan)}`, court: 'lu' }));

export async function buildChapter(c) {
	const n = String(c.juan).padStart(3, '0');
	const zy = parseZhengyi(await src(`zhengyi-${n}.wiki`));
	zy.paragraphs = zuoParagraphs(zy.paragraphs, await src(`zuozhuan-${PAGES[c.duke]}.wiki`));
	const zs = parseZhushu(await src(`zhushu-${n}.wiki`));
	const J = jinlingStream(zy);
	const jNote = new Map(J.notes.map((x) => [x.id, x]));

	// The 正義 sets 注 apart; the 四庫 text runs it on in the main text, marking only its start
	// with 注. Aligning the 四庫 stream with the 正義's main text and 注 together tells which
	// 四庫 characters are 注.
	const full = [];
	const pushDu = (id) => {
		for (const p of jNote.get(id)?.parts ?? []) if (p.k === 'du') for (const ch of p.t) if (!isPunct(ch) && !/[\s　]/.test(ch)) full.push({ c: ch, du: id });
	};
	J.chars.forEach((ch, i) => {
		ch.notesBefore.forEach(pushDu);
		full.push({ c: ch.c, main: i });
		ch.notes.forEach(pushDu);
	});
	const D = zs.chars;
	const al = align(
		D.map((x) => x.c),
		full.map((x) => x.c)
	);
	const label = new Array(D.length).fill(null);
	const skVotes = new Map();
	for (let a = 0; a < D.length; a++) if (al.aToB[a] >= 0) label[a] = full[al.aToB[a]].main != null ? 'm' : 'du';
	for (const r of al.regions) {
		const la = r.a1 - r.a0;
		const lb = r.b1 - r.b0;
		for (let a = r.a0; a < r.a1; a++) {
			if (lb > 0) {
				const b = r.b0 + Math.floor(((a - r.a0) * lb) / la);
				label[a] = full[b].main != null ? 'm' : 'du';
				if (la === lb && isSkChar(D[a].c)) {
					const code = D[a].c;
					const votes = skVotes.get(code) ?? new Map();
					votes.set(full[b].c, (votes.get(full[b].c) ?? 0) + 1);
					skVotes.set(code, votes);
				}
			}
		}
	}
	// what is left (text only in the 四庫) goes with the character before it
	for (let a = 0; a < D.length; a++) if (!label[a]) label[a] = label[a - 1] ?? 'm';
	for (let a = 0; a < D.length; a++) {
		const x = D[a];
		if (x.marker || x.c === '○') label[a] = 'x';
		// 注 opening a run of 注 is the transcription's mark, not text
		else if (x.c === '注' && al.aToB[a] < 0 && label[a + 1] === 'du' && label[a] !== 'du') label[a] = 'x';
		else if (x.c === '注' && al.aToB[a] < 0 && label[a + 1] === 'du') label[a] = 'x';
	}
	const skMap = new Map([...skVotes].map(([code, votes]) => [code, [...votes].sort((p, q) => q[1] - p[1])[0][0]]));
	const restoreSk = (s) => fixPUA([...s].map((ch) => (isSkChar(ch) && skMap.has(ch) ? skMap.get(ch) : ch)).join(''));

	const chars = [];
	const notes = [];
	let du = null;
	const noteHere = () => {
		const host = chars[chars.length - 1] ?? (chars.push({ c: '', notes: [] }), chars[0]);
		let note = notes.find((x) => x.id === host.notes[host.notes.length - 1]);
		if (!note) {
			note = { id: `d${notes.length}`, parts: [] };
			notes.push(note);
			host.notes.push(note.id);
		}
		return note;
	};
	D.forEach((x, a) => {
		if (label[a] === 'm') {
			chars.push({ c: x.c, notes: [] });
			du = null;
		} else if (label[a] === 'du') {
			if (!du) {
				du = { kind: 'du', text: '' };
				noteHere().parts.push(du);
			}
			du.text += x.c;
		}
		for (const nt of x.notes) {
			noteHere().parts.push({ kind: nt.kind, text: nt.raw });
			du = null;
		}
	});
	if (chars[0]?.c === '') chars.shift();

	const built = assemble({
		juan: c.juan,
		J,
		D: { chars, notes },
		header: ['晉杜氏注　唐陸德明音義　孔穎達疏'],
		titles: { d: `春秋左傳注疏卷${zhJuan(c.juan)}`, j: `春秋左傳注疏卷第${zhJuan(c.juan)}` },
		kaozheng: zs.kaozheng.map((k) => ({ lemma: restoreSk(k.lemma), cite: restoreSk(k.cite), text: restoreSk(k.text) })),
		splitD: (note) => note.parts.map((p) => ({ kind: p.kind, text: restoreSk(p.text) }))
	});
	built.stats.du = { d: notes.reduce((n, x) => n + x.parts.filter((p) => p.kind === 'du').length, 0) };
	built.extra = [{ file: `sanzhuan/chunqiu-${c.juan}.json`, data: await sanzhuan(c, built, J) }];
	return built;
}

// ---------------------------------------------------------------- 三傳
const PAGES = { 隐: 'yin', 僖: 'xi' };
async function sanzhuan(c, built, J) {
	const withPunct = (seg, script) => {
		const st = seg.j;
		const after = new Map(st.p ?? []);
		const before = new Map(st.q ?? []);
		return [...st[script]].map((ch, i) => (before.get(i) ?? '') + ch + (after.get(i) ?? '')).join('');
	};
	// the 經 entries of the chapter, one per paragraph, and the 傳 paragraphs by year
	const byPara = new Map();
	for (const seg of built.segs) {
		const p = byPara.get(seg.para) ?? { para: seg.para, k: seg.k, y: seg.y, segs: [] };
		p.segs.push(seg);
		byPara.set(seg.para, p);
	}
	const paras = [...byPara.values()];
	const jing = paras.filter((p) => p.k === 'jing');
	const zhuan = paras.filter((p) => p.k === 'zhuan');
	const textOf = (p, script) => p.segs.map((s) => withPunct(s, script)).join('');
	const zuo = jing.map((p) => ({ seg: p.segs[0].id, y: p.y, text: textOf(p, 't'), p }));
	const page = async (b) => parseSanzhuanPage(await src(`${b}-${PAGES[c.duke]}.wiki`)).map((e) => fixGuliang(b, e));
	const gong = matchSanzhuan(zuo, await page('gongyang'));
	const gu = matchSanzhuan(zuo, await page('guliang'));
	const both = (t) => (t ? { s: toSimplified(t), t } : null);
	// 杜注 says 無傳 where the 左氏 has no 傳 for an entry; otherwise the 傳 paragraph of the year
	// that shares the most wording with the 經 is taken as its telling
	const bigrams = (s) => {
		const c2 = [...s].filter((x) => !/[，。、；：？！「」『』《》〈〉（）]/.test(x)).map(normChar);
		const g = new Set();
		for (let i = 0; i + 2 <= c2.length; i++) g.add(c2[i] + c2[i + 1]);
		return g;
	};
	const COMMON = new Set(['公子', '于是', '之所', '以为', '不可', '曰君', '春王', '王正', '正月', '夏五', '五月', '秋七', '七月', '冬十', '十有', '有二', '二月', '三月', '四月', '六月', '八月', '九月', '十月', '有一', '一月']);
	const entries = zuo.map((z) => {
		const notes = z.p.segs.flatMap((s) => (s.j.n ?? []).map(([, id]) => built.notes.j[id]));
		const noZhuan = notes.some((n) => n?.parts.some((p) => p.k === 'du' && p.t.startsWith('無傳')));
		let told = null;
		if (!noZhuan) {
			const g = bigrams(z.p.segs.map((s) => s.j.t).join(''));
			let best = 0;
			for (const p of zhuan) {
				if (p.y !== z.y) continue;
				const pg = bigrams(p.segs.map((s) => s.j.t).join(''));
				let n = 0;
				for (const x of g) if (!COMMON.has(x) && pg.has(x)) n++;
				if (n > best) (best = n), (told = p);
			}
			if (best < 2) told = null;
		}
		const gy = gong.get(z.seg);
		const gl = gu.get(z.seg);
		return {
			seg: z.seg,
			y: z.y,
			zuo: { s: textOf(z.p, 's'), t: z.text },
			...(noZhuan ? { noZhuan: true } : {}),
			...(told ? { told: told.segs[0].id } : {}),
			gong: gy ? { jing: both(gy.jing), zhuan: both(gy.zhuan) } : null,
			gu: gl ? { jing: both(gl.jing), zhuan: both(gl.zhuan) } : null
		};
	});
	return { id: `chunqiu-${c.juan}`, entries };
}

// The Wikisource 穀梁 copies the 公羊 form 邾婁 into 隱公元年; the 穀梁 經 reads 邾.
function fixGuliang(book, e) {
	if (book === 'guliang') e.jing = e.jing.replace(/邾婁/g, '邾');
	return e;
}

// ---------------------------------------------------------------- dates
const MONTH_RE = /(春|夏|秋|冬)?[，、]?(王)?(?:(周)?(正|[一二三四五六七八九十有]{1,4})月)?/;
const SEASON_MONTH = { 春: 1, 夏: 4, 秋: 7, 冬: 10 };
const DUKE_NAME = { [-722]: '隐公', [-659]: '僖公' };

/** The year of every 經 and 傳 comes from the book's structure; months are read from the text. */
export function dateScanner(c) {
	let lastY = null;
	let lastM = null;
	return (seg) => {
		if (seg.y == null) return [];
		const text = seg.j.s.replace(/^[元一二三四五六七八九十有]+年[，、]?/, '');
		const m = text.match(MONTH_RE);
		const mm = m?.[4] ? zhNum(m[4]) : m?.[1] && text.startsWith(m[1]) ? SEASON_MONTH[m[1]] : null;
		const opensYear = seg.y !== lastY;
		if (!opensYear && (mm == null || mm === lastM)) return [];
		lastY = seg.y;
		if (mm != null) lastM = mm;
		else if (opensYear) lastM = null;
		const n = seg.y - (c.duke === '隐' ? -722 : -659) + 1;
		return [{ ey: seg.y, m: mm ?? (opensYear ? null : lastM), x: m?.[0] && mm != null ? m[0].replace(/[，、]/g, '') : `${DUKE_NAME[c.duke === '隐' ? -722 : -659]}${n === 1 ? '元' : zhJuan(n)}年` }];
	};
}

export const book = {
	id: 'chunqiu',
	title: '春秋',
	t: '春秋',
	cluster: { s: '晋文之霸', t: '晉文之霸' },
	// the title the edition prints in the 卷首 and the 版心
	printed: { s: '春秋左传注疏', t: '春秋左傳注疏' },
	notes: [
		{
			k: 'du', s: '注', t: '注', color: '#285f93', on: true, who: '晋 杜预',
			info: {
				s: '《春秋经传集解》。杜预把本来别行的经与传按年相附，又集合汉魏旧说而为之解，是现存最早的完整《左传》注，唐修《五经正义》即以此为本。',
				t: '《春秋經傳集解》。杜預把本來別行的經與傳按年相附，又集合漢魏舊說而為之解，是現存最早的完整《左傳》注，唐修《五經正義》即以此為本。'
			}
		},
		{
			k: 'yinyi', s: '音义', t: '音義', color: '#2e7d4f', on: false, who: '唐 陆德明',
			info: {
				s: '《经典释文·春秋左氏音义》。为经传与杜注中的字注音（反切、直音），并记诸本异文。',
				t: '《經典釋文·春秋左氏音義》。為經傳與杜注中的字注音（反切、直音），並記諸本異文。'
			}
		},
		{
			k: 'shu', s: '疏', t: '疏', color: '#8f5a12', on: false, who: '唐 孔颖达',
			info: {
				s: '《春秋正义》。疏通经、传与杜注，引证礼制、历法、地理，篇幅极长，故默认不显示。',
				t: '《春秋正義》。疏通經、傳與杜注，引證禮制、曆法、地理，篇幅極長，故默認不顯示。'
			}
		},
		{
			k: 'kaozheng', s: '考证', t: '考證', color: '#b8322a', on: false, who: '清 武英殿校刊诸臣', only: 'd',
			info: {
				s: '乾隆四年殿本《春秋左传注疏》所附《考证》，校勘文字，并引啖助、赵匡、刘敞等说辨正杜注孔疏。殿本独有，原附卷末，此处移到所考之字下。',
				t: '乾隆四年殿本《春秋左傳注疏》所附《考證》，校勘文字，並引啖助、趙匡、劉敞等說辨正杜注孔疏。殿本獨有，原附卷末，此處移到所考之字下。'
			}
		}
	],
	notesLead: {
		s: '《春秋》是鲁国的编年史，经文简略；《左传》按年叙事，与经相附。注疏本以晋杜预注、唐陆德明音义、唐孔颖达疏夹在经传之中。经与传各以阴文“经”“传”二字标起，可只读经或只读传。',
		t: '《春秋》是魯國的編年史，經文簡略；《左傳》按年敘事，與經相附。注疏本以晉杜預注、唐陸德明音義、唐孔穎達疏夾在經傳之中。經與傳各以陰文「經」「傳」二字標起，可只讀經或只讀傳。'
	},
	jingzhuan: true,
	// 周正: the year begins with the month containing the winter solstice, about December
	calendar: {
		start: 1,
		m1: -1,
		mode: 'states',
		courts: [
			{ id: 'lu', s: '鲁', t: '魯' },
			{ id: 'zhou', s: '周', t: '周' },
			{ id: 'jin', s: '晋', t: '晉' },
			{ id: 'chu', s: '楚', t: '楚' },
			{ id: 'qi', s: '齐', t: '齊' },
			{ id: 'qin', s: '秦', t: '秦' },
			{ id: 'song', s: '宋', t: '宋' },
			{ id: 'zheng', s: '郑', t: '鄭' },
			{ id: 'wei', s: '卫', t: '衛' }
		],
		eras: [
			['lu', '隐公', '隱公', -722, -712], ['lu', '桓公', '桓公', -711, -694], ['lu', '庄公', '莊公', -693, -662], ['lu', '闵公', '閔公', -661, -660],
			['lu', '僖公', '僖公', -659, -627], ['lu', '文公', '文公', -626, -609],
			['zhou', '平王', '平王', -770, -720], ['zhou', '桓王', '桓王', -719, -697], ['zhou', '惠王', '惠王', -676, -652], ['zhou', '襄王', '襄王', -651, -619],
			['jin', '献公', '獻公', -676, -651], ['jin', '惠公', '惠公', -650, -637], ['jin', '文公', '文公', -636, -628], ['jin', '襄公', '襄公', -627, -621],
			['chu', '成王', '成王', -671, -626],
			['qi', '桓公', '桓公', -685, -643], ['qi', '孝公', '孝公', -642, -633], ['qi', '昭公', '昭公', -632, -613],
			['qin', '穆公', '穆公', -659, -621],
			['song', '襄公', '襄公', -650, -637], ['song', '成公', '成公', -636, -620],
			['zheng', '庄公', '莊公', -743, -701], ['zheng', '文公', '文公', -672, -628], ['zheng', '穆公', '穆公', -627, -606],
			['wei', '桓公', '桓公', -734, -719], ['wei', '文公', '文公', -659, -635], ['wei', '成公', '成公', -634, -600]
		].map(([court, name, t, from, to]) => ({ court, name, t, from, to })),
		note: {
			s: '年代以鲁公纪年：经传各在其年之下。用周正，以建子之月为正月，约当公历前一年十二月，故春秋之“春”多在冬末。日期栏先列鲁公之年，再列本段人物所属诸国的君年。岁数为虚岁。时间轴由右向左。',
			t: '年代以魯公紀年：經傳各在其年之下。用周正，以建子之月為正月，約當公曆前一年十二月，故春秋之「春」多在冬末。日期欄先列魯公之年，再列本段人物所屬諸國的君年。歲數為虛歲。時間軸由右向左。'
		}
	},
	sides: [
		{ id: 'zhou', s: '周', t: '周', color: '#7a5a1e' },
		{ id: 'lu', s: '鲁', t: '魯', color: '#b0702a' },
		{ id: 'jin', s: '晋', t: '晉', color: '#2c5a8c' },
		{ id: 'chu', s: '楚', t: '楚', color: '#b8322a' },
		{ id: 'qin', s: '秦', t: '秦', color: '#3d4a5c' },
		{ id: 'qi', s: '齐', t: '齊', color: '#2f7d4f' },
		{ id: 'song', s: '宋', t: '宋', color: '#7d4f8f' },
		{ id: 'zheng', s: '郑', t: '鄭', color: '#c7891d' },
		{ id: 'wei', s: '卫', t: '衛', color: '#4f8a87' },
		{ id: 'other', s: '他国', t: '他國', color: '#7c7262' }
	],
	// 隱公's first years and 僖公's last twelve are drawn wide, the years between folded
	timeline: {
		breaks: [[-723, 0], [-719, 0.12], [-640, 0.2], [-626, 1]],
		from: -722,
		to: -627,
		major: [-638, -627],
		minor: [-722, -720, -680],
		marks: [
			{ ey: -722, s: '隐公元年', t: '隱公元年' },
			{ ey: -659, s: '僖公', t: '僖公' },
			{ ey: -636, s: '晋文公立', t: '晉文公立' }
		]
	},
	map: {
		period: 'chunqiu',
		home: [107.5, 30.5, 121, 38.8],
		named: ['河', '江', '淮水', '渭水', '汉水', '济水', '汾水', '洛水', '睢水', '泗水', '颍水', '汝水', '漳水'],
		marshNames: ['大野泽', '孟诸泽', '云梦泽'],
		empty: { s: '', t: '' },
		purpose: {
			s: '此图随所读之处而变：方框是当年诸侯的国都，颜色分国；着色之地是当年各家所据，虚线为界，城点也按所属着色；蓝点是本段前后提到的地方，红点是本事发生之地。河水依春秋时的故道北流入海。点地名看详情。',
			t: '此圖隨所讀之處而變：方框是當年諸侯的國都，顏色分國；著色之地是當年各家所據，虛線為界，城點也按所屬著色；藍點是本段前後提到的地方，紅點是本事發生之地。河水依春秋時的故道北流入海。點地名看詳情。'
		},
		key: { s: '河依春秋故道北流，济水东北入海，约略', t: '河依春秋故道北流，濟水東北入海，約略' },
		about: {
			s: '（公有领域），再改绘为春秋中期的形势：黄河自宿胥口北流，经今河北中部，至今天津附近入海；今黄河下游一线为济水；淮水自盱眙东流入海；不绘鸿沟（战国时始开）；海岸依古海岸线约略绘出，今海岸以虚线示之。以上均据谭其骧《中国历史地图集》第一册约略绘出。国都与地名坐标取遗址或今地的约略位置。',
			t: '（公有領域），再改繪為春秋中期的形勢：黃河自宿胥口北流，經今河北中部，至今天津附近入海；今黃河下游一線為濟水；淮水自盱眙東流入海；不繪鴻溝（戰國時始開）；海岸依古海岸線約略繪出，今海岸以虛線示之。以上均據譚其驤《中國歷史地圖集》第一冊約略繪出。國都與地名坐標取遺址或今地的約略位置。'
		}
	},
	parallels: {
		books: ['shiji', 'guoyu'],
		chapters: ['shiji-5', 'shiji-39', 'shiji-40', 'shiji-42', 'guoyu-10'],
		// a 傳 entry is told whole: its accounts in the 左傳 take their full paragraphs
		whole: true,
		how: {
			s: '每一事先由人工在《左传》与《史记》秦本纪、晋世家、楚世家、郑世家及《国语·晋语四》中各定一句起句（及止句）；《左传》取其整段传文；再以别书所载本事为准，逐句向前后推展，凡与之四字连文相合达四分之一者并入，至不合处为止，一句只归一事；他处与本事文句相合达四成的，也照此找出，标为“同文”。司马迁多据《左传》改写，比读可见其取舍。标色之字是与底本措辞不同处，百分数是该段文字见于底本的比例。',
			t: '每一事先由人工在《左傳》與《史記》秦本紀、晉世家、楚世家、鄭世家及《國語·晉語四》中各定一句起句（及止句）；《左傳》取其整段傳文；再以別書所載本事為準，逐句向前後推展，凡與之四字連文相合達四分之一者併入，至不合處為止，一句只歸一事；他處與本事文句相合達四成的，也照此找出，標為「同文」。司馬遷多據《左傳》改寫，比讀可見其取捨。標色之字是與底本措辭不同處，百分數是該段文字見於底本的比例。'
		},
		sources: {
			s: '《史记》卷五、三十九、四十、四十二（三家注本正文），《国语》卷十晋语四，《公羊传》《穀梁传》隐公、僖公，录文据维基文库（CC BY-SA 4.0）。',
			t: '《史記》卷五、三十九、四十、四十二（三家注本正文），《國語》卷十晉語四，《公羊傳》《穀梁傳》隱公、僖公，錄文據維基文庫（CC BY-SA 4.0）。'
		}
	},
	data: {
		s: '人物、地名、事件、列国年表为本项目据《左传》《史记》整理；人物多有数名（名、字、谥、爵），人物卡并列之。',
		t: '人物、地名、事件、列國年表為本項目據《左傳》《史記》整理；人物多有數名（名、字、諡、爵），人物卡並列之。'
	},
	legend: { person: ['重耳', '重耳'], place: ['城濮', '城濮'] }
};

export { similarity };
