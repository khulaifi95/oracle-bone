// Interface state shared by all components. Settings persist in localStorage.
import type { Ed, NoteKind } from './types';

export type Form = 'scroll' | 'book';
export type EditionMode = Ed | 'both';
export type Punct = 'none' | 'judou' | 'full';
export type Panel = 'map' | 'people' | 'parallel' | 'variants' | 'note' | 'about';
export type Face = 'kai' | 'song';
/** commentary set inline as 雙行小注, or reduced to small marks that open in the side panel */
export type NotesMode = 'inline' | 'mark';

interface Settings {
	edition: EditionMode;
	form: Form;
	script: 's' | 't';
	punct: Punct;
	notes: Record<NoteKind, boolean>;
	notesMode: NotesMode;
	face: Face;
	names: boolean;
	variants: boolean;
	size: number;
	panel: Panel;
	chapter: string;
}

const DEFAULTS: Settings = {
	edition: 'd',
	form: 'scroll',
	script: 's',
	punct: 'none',
	notes: { jijie: false, suoyin: false, zhengyi: false, kaozheng: false, zan: true },
	notesMode: 'inline',
	face: 'kai',
	names: true,
	variants: true,
	size: 26,
	panel: 'map',
	chapter: 'shiji-7'
};

function restore(): Settings {
	try {
		const raw = localStorage.getItem('oracle-bone:settings');
		if (raw) {
			const s = JSON.parse(raw);
			return { ...DEFAULTS, ...s, notes: { ...DEFAULTS.notes, ...s.notes } };
		}
	} catch {
		// private window or blocked storage: start from defaults
	}
	return structuredClone(DEFAULTS);
}

class AppState {
	settings = $state<Settings>(restore());
	/** current reading position (segment id) */
	seg = $state<string | null>(null);
	/** a request for the reader to bring a segment into view */
	jump = $state<{ seg: string; n: number } | null>(null);
	person = $state<string | null>(null);
	place = $state<string | null>(null);
	note = $state<{ ed: Ed; id: string; seg: string } | null>(null);
	variant = $state<string | null>(null);
	event = $state<string | null>(null);
	/** the parallel accounts opened over the reader */
	parallelWide = $state(false);
	/** the map opened over the reader */
	mapWide = $state(false);

	save() {
		try {
			localStorage.setItem('oracle-bone:settings', JSON.stringify(this.settings));
		} catch {
			// storage unavailable: settings last for this session only
		}
	}

	goto(seg: string) {
		this.seg = seg;
		this.jump = { seg, n: (this.jump?.n ?? 0) + 1 };
	}
}

export const app = new AppState();

// ---------------------------------------------------------------- dates
export const NUM_ZH = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
export function zhNumber(n: number): string {
	if (n <= 10) return NUM_ZH[n];
	if (n < 20) return '十' + NUM_ZH[n - 10];
	const t = Math.floor(n / 10);
	const r = n % 10;
	return NUM_ZH[t] + '十' + (r ? NUM_ZH[r] : '');
}

/** Position on a continuous time axis for an era year (year of its 正月) and a month (秦曆, year starts in 十月). */
export function timeOf(ey: number, m: number | null): number {
	if (m == null) return ey + 0.3;
	// lunar month m is roughly Julian month m+1; months 10–12 fall in the previous Julian year
	return m >= 10 ? ey - 1 + (m + 0.5) / 12 : ey + (m + 0.5) / 12;
}

/** The Julian (BCE) year an era year + month falls in, as a positive BCE number. */
export function bceOf(ey: number, m: number | null): number {
	return -(m != null && m >= 10 ? ey - 1 : ey);
}

/** 秦/汉 era label for an era year. */
export function eraLabel(ey: number): string {
	if (ey <= -210) {
		const n = 246 + ey + 1;
		return `始皇${n === 1 ? '元' : zhNumber(n)}年`;
	}
	if (ey <= -207) return `二世${ey === -209 ? '元' : zhNumber(ey + 210)}年`;
	return `汉${ey === -206 ? '元' : zhNumber(ey + 207)}年`;
}

export function monthLabel(m: number | null): string {
	if (m == null) return '';
	return m === 1 ? '正月' : `${zhNumber(m)}月`;
}

/** 虚岁 at a BCE year. */
export function ageAt(born: number | null, bce: number): number | null {
	if (born == null) return null;
	return -born - bce + 1;
}

// ---------------------------------------------------------------- labels
export const NOTE_LABEL: Record<NoteKind, string> = { jijie: '集解', suoyin: '索隐', zhengyi: '正义', kaozheng: '考证', zan: '述赞' };
export const NOTE_LABEL_T: Record<NoteKind, string> = { jijie: '集解', suoyin: '索隱', zhengyi: '正義', kaozheng: '考證', zan: '述贊' };
export const SIDE_LABEL = { qin: '秦', chu: '楚', han: '汉', other: '诸侯' } as const;
export const VARIANT_LABEL = { text: '异文', form: '异体', taboo: '避讳', graphic: '形近' } as const;

/** What each commentary is, for readers meeting them for the first time. */
export const NOTE_INFO: Record<NoteKind, { who: string; s: string; t: string }> = {
	jijie: {
		who: '南朝宋 裴骃',
		s: '《史记集解》，现存最早的《史记》注。汇集徐广、贾逵、服虔、韦昭等汉魏旧注，多释字义、地名、典制。',
		t: '《史記集解》，現存最早的《史記》注。彙集徐廣、賈逵、服虔、韋昭等漢魏舊注，多釋字義、地名、典制。'
	},
	suoyin: {
		who: '唐 司马贞',
		s: '《史记索隐》。注字音字义，补考史实，也评论司马迁的取舍体例，如以为项羽不当入本纪。',
		t: '《史記索隱》。注字音字義，補考史實，也評論司馬遷的取捨體例，如以為項羽不當入本紀。'
	},
	zhengyi: {
		who: '唐 张守节',
		s: '《史记正义》。长于地理，多引《括地志》，说明古地在唐时何处，兼释音义。',
		t: '《史記正義》。長於地理，多引《括地志》，說明古地在唐時何處，兼釋音義。'
	},
	kaozheng: {
		who: '清 武英殿校刊诸臣',
		s: '乾隆四年殿本所附《考证》，校勘文字异同、辨正旧注。殿本独有，原附卷末，此处移到所考之字下。',
		t: '乾隆四年殿本所附《考證》，校勘文字異同、辨正舊注。殿本獨有，原附卷末，此處移到所考之字下。'
	},
	zan: {
		who: '唐 司马贞',
		s: '《索隐述赞》。司马贞为每篇所作的四言韵语，总括一篇大意，附于篇末。',
		t: '《索隱述贊》。司馬貞為每篇所作的四言韻語，總括一篇大意，附於篇末。'
	}
};
