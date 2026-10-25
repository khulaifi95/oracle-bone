// Downloads the raw sources into sources/. Run once: `npm run fetch`.
// Large downloads (the corpus, Natural Earth) are cached in sources/cache/, which git ignores.
// Everything the build reads is written to sources/ as small text files and committed.
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'sources');
const CACHE = path.join(SRC, 'cache');
const UA = 'OracleBoneReader/0.1 (personal, non-commercial reading tool)';

const SHIJI = [7, 8, 48, 55, 92];
const WIKISOURCE = [
	...SHIJI.map((n) => [`史記三家註/卷${String(n).padStart(3, '0')}`, `wikisource/shiji-${pad(n)}.wiki`]),
	['漢書/卷001', 'wikisource/hanshu-001.wiki'],
	['漢書/卷031', 'wikisource/hanshu-031.wiki'],
	['漢書/卷034', 'wikisource/hanshu-034.wiki'],
	['漢書/卷040', 'wikisource/hanshu-040.wiki'],
	...[7, 8, 9, 10, 11].map((n) => [`資治通鑑/卷${pad(n)}`, `wikisource/tongjian-${pad(n)}.wiki`])
];
const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const GEO = ['ne_10m_rivers_lake_centerlines.geojson', 'ne_50m_coastline.geojson', 'ne_50m_lakes.geojson'];

function pad(n) {
	return String(n).padStart(3, '0');
}
const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
	for (let i = 0; ; i++) {
		const res = await fetch(url, { headers: { 'User-Agent': UA } });
		if (res.ok) return res;
		if (i >= tries || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
		await sleep(2000 * 2 ** i);
	}
}

async function save(rel, data) {
	const file = path.join(SRC, rel);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, data);
	console.log('wrote', rel);
}

async function wikisource() {
	for (const [title, rel] of WIKISOURCE) {
		if (await exists(path.join(SRC, rel))) continue;
		let page = title;
		let text;
		for (let hops = 0; hops < 3; hops++) {
			const url = `https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(page)}&action=raw`;
			text = await (await get(url)).text();
			await sleep(3000);
			const redirect = text.match(/^#REDIRECT\s*\[\[([^\]|#]+)/i);
			if (!redirect) break;
			page = redirect[1];
		}
		await save(rel, text);
	}
}

async function corpus() {
	const file = path.join(CACHE, 'corpus.jsonl');
	if (!(await exists(file))) {
		await mkdir(CACHE, { recursive: true });
		const url = 'https://huggingface.co/datasets/gujilab/chinese-classical-corpus/resolve/main/corpus.jsonl';
		await writeFile(file, Buffer.from(await (await get(url)).arrayBuffer()));
	}
	const want = new Set(SHIJI.map((n) => `shiji#${n}`));
	const lines = createInterface({ input: createReadStream(file, 'utf8') });
	for await (const line of lines) {
		const d = JSON.parse(line);
		if (want.has(d.id)) await save(`siku/shiji-${pad(d.volume)}.txt`, d.content);
	}
}

async function naturalEarth() {
	for (const name of GEO) {
		const file = path.join(CACHE, name);
		if (await exists(file)) continue;
		await mkdir(CACHE, { recursive: true });
		await writeFile(file, Buffer.from(await (await get(NATURAL_EARTH + name)).arrayBuffer()));
		console.log('cached', name);
	}
}

await corpus();
await wikisource();
await naturalEarth();
