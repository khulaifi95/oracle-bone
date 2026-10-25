// Chinese numerals in dates.
const NUM = { 元: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 正: 1, 端: 1, 腊: 12 };

/** 元/正 → 1, 十二 → 12, 二十有五 → 25 (up to 99). */
export function zhNum(s) {
	s = s.replace(/有/g, '');
	if (s === '元' || s === '正' || s === '端') return 1;
	if (s === '腊') return 12;
	if (s.length === 1) return NUM[s];
	if (s[0] === '十') return 10 + (NUM[s[1]] ?? 0);
	if (s[1] === '十') return NUM[s[0]] * 10 + (NUM[s[2]] ?? 0);
	return null;
}
