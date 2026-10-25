// Loads the static JSON data. Paths are relative so the same build works from a web server
// and from a Tauri bundle.
import type { Catalog, Chapter, PlainChapter, Person, Place, HistEvent, Polity, Basemap, SanzhuanEntry, Territory } from './types';

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
// your own pictures in static/portraits-local/ (never committed) take the place of the woodcuts
type LocalPortraits = Record<string, Record<string, string>>;
let localPortraits: Promise<LocalPortraits> | null = null;
const loadLocalPortraits = () =>
	(localPortraits ??= fetch('./portraits-local/index.json')
		.then((r): Promise<LocalPortraits> => (r.ok ? r.json() : Promise.resolve({})))
		.catch((): LocalPortraits => ({})));
export const loadPeople = (book: string) =>
	Promise.all([load<Person[]>(`${book}/people.json`), loadLocalPortraits()]).then(([people, local]) =>
		people.map((p) => {
			const file = local[book]?.[p.id] ?? local['*']?.[p.id];
			return file ? { ...p, portrait: { image: `portraits-local/${file}`, source: '本机所存' } } : p;
		})
	);
export const loadPlaces = (book: string) => load<Place[]>(`${book}/places.json`);
export const loadEvents = (book: string) => load<HistEvent[]>(`${book}/events.json`);
export const loadPolities = (book: string) => load<Record<string, Polity[]>>(`${book}/polities.json`);
export const loadTerritory = (book: string) => load<Territory>(`${book}/territory.json`).catch(() => null);
export const loadBasemap = (period: string) => load<Basemap>(`basemap-${period}.json`);
export const loadSanzhuan = (chapter: string) => load<{ id: string; entries: SanzhuanEntry[] }>(`sanzhuan/${chapter}.json`);
