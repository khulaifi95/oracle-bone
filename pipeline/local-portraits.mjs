// Indexes the portraits you keep on your own machine in static/portraits-local/, which git
// ignores. A picture named after a person's id (zhuge-liang.png) replaces that person's woodcut
// in every book; one in a book's folder (sanguozhi/zhuge-liang.png) only in that book.
// Runs before `npm run dev` and `npm run build`; run it again after adding pictures to a dev server.
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'static/portraits-local';
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;

const index = {};
const add = (book, file) => {
	(index[book] ??= {})[path.basename(file).replace(IMAGE, '')] = file;
};
for (const entry of await readdir(DIR, { withFileTypes: true }).catch(() => [])) {
	if (entry.isFile() && IMAGE.test(entry.name)) add('*', entry.name);
	else if (entry.isDirectory())
		for (const f of await readdir(path.join(DIR, entry.name))) if (IMAGE.test(f)) add(entry.name, `${entry.name}/${f}`);
}
await writeFile(path.join(DIR, 'index.json'), JSON.stringify(index));
const n = Object.values(index).reduce((s, b) => s + Object.keys(b).length, 0);
console.log(`portraits-local: ${n} picture${n === 1 ? '' : 's'}`);
