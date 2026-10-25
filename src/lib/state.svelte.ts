// Interface state shared by all components. Settings persist in localStorage.
import type { Ed, NoteKind } from './types';

export type Form = 'scroll' | 'book';
export type EditionMode = Ed | 'both';
export type Punct = 'none' | 'judou' | 'full';
export type Panel = 'map' | 'people' | 'parallel' | 'sanzhuan' | 'variants' | 'note' | 'about';
/** 春秋: read 經 and 傳 together, or one of them alone */
export type JingZhuan = 'all' | 'jing' | 'zhuan';
export type Face = 'kai' | 'song';
/** commentary set inline as 雙行小注, or reduced to small marks that open in the side panel */
export type NotesMode = 'inline' | 'mark';

interface Settings {
	edition: EditionMode;
	form: Form;
	script: 's' | 't';
	punct: Punct;
	/** each commentary on or off; a book's defaults fill in the ones never set */
	notes: Record<NoteKind, boolean>;
	notesMode: NotesMode;
	jz: JingZhuan;
	face: Face;
	names: boolean;
	variants: boolean;
	size: number;
	panel: Panel;
	chapter: string;
	/** the chapter last read in each book */
	chapters: Record<string, string>;
}

const DEFAULTS: Settings = {
	edition: 'd',
	form: 'scroll',
	script: 's',
	punct: 'none',
	notes: {},
	notesMode: 'inline',
	jz: 'all',
	face: 'kai',
	names: true,
	variants: true,
	size: 26,
	panel: 'map',
	chapter: 'shiji-7',
	chapters: {}
};

function restore(): Settings {
	try {
		const raw = localStorage.getItem('oracle-bone:settings');
		if (raw) {
			const s = JSON.parse(raw);
			return { ...DEFAULTS, ...s, notes: { ...DEFAULTS.notes, ...s.notes }, chapters: { ...s.chapters } };
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

// ---------------------------------------------------------------- labels
export const VARIANT_LABEL = { text: '异文', form: '异体', taboo: '避讳', graphic: '形近' } as const;
