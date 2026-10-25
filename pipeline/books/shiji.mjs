// 史记: the 秦汉之际 chapters, read in the 殿本 and the 金陵书局本.
import { buildShijiChapter } from '../text.mjs';
import { zhNum } from '../dates.mjs';

export const chapters = [
	{ juan: 7, title: '项羽本纪', t: '項羽本紀', kind: '本纪', n: '第七', era: 'ershi' },
	{ juan: 8, title: '高祖本纪', t: '高祖本紀', kind: '本纪', n: '第八', era: 'ershi' },
	{ juan: 48, title: '陈涉世家', t: '陳涉世家', kind: '世家', n: '第十八', era: 'ershi' },
	{ juan: 55, title: '留侯世家', t: '留侯世家', kind: '世家', n: '第二十五', era: 'han' },
	{ juan: 92, title: '淮阴侯列传', t: '淮陰侯列傳', kind: '列传', n: '第三十二', era: 'han' }
].map((c) => ({ ...c, juanZh: `卷${zhJuan(c.juan)}` }));

function zhJuan(n) {
	const D = '〇一二三四五六七八九';
	if (n < 10) return D[n];
	if (n < 20) return '十' + (n % 10 ? D[n % 10] : '');
	return D[Math.floor(n / 10)] + '十' + (n % 10 ? D[n % 10] : '');
}
export { zhJuan };

export const buildChapter = (c) => buildShijiChapter(c.juan);

