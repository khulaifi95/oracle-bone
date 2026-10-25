// Script conversion and normalisation helpers.
import * as OpenCC from 'opencc-js';

const jpToT = OpenCC.Converter({ from: 'jp', to: 't' });
const tToCn = OpenCC.Converter({ from: 't', to: 'cn' });
const cnToT = OpenCC.Converter({ from: 'cn', to: 't' });

// Variant glyphs found in the 四庫 transcription that OpenCC leaves alone,
// mapped to the standard simplified form. Used for display and for alignment.
const VARIANTS = {
	劒: '剑', 劔: '剑', 隂: '阴', 賔: '宾', 竒: '奇', 逺: '远', 髙: '高', 冡: '冢', 葢: '盖', 慿: '凭', 呉: '吴',
	闗: '关', 臯: '皋', 顔: '颜', 刋: '刊', 戸: '户', 瓉: '瓒', 湼: '涅', 頴: '颖', 賛: '赞', 絶: '绝', 隠: '隐',
	渉: '涉', 爲: '为', 歴: '历', 勲: '勋', 従: '从', 曽: '曾', 巻: '卷', 懐: '怀', 叚: '段', 兾: '冀', 敺: '驱',
	鄉: '乡', 郷: '乡', 厯: '历', 祕: '秘', 衞: '卫', 嵗: '岁', 嵅: '函', 歩: '步', 殻: '壳', 啚: '图', 囙: '因',
	羣: '群', 畧: '略', 畆: '亩', 竢: '俟', 冦: '寇', 窓: '窗', 寃: '冤', 姦: '奸', 囘: '回', 廹: '迫', 尅: '克',
	鑛: '矿', 醖: '酝', 鷄: '鸡', 雞: '鸡', 蠭: '蜂', 鬬: '斗', 鬭: '斗', 閧: '哄', 兠: '兜', 匃: '丐', 蔕: '蒂',
	緐: '繁', 秪: '只', 衆: '众', 眾: '众', 恠: '怪', 甞: '尝', 嚐: '尝', 讐: '雠', 讎: '雠', 糓: '谷', 穀: '谷',
	珎: '珍', 煕: '熙', 熈: '熙', 鞌: '鞍', 粦: '磷', 迯: '逃', 廵: '巡', 徃: '往', 葅: '菹', 彊: '强', 疎: '疏',
	踈: '疏', 皐: '皋', 皷: '鼓', 鼔: '鼓', 槩: '概', 杯: '杯', 盃: '杯', 筯: '箸', 牎: '窗', 卹: '恤', 衂: '衄',
	犇: '奔', 洩: '泄', 綫: '线', 溼: '湿', 鴈: '雁', 隄: '堤', 隣: '邻', 鄰: '邻', 菓: '果', 煖: '暖', 㬉: '暖',
	栢: '柏', 柟: '楠', 秔: '粳', 傚: '效', 効: '效', 憇: '憩', 竪: '竖', 豎: '竖', 埶: '势', 蚤: '早',
	於: '于', 嘗: '尝', 錢: '钱'
};
// Characters that are deliberate in the texts and must not be simplified for display (classical usage).
const KEEP_SIMPLIFIED = new Set([]);

/** One-to-one character normaliser: any form → standard simplified. */
const cache = new Map();
export function normChar(c) {
	let r = cache.get(c);
	if (r !== undefined) return r;
	r = VARIANTS[c];
	if (!r) {
		const x = tToCn(jpToT(c));
		r = [...x].length === 1 ? x : c;
		if (VARIANTS[r]) r = VARIANTS[r];
	}
	cache.set(c, r);
	return r;
}

/** Simplify a traditional string, keeping one output char per input char. */
export function toSimplified(s) {
	const chars = [...s];
	const phrase = [...tToCn(s)];
	if (phrase.length === chars.length) return phrase.map((c, i) => (KEEP_SIMPLIFIED.has(chars[i]) ? chars[i] : VARIANTS[c] ?? c)).join('');
	return chars.map(normChar).join('');
}

/** Traditionalise a simplified string, keeping one output char per input char. */
export function toTraditional(s) {
	const chars = [...s];
	const phrase = [...cnToT(s)];
	if (phrase.length === chars.length) return phrase.join('');
	return chars.map((c) => {
		const x = [...cnToT(c)];
		return x.length === 1 ? x[0] : c;
	}).join('');
}

export const PUNCT_AFTER = new Set([...'，。、；：？！」』》〉）…—·']);
export const PUNCT_BEFORE = new Set([...'「『《〈（']);
export const isPunct = (c) => PUNCT_AFTER.has(c) || PUNCT_BEFORE.has(c);
