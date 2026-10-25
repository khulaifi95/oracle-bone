// Loads the static JSON data. Paths are relative so the same build works from a web server
// and from a Tauri bundle.
import type { Catalog, Chapter, PlainChapter, Person, Place, HistEvent, Polity, Basemap, SanzhuanEntry } from './types';

const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
	let p = cache.get(path);
	if (!p) {
		p = fetch(`./data/${path}`).then((r) => {
			if (!r.ok) throw new Error(`${r.status} ${path}`);
			return r.json();
		});
		cache.set(path, p);
	}
	return p as Promise<T>;
}

export const loadCatalog = () => load<Catalog>('catalog.json');
export const loadChapter = (id: string) => load<Chapter>(`text/${id}.json`);
export const loadPlain = (id: string) => load<PlainChapter>(`text/${id}.json`);
// each reading book has its own people, places, events and states by year
export const loadPeople = (book: string) => load<Person[]>(`${book}/people.json`);
export const loadPlaces = (book: string) => load<Place[]>(`${book}/places.json`);
export const loadEvents = (book: string) => load<HistEvent[]>(`${book}/events.json`);
export const loadPolities = (book: string) => load<Record<string, Polity[]>>(`${book}/polities.json`);
export const loadBasemap = (period: string) => load<Basemap>(`basemap-${period}.json`);
export const loadSanzhuan = (chapter: string) => load<{ id: string; entries: SanzhuanEntry[] }>(`sanzhuan/${chapter}.json`);