export const book = {
	id: 'shiji',
	title: '史记',
	t: '史記',
	cluster: { s: '秦汉之际', t: '秦漢之際' },
	// the title the edition prints in the 卷首 and the 版心
	printed: { s: '史记', t: '史記' },
	notes: [
		{
			k: 'jijie', s: '集解', t: '集解', color: '#285f93', on: false, who: '南朝宋 裴骃',
			info: {
				s: '《史记集解》，现存最早的《史记》注。汇集徐广、贾逵、服虔、韦昭等汉魏旧注，多释字义、地名、典制。',
				t: '《史記集解》，現存最早的《史記》注。彙集徐廣、賈逵、服虔、韋昭等漢魏舊注，多釋字義、地名、典制。'
			}
		},
		{
			k: 'suoyin', s: '索隐', t: '索隱', color: '#2e7d4f', on: false, who: '唐 司马贞',
			info: {
				s: '《史记索隐》。注字音字义，补考史实，也评论司马迁的取舍体例，如以为项羽不当入本纪。',
				t: '《史記索隱》。注字音字義，補考史實，也評論司馬遷的取捨體例，如以為項羽不當入本紀。'
			}
		},
		{
			k: 'zhengyi', s: '正义', t: '正義', color: '#8f5a12', on: false, who: '唐 张守节',
			info: {
				s: '《史记正义》。长于地理，多引《括地志》，说明古地在唐时何处，兼释音义。',
				t: '《史記正義》。長於地理，多引《括地志》，說明古地在唐時何處，兼釋音義。'
			}
		},
		{
			k: 'kaozheng', s: '考证', t: '考證', color: '#b8322a', on: false, who: '清 武英殿校刊诸臣', only: 'd',
			info: {
				s: '乾隆四年殿本所附《考证》，校勘文字异同、辨正旧注。殿本独有，原附卷末，此处移到所考之字下。',
				t: '乾隆四年殿本所附《考證》，校勘文字異同、辨正舊注。殿本獨有，原附卷末，此處移到所考之字下。'
			}
		},
		{
			k: 'zan', s: '述赞', t: '述贊', color: '#6c3d91', on: true, who: '唐 司马贞',
			info: {
				s: '《索隐述赞》。司马贞为每篇所作的四言韵语，总括一篇大意，附于篇末。',
				t: '《索隱述贊》。司馬貞為每篇所作的四言韻語，總括一篇大意，附於篇末。'
			}
		}
	],
	notesLead: {
		s: '《史记》流传最广的是“三家注”本：南朝宋裴骃、唐司马贞、唐张守节三家的注，以双行小字夹在正文中。殿本另附清代馆臣的《考证》。各家颜色不同，可分别开关；“点记”只在正文留色点，读起来更清爽。',
		t: '《史記》流傳最廣的是「三家注」本：南朝宋裴駰、唐司馬貞、唐張守節三家的注，以雙行小字夾在正文中。殿本另附清代館臣的《考證》。各家顏色不同，可分別開關；「點記」只在正文留色點，讀起來更清爽。'
	},
	// 秦曆: the year begins in 十月, so 十月 to 十二月 fall in the Julian year before the 正月
	calendar: {
		start: 10,
		m1: 1,
		eras: [
			{ name: '始皇', from: -246, to: -210 },
			{ name: '二世', from: -209, to: -207 },
			{ name: '汉', t: '漢', from: -206, to: -195 }
		],
		note: {
			s: '年代以秦历推算：岁首十月，故「元年十月」在前一年冬。岁数为虚岁。时间轴由右向左，与书写方向一致。',
			t: '年代以秦曆推算：歲首十月，故「元年十月」在前一年冬。歲數為虛歲。時間軸由右向左，與書寫方向一致。'
		}
	},
	sides: [
		{ id: 'qin', s: '秦', t: '秦', color: '#3d4a5c' },
		{ id: 'chu', s: '楚', t: '楚', color: '#b8322a' },
		{ id: 'han', s: '汉', t: '漢', color: '#c7891d' },
		{ id: 'other', s: '诸侯', t: '諸侯', color: '#2f7d5b' }
	],
	// the years before 二世 and after 垓下 are compressed
	timeline: {
		breaks: [[-219, 0], [-210.2, 0.07], [-201, 0.9], [-194.5, 1]],
		from: -218,
		to: -195,
		major: [-210, -201],
		minor: [-218, -214, -198, -195],
		marks: [
			{ ey: -209, s: '二世', t: '二世' },
			{ ey: -206, s: '汉', t: '漢' },
			{ ey: -202, s: '汉五年 称帝', t: '漢五年 稱帝' }
		]
	},
	map: {
		period: 'qinhan',
		// the heartland of the 秦漢之際 wars, from 關中 to the sea
		home: [106.5, 28.5, 122.5, 38.8],
		named: ['河', '江', '淮水', '渭水', '汉水', '济水', '鸿沟', '睢水', '泗水', '漳水', '颍水', '汾水'],
		marshNames: ['大野泽', '云梦泽'],
		empty: { s: '秦统一天下，郡县治之。', t: '秦統一天下，郡縣治之。' },
		purpose: {
			s: '此图随所读之处而变：方框是当年诸侯的国都，颜色分秦、楚、汉与其他诸侯；蓝点是本段前后提到的地方，红点是本事发生之地。山川、海岸依秦汉之际的形势。点地名看详情。',
			t: '此圖隨所讀之處而變：方框是當年諸侯的國都，顏色分秦、楚、漢與其他諸侯；藍點是本段前後提到的地方，紅點是本事發生之地。山川、海岸依秦漢之際的形勢。點地名看詳情。'
		},
		key: { s: '河、淮、泗、睢、鸿沟与海岸依秦汉故道，约略', t: '河、淮、泗、睢、鴻溝與海岸依秦漢故道，約略' },
		about: {
			s: '（公有领域），再改绘为秦汉之际的形势：黄河下游依西汉故道，今黄河下游一线标为济水；淮水自盱眙东流入海，不绘洪泽湖等后世湖泊；补绘泗水、睢水、鸿沟，及大野、云梦、彭蠡等泽；苏北、长江口、渤海西南岸的海岸依古海岸线，今海岸以虚线示之。以上均据谭其骧《中国历史地图集》第二册约略绘出。地名坐标取古城遗址或今治所的约略位置。',
			t: '（公有領域），再改繪為秦漢之際的形勢：黃河下游依西漢故道，今黃河下游一線標為濟水；淮水自盱眙東流入海，不繪洪澤湖等後世湖泊；補繪泗水、睢水、鴻溝，及大野、雲夢、彭蠡等澤；蘇北、長江口、渤海西南岸的海岸依古海岸線，今海岸以虛線示之。以上均據譚其驤《中國歷史地圖集》第二冊約略繪出。地名坐標取古城遺址或今治所的約略位置。'
		}
	},
	parallels: {
		books: ['hanshu', 'tongjian'],
		chapters: ['hanshu-1', 'hanshu-31', 'hanshu-34', 'hanshu-40', 'tongjian-7', 'tongjian-8', 'tongjian-9', 'tongjian-10', 'tongjian-11', 'tongjian-12'],
		how: {
			s: '每一事先由人工在《史记》《汉书》《资治通鉴》中各定一句起句（及止句）；再以别书所载本事为准，逐句向前后推展，凡与之四字连文相合达四分之一者并入，至不合处为止，一句只归一事；他处与本事文句相合达四成的，也照此找出，标为“同文”。比照以当前所读之篇为底本：标色之字是措辞不同处，百分数是该段文字见于底本的比例。',
			t: '每一事先由人工在《史記》《漢書》《資治通鑑》中各定一句起句（及止句）；再以別書所載本事為準，逐句向前後推展，凡與之四字連文相合達四分之一者併入，至不合處為止，一句只歸一事；他處與本事文句相合達四成的，也照此找出，標為「同文」。比照以當前所讀之篇為底本：標色之字是措辭不同處，百分數是該段文字見於底本的比例。'
		},
		sources: {
			s: '《汉书》卷一、三十一、三十四、四十，《资治通鉴》卷七至十二，录文据维基文库（CC BY-SA 4.0）。',
			t: '《漢書》卷一、三十一、三十四、四十，《資治通鑑》卷七至十二，錄文據維基文庫（CC BY-SA 4.0）。'
		}
	},
	data: {
		s: '人物、地名、事件、诸侯年表为本项目据史记、汉书整理；人物生年多由本文推得，见人物卡说明。',
		t: '人物、地名、事件、諸侯年表為本項目據史記、漢書整理；人物生年多由本文推得，見人物卡說明。'
	},
	legend: { person: ['項羽', '项羽'], place: ['彭城', '彭城'] }
};

