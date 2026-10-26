// Cuts the 楷書 face (霞鶩文楷) down to the characters the site uses, one file per weight.
// The npm webfont splits the face into about a hundred files by Unicode range, so a page asked for
// dozens of them and its characters appeared over a second or more. One file loads once.
// Characters missing from the cut (text added later) still come from the split webfont.
// Run after `npm run data`; the full fonts are downloaded to sources/cache/fonts/ once.
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';

const VERSION = 'v1.501';
const FACES = [
	{ file: 'LXGWWenKai-Regular.ttf', out: 'wenkai-400.woff2' },
	{ file: 'LXGWWenKai-Medium.ttf', out: 'wenkai-600.woff2' }
];
const CACHE = 'sources/cache/fonts';
const OUT = 'static/fonts';

async function walk(dir, exts) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(p, exts)));
		else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
	}
	return out;
}

const chars = new Set();
for (const f of [...(await walk('static/data', ['.json'])), ...(await walk('src', ['.svelte', '.ts', '.html', '.css']))])
	for (const c of await readFile(f, 'utf8')) chars.add(c);
// ASCII and the punctuation set in the vertical forms
for (let i = 0x20; i < 0x7f; i++) chars.add(String.fromCharCode(i));
for (const c of '︐︑︒︓︔︕︖︗︘︙︰︱︳︴︵︶︷︸︹︺︻︼︽︾︿﹀﹁﹂﹃﹄﹇﹈') chars.add(c);
const text = [...chars].join('');

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
for (const { file, out } of FACES) {
	const src = path.join(CACHE, file);
	try {
		await access(src);
	} catch {
		const url = `https://github.com/lxgw/LxgwWenKai/releases/download/${VERSION}/${file}`;
		console.log('downloading', url);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${res.status} ${url}`);
		await writeFile(src, Buffer.from(await res.arrayBuffer()));
	}
	const woff2 = await subsetFont(await readFile(src), text, { targetFormat: 'woff2' });
	await writeFile(path.join(OUT, out), woff2);
	console.log(`fonts/${out}: ${chars.size} characters, ${Math.round(woff2.length / 1024)}k`);
}
