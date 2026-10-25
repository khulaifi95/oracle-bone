// Dates in each book's own calendar: era years (the Julian year of the era year's 正月), lunar
// months counted from the book's 正月, and the names of the eras or reigns they fall in.
import type { Calendar, Era, Script } from './types';

export const NUM_ZH = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
export function zhNumber(n: number): string {
	if (n <= 10) return NUM_ZH[n];
	if (n < 20) return '十' + NUM_ZH[n - 10];
	const t = Math.floor(n / 10);
	const r = n % 10;
	return NUM_ZH[t] + '十' + (r ? NUM_ZH[r] : '');
}

/**
 * Position on a continuous time axis (Julian years) for an era year and a lunar month.
 * Month m is roughly Julian month m + m1; where the year begins late (秦曆, in 十月) the months
 * from `start` on fall in the Julian year before.
 */
export function timeOf(ey: number, m: number | null, cal: Calendar): number {
	if (m == null) return ey + 0.3;
	const time = ey + (m - 1 + cal.m1 + 0.5) / 12;
	return cal.start !== 1 && m >= cal.start ? time - 1 : time;
}

/** The Julian year an era year and month fall in (negative before the common era). */
export function julianYear(ey: number, m: number | null, cal: Calendar): number {
	return Math.floor(timeOf(ey, m, cal));
}

/** 前209 or 208, for axis labels. */
export function yearShort(y: number): string {
	return y < 0 ? `前${-y}` : `${y}`;
}

/** 公元前209年 or 公元208年. */
export function yearLong(y: number): string {
	return y < 0 ? `公元前${-y}年` : `公元${y}年`;
}

/** The era (年號, reign) an era year belongs to, for one court or state. */
export function eraOf(ey: number, cal: Calendar, court?: string): Era | null {
	const pick = (c?: string) => {
		let best: Era | null = null;
		for (const e of cal.eras) {
			if (c && e.court !== c) continue;
			if (e.from <= ey && (e.to == null || ey <= e.to) && (!best || e.from > best.from)) best = e;
		}
		return best;
	};
	if (!cal.mode) return pick();
	// before a court has eras of its own (魏 before 220), years go by the 漢 ones
	return pick(court) ?? (cal.mode === 'courts' ? pick(cal.courts?.[0]?.id) : null);
}

/** 建安十三年, 僖公二十八年; with `court`, the court or state is named first (魏黃初二年, 晉文公四年). */
export function eraLabel(ey: number, cal: Calendar, script: Script, court?: string, named = false): string {
	const era = eraOf(ey, cal, court);
	if (!era) return yearLong(ey);
	const n = ey - era.from + 1;
	const name = script === 't' ? (era.t ?? era.name) : era.name;
	const c = named ? cal.courts?.find((x) => x.id === era.court) : null;
	return `${c ? (script === 't' ? c.t : c.s) : ''}${name}${n === 1 ? '元' : zhNumber(n)}年`;
}

export function monthLabel(m: number | null): string {
	if (m == null) return '';
	return m === 1 ? '正月' : `${zhNumber(m)}月`;
}

/** 虛歲 in a Julian year. */
export function ageAt(born: number | null, year: number): number | null {
	if (born == null) return null;
	return year - born + 1;
}
