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
const UA = 'OracleBoneReader/0.1 (https://github.com/khulaifi95/oracle-bone; personal non-commercial reading tool)';

const SHIJI = [7, 8, 48, 55, 92];
const SANGUOZHI = [1, 32, 35, 47, 54];
const CHUNQIU = [1, 14, 15, 16];
const SIKU = [...SHIJI.map((n) => `shiji#${n}`), ...SANGUOZHI.map((n) => `sanguozhi#${n}`)];
const WIKISOURCE = [
	// 史記: the reading chapters, and the 秦/晉/楚/鄭 chapters read beside the 春秋
	...[...SHIJI, 5, 39, 40, 42].map((n) => [`史記三家註/卷${pad(n)}`, `wikisource/shiji-${pad(n)}.wiki`]),
	...SANGUOZHI.map((n) => [`三國志/卷${String(n).padStart(2, '0')}`, `wikisource/sanguozhi-${pad(n)}.wiki`]),
	// 春秋: the 四庫 注疏 (殿本) and the punctuated 正義, both cut into the same 卷
	...CHUNQIU.map((n) => [`春秋左傳注疏 (四庫全書本)/卷${String(n).padStart(2, '0')}`, `wikisource/zhushu-${pad(n)}.wiki`]),
	...CHUNQIU.map((n) => [`春秋左傳正義/卷${String(n).padStart(2, '0')}`, `wikisource/zhengyi-${pad(n)}.wiki`]),
	...['隱公', '僖公'].flatMap((g) => [
		[`春秋公羊傳/${g}`, `wikisource/gongyang-${g === '隱公' ? 'yin' : 'xi'}.wiki`],
		[`春秋穀梁傳/${g}`, `wikisource/guliang-${g === '隱公' ? 'yin' : 'xi'}.wiki`]
	]),
	['國語/卷10', 'wikisource/guoyu-010.wiki'],
	['後漢書/卷9', 'wikisource/houhanshu-009.wiki'],
	['後漢書/卷74上', 'wikisource/houhanshu-074a.wiki'],
	['後漢書/卷74下', 'wikisource/houhanshu-074b.wiki'],
	...[62, 63, 64, 65, 66, 67, 68, 69].map((n) => [`資治通鑑/卷${pad(n)}`, `wikisource/tongjian-${pad(n)}.wiki`]),
	['漢書/卷001', 'wikisource/hanshu-001.wiki'],
	['漢書/卷031', 'wikisource/hanshu-031.wiki'],
	['漢書/卷034', 'wikisource/hanshu-034.wiki'],
	['漢書/卷040', 'wikisource/hanshu-040.wiki'],
	...[7, 8, 9, 10, 11, 12].map((n) => [`資治通鑑/卷${pad(n)}`, `wikisource/tongjian-${pad(n)}.wiki`])
];
const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const GEO = ['ne_10m_rivers_lake_centerlines.geojson', 'ne_50m_coastline.geojson', 'ne_50m_lakes.geojson', 'ne_50m_land.geojson'];

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
	const want = new Set(SIKU);
	const lines = createInterface({ input: createReadStream(file, 'utf8') });
	for await (const line of lines) {
		const d = JSON.parse(line);
		// ids number the 卷 through the whole book (三國志 `volume` restarts in each 志)
		if (!want.has(d.id)) continue;
		const [book, n] = d.id.split('#');
		const rel = `siku/${book}-${pad(Number(n))}.txt`;
		if (!(await exists(path.join(SRC, rel)))) await save(rel, d.content);
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
