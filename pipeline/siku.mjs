// Parser for the 四庫全書本 text from the gujilab corpus: unpunctuated, simplified,
// commentary inline in 【】 with its source named at the start (集解/索隐/正义),
// and the 殿本考證 appended after the chapter.

// The transcription writes 缺筆 taboo forms (the last stroke left off, for 康熙 玄燁 and
// 乾隆 弘曆) and some rare characters as private-use code points.
export const QUEBI = { '\uea20': '玄', '\uea1f': '弘' };
export const isPUA = (c) => c >= '\ue000' && c <= '\uf8ff';
/** Readable text for notes and headers: 缺筆 forms as the full character, other private-use characters as 〓. */
export const fixPUA = (s) => [...s].map((c) => QUEBI[c] ?? (isPUA(c) ? '〓' : c)).join('');

const LABEL = /(集解|集觧|索隐|索隠|正义|正義)/;
const KIND = { 集解: 'jijie', 集觧: 'jijie', 索隐: 'suoyin', 索隠: 'suoyin', 正义: 'zhengyi', 正義: 'zhengyi' };

export function parseSiku(src) {
	// The chapter ends at a 史记卷N line; the 考證 follows under 史记卷N考证.
	const NUM = '[〇一二三四五六七八九十百]+';
	const flat = src.replace(/[ \t　]+/g, '');
	const kzAt = flat.search(new RegExp(`史记[卷巻]${NUM}考证`));
	const mainPart = kzAt < 0 ? flat : flat.slice(0, kzAt);
	const endAt = mainPart.search(new RegExp(`\n史记[卷巻]${NUM}(\n|$)|史记[卷巻]${NUM}$`));
	const lines = (endAt < 0 ? mainPart : mainPart.slice(0, endAt)).split('\n');
	const kzLines = kzAt < 0 ? [] : flat.slice(kzAt).split('\n').slice(1);
	const endIdx = -1;
	const header = [];
	let i = 0;
	while (i < lines.length && !lines[i].includes('【') && !/(本纪|世家|列传)第/.test(lines[i])) {
		// some chapters run the author lines together; split after each role
		if (lines[i]) header.push(...fixPUA(lines[i]).split(/(?<=撰|集解|集觧|索隐|索隠|正义)/).filter(Boolean));
		i++;
	}
	const title = lines[i] && !lines[i].includes('【') ? lines[i++] : '';
	const body = lines.slice(i, endIdx < 0 ? undefined : endIdx).join('');

	// Tokenise main text and 【】 blocks.
	const tokens = [];
	let buf = '';
	for (let k = 0; k < body.length; k++) {
		const c = body[k];
		if (c === '【') {
			const end = body.indexOf('】', k);
			const inner = body.slice(k + 1, end < 0 ? body.length : end);
			k = end < 0 ? body.length : end;
			if (!LABEL.test(inner.slice(0, 4)) && !inner.startsWith('索')) {
				// Not a note: a stray main-text character the transcription bracketed at a page break.
				buf += inner;
				continue;
			}
			if (buf) tokens.push({ t: 'text', s: buf });
			buf = '';
			tokens.push({ t: 'note', raw: inner });
		} else buf += c;
	}
	if (buf) tokens.push({ t: 'text', s: buf });

	const kaozheng = [];
	{
		for (const l of kzLines) {
			if (!l || /^史记.+考证$/.test(l) || l.startsWith('<')) continue;
			const cut = l.indexOf('○');
			if (cut < 0) continue;
			const cite = l.slice(0, cut);
			const m = cite.match(LABEL);
			kaozheng.push({ lemma: fixPUA(m ? cite.slice(0, m.index) : cite), cite: fixPUA(cite), text: fixPUA(l.slice(cut + 1)).replace(/○/g, '　') });
		}
	}
	return { header, title, tokens, kaozheng };
}

/** Split a raw 【】 note into labelled parts. `hint(i)` may name the kind for an unlabelled 索 split. */
export function splitNote(raw, suoyinStarts = []) {
	const parts = [];
	let rest = raw;
	let kind = null;
	const re = /(集解|集觧|索隐|索隠|正义|正義|索(?=述赞|述賛))/g;
	let last = 0;
	let m;
	const cuts = [];
	while ((m = re.exec(raw))) cuts.push({ at: m.index, len: m[0].length, kind: KIND[m[0]] ?? 'zan' });
	// A lone 索 marks a 索隐 note when what follows matches the start of the 金陵本 索隱 note.
	for (const start of suoyinStarts) {
		if (!start) continue;
		const at = raw.indexOf('索' + start);
		if (at >= 0 && !cuts.some((c) => Math.abs(c.at - at) < 2)) cuts.push({ at, len: 1, kind: 'suoyin' });
	}
	cuts.sort((a, b) => a.at - b.at);
	for (const c of cuts) {
		if (c.at > last && kind) parts.push({ kind, text: raw.slice(last, c.at) });
		else if (c.at > last) parts.push({ kind: 'suoyin', text: raw.slice(last, c.at) });
		kind = c.kind;
		last = c.at + c.len;
	}
	if (last < raw.length) parts.push({ kind: kind ?? 'suoyin', text: raw.slice(last) });
	rest = null;
	for (const p of parts) if (p.text.startsWith('述赞曰') || p.text.startsWith('述賛曰')) {
		p.kind = 'zan';
		p.text = p.text.slice(3);
	}
	return parts.filter((p) => p.text);
}