// ---------------------------------------------------------------- dates in the text
const MONTH_ORDER = (m) => (m >= 10 ? m - 10 : m + 3);
const DATE_RE = /(秦二世|二世皇帝|二世|汉之|汉王|汉|高祖|高帝|始皇帝|始皇)?([元一二三四五六七八九十]{1,3})年(?:(春|夏|秋|冬))?(?:(正|端|腊|后九|[一二三四五六七八九十]{1,2})月)?|(其|后|是|至|以)?(正|腊|后九|[一二三四五六七八九十]{1,2})月|(?<![一-龥])(春|夏|秋|冬)(?=[，。])/g;
const SEASON_MONTH = { 春: 1, 夏: 4, 秋: 7, 冬: 10 };

/** Reads the 秦/汉 dates of a chapter's sentences in order. */
export function dateScanner(c) {
	let era = c.era;
	let cur = null;
	return (seg) => {
		const text = seg.j.s;
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
				found.push({ ey: year, m: mm, x: all });
			} else if (monthOnly && cur && opens) {
				const mm = monthOnly === '后九' ? 9 : zhNum(monthOnly);
				if (!mm || mm > 12) continue;
				if (cur.m && MONTH_ORDER(mm) < MONTH_ORDER(cur.m)) cur = { ey: cur.ey + 1, m: mm };
				else cur = { ey: cur.ey, m: mm };
				found.push({ ey: cur.ey, m: mm, x: all });
			} else if (seasonOnly && cur && m.index === 0) {
				const mm = SEASON_MONTH[seasonOnly];
				if (cur.m && MONTH_ORDER(mm) < MONTH_ORDER(cur.m)) cur = { ey: cur.ey + 1, m: mm };
				else cur = { ey: cur.ey, m: mm };
				found.push({ ey: cur.ey, m: mm, x: all });
			}
		}
		return found;
	};
}
