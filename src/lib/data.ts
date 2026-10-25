// Loads the static JSON data. Paths are relative so the same build works from a web server
// and from a Tauri bundle.
import type { Catalog, Chapter, PlainChapter, Person, Place, HistEvent, Polity, Basemap } from './types';

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
export const loadPeople = () => load<Person[]>('people.json');
export const loadPlaces = () => load<Place[]>('places.json');
export const loadEvents = () => load<HistEvent[]>('events.json');
export const loadPolities = () => load<Record<string, Polity[]>>('polities.json');
export const loadBasemap = () => load<Basemap>('basemap.json');
