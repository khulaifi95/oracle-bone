// Finds a public-domain portrait for each person: the lead image of their zh.wikipedia
// article (usually a 晚笑堂畫傳 or 三才圖會 woodcut), kept only if Commons marks it public
// domain. Thumbnails go to static/portraits/, provenance to data/portraits.json.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'OracleBoneReader/0.1 (https://github.com/khulaifi95/oracle-bone; personal non-commercial reading tool)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function api(host, params) {
	const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
	for (let attempt = 0; attempt < 4; attempt++) {
		const r = await fetch(url, { headers: { 'User-Agent': UA } });
		if (r.status === 429) {
			await sleep(5000 * (attempt + 1));
			continue;
		}
		return r.json();
	}
	throw new Error(`429 ${url}`);
}

const people = JSON.parse(await readFile(path.join(ROOT, 'data/people.json'), 'utf8')).people;
const outFile = path.join(ROOT, 'data/portraits.json');
const done = (await exists(outFile)) ? JSON.parse(await readFile(outFile, 'utf8')) : {};
await mkdir(path.join(ROOT, 'static/portraits'), { recursive: true });

for (const p of people) {
	if (p.id in done) continue;
	const titles = [...new Set([p.wiki, p.name, ...p.aliases].filter(Boolean))];
	let found = null;
	for (const title of titles) {
		const q = await api('zh.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', titles: title, redirects: '1' });
		await sleep(800);
		const page = q.query?.pages?.[0];
		if (!page || page.missing) continue;
		if (!page.pageimage) {
			found = { article: page.title };
			break;
		}
		const info = await api('commons.wikimedia.org', {
			action: 'query',
			prop: 'imageinfo',
			iiprop: 'url|extmetadata',
			iiurlwidth: '240',
			titles: `File:${page.pageimage}`
		});
		await sleep(800);
		const ii = info.query?.pages?.[0]?.imageinfo?.[0];
		const meta = ii?.extmetadata ?? {};
		const licence = meta.LicenseShortName?.value ?? '';
		const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').trim();
		found = {
			article: page.title,
			file: page.pageimage,
			licence,
			artist: strip(meta.Artist?.value),
			description: strip(meta.ImageDescription?.value).slice(0, 200),
			page: ii?.descriptionurl,
			thumb: ii?.thumburl
		};
		break;
	}
	if (found?.thumb && /public domain|^PD|CC0/i.test(found.licence)) {
		const ext = path.extname(new URL(found.thumb).pathname).toLowerCase() || '.jpg';
		const r = await fetch(found.thumb, { headers: { 'User-Agent': UA } });
		if (r.ok) {
			const name = `${p.id}${ext === '.jpeg' ? '.jpg' : ext}`;
			await writeFile(path.join(ROOT, 'static/portraits', name), Buffer.from(await r.arrayBuffer()));
			found.image = `portraits/${name}`;
		}
		await sleep(800);
	}
	done[p.id] = found;
	console.log(p.id, found?.image ?? '-', found?.licence ?? '', found?.file ?? '');
	await writeFile(outFile, JSON.stringify(done, null, '\t') + '\n');
}
