// A small parser for the Wikisource wikitext of 史記三家註 and the plain 漢書/通鑑 pages.
// It understands only the templates those pages use.

/** Parse wikitext into a tree of strings and {tpl, args} nodes. */
export function parseTree(src) {
	let i = 0;
	function parseUntil(stops) {
		const out = [];
		let buf = '';
		const flush = () => {
			if (buf) out.push(buf);
			buf = '';
		};
		while (i < src.length) {
			if (stops.some((s) => src.startsWith(s, i))) break;
			if (src.startsWith('{{', i)) {
				flush();
				i += 2;
				const args = [];
				for (;;) {
					args.push(parseUntil(['|', '}}']));
					if (src.startsWith('|', i)) {
						i += 1;
						continue;
					}
					i += 2;
					break;
				}
				const name = text(args[0]).trim();
				out.push({ tpl: name, args: args.slice(1) });
			} else if (src.startsWith('[[', i)) {
				flush();
				i += 2;
				const target = parseUntil(['|', ']]']);
				let label = target;
				if (src.startsWith('|', i)) {
					i += 1;
					label = parseUntil([']]']);
				}
				i += 2;
				out.push(...label);
			} else if (src.startsWith('-{', i)) {
				i += 2;
			} else if (src.startsWith('}-', i)) {
				i += 2;
			} else if (src.startsWith('<!--', i)) {
				const end = src.indexOf('-->', i);
				i = end < 0 ? src.length : end + 3;
			} else if (src[i] === '<') {
				const end = src.indexOf('>', i);
				i = end < 0 ? src.length : end + 1;
			} else if (src.startsWith("'''", i)) {
				i += 3;
			} else if (src.startsWith("''", i)) {
				i += 2;
			} else {
				buf += src[i++];
			}
		}
		flush();
		return out;
	}
	return parseUntil([]);
}

/** Flatten a node list to plain text, unwrapping formatting templates. */
export function text(nodes, edition = 'base') {
	let s = '';
	for (const n of nodes) {
		if (typeof n === 'string') s += n;
		else s += tplText(n, edition);
	}
	return s;
}

const UNWRAP = new Set(['專', '書', 'ProperNoun', 'WavyBookMark', '楷體', '+', 'green', 'deepPink', 'DeepPink', '-', 'quote']);

function tplText(n, edition) {
	// YL: a reign year, with the AD year as an optional second argument
	if (n.tpl === 'YL') return text(n.args[0] ?? [], edition);
	if (UNWRAP.has(n.tpl)) return text(n.args[n.args.length - 1] ?? [], edition);
	// 點校本 marks: 刪 = present in the 底本 but deleted by the editors, 增 = added by the editors.
	if (n.tpl === '刪') return edition === 'base' ? text(n.args[0] ?? [], edition) : '';
	if (n.tpl === '增') return edition === 'base' ? '' : text(n.args[0] ?? [], edition);
	// 另: the reading of the text, then another edition's
	if (n.tpl === '另') return text(n.args[0] ?? [], edition);
	if (n.tpl === '!') return '|';
	return '';
}

const KINDS = { 集解: 'jijie', 索隱: 'suoyin', 正義: 'zhengyi', 索隱述贊: 'zan' };

/**
 * Turn a parsed 三家註 note block ({{*|...}}) into parts: [{kind, text, marks}].
 * 正義 has no wrapper template, so its text runs until the next CBox.
 */
function noteParts(nodes, defaultKind = 'suoyin') {
	const parts = [];
	let cur = null;
	const push = (s, marks) => {
		if (!cur) {
			cur = { kind: defaultKind, text: '', marks: [] };
			parts.push(cur);
		}
		for (const m of marks ?? []) cur.marks.push({ ...m, at: cur.text.length + m.at });
		cur.text += s;
	};
	const walk = (list) => {
		for (const n of list) {
			if (typeof n === 'string') push(n);
			else if (n.tpl === 'CBox') {
				const label = text(n.args[0] ?? []).trim();
				cur = { kind: KINDS[label] ?? 'zhengyi', text: '', marks: [] };
				parts.push(cur);
			} else if (n.tpl === '刪' || n.tpl === '增') {
				const s = text(n.args[0] ?? []);
				push(n.tpl === '刪' ? s : '', [{ at: 0, type: n.tpl === '刪' ? 'del' : 'add', text: s }]);
			} else if (UNWRAP.has(n.tpl)) walk(n.args[n.args.length - 1] ?? []);
		}
	};
	walk(nodes);
	for (const p of parts) p.text = p.text.replace(/[\s　]+/g, '');
	return parts.filter((p) => p.text);
}

/**
 * Parse a 史記三家註 (or 三國志) chapter into paragraphs of tokens:
 *   {t:'text', s, edits:[{at, type:'del'|'add', text}]}  main text (底本 reading)
 *   {t:'note', parts:[{kind, text, marks}]}               a commentary block after the preceding text
 * With `brackets`, the 點校本 marks written as （衍文） and 〔補字〕 become 刪 and 增 edits.
 */
export function parseSanjiazhu(src, { defaultKind = 'suoyin', splitParts = null, brackets = false } = {}) {
	const paragraphs = [];
	const headings = [];
	let title = '';
	// a note can run over several lines: join them until its braces close
	const lines = [];
	let open = '';
	for (const raw of src.split(/\n/)) {
		open = open ? open + raw : raw;
		const depth = (open.match(/\{\{/g) ?? []).length - (open.match(/\}\}/g) ?? []).length;
		if (depth > 0 && !/^\{\{\s*(header|Header)/.test(open)) continue;
		lines.push(open);
		open = '';
	}
	if (open) lines.push(open);
	for (const raw of lines) {
		let line = raw.trim();
		if (!line) continue;
		const h = line.match(/^==\s*(.+?)\s*==$/);
		if (h) {
			title ||= h[1];
			headings.push({ para: paragraphs.length, text: text(parseTree(h[1])).replace(/[【】\s]/g, '') });
			continue;
		}
		if (/^\{\{\s*(header|Header|Textquality|footer|二十四史)/.test(line) || line.startsWith('|') || line === '}}' || line.startsWith('__')) continue;
		line = line.replace(/^:+/, '');
		const tree = parseTree(line);
		// a quotation set as its own block, after a note that ends 「…曰：」, belongs to that note
		const prevNote = paragraphs[paragraphs.length - 1]?.at(-1);
		if (tree.length === 1 && tree[0].tpl === 'quote' && prevNote?.t === 'note' && /：$/.test(prevNote.parts.at(-1)?.text ?? '')) {
			prevNote.parts.at(-1).text += text(tree[0].args[0] ?? []).replace(/[\s　]+/g, '');
			continue;
		}
		const tokens = [];
		const pushText = (s, edit) => {
			const last = tokens[tokens.length - 1];
			const tok = last && last.t === 'text' ? last : { t: 'text', s: '', edits: [] };
			if (tok !== last) tokens.push(tok);
			if (edit) tok.edits.push({ at: tok.s.length, ...edit });
			tok.s += s;
		};
		const walk = (list) => {
			for (const n of list) {
				if (typeof n === 'string') {
					const str = n.replace(/[\s　]+/g, '');
					if (!brackets) pushText(str);
					else
						for (const [i, piece] of str.split(/(（[^（）]{1,8}）|〔[^〔〕]{1,8}〕|\[[^\[\]]{1,10}\])/).entries()) {
							if (i % 2 === 0) pushText(piece);
							else if (piece[0] === '（') pushText(piece.slice(1, -1), { type: 'del', text: piece.slice(1, -1) });
							else pushText('', { type: 'add', text: piece.slice(1, -1) });
						}
				} else if (n.tpl === '*') {
					const parts = noteParts(n.args[0] ?? [], defaultKind);
					tokens.push({ t: 'note', parts: splitParts ? parts.flatMap(splitParts) : parts });
				}
				else if (n.tpl === '刪') {
					const s = text(n.args[0] ?? []);
					pushText(s, { type: 'del', text: s });
				} else if (n.tpl === '增') pushText('', { type: 'add', text: text(n.args[0] ?? []) });
				else if (n.tpl === '另' || n.tpl === 'YL') pushText(text(n.args[0] ?? []).replace(/[\s　]+/g, ''));
				else if (n.tpl === 'CBox') {
					// A bare CBox outside {{*|}} (the 索隱述贊 line) starts a note that takes the rest of the line.
					const rest = list.slice(list.indexOf(n));
					tokens.push({ t: 'note', parts: noteParts(rest) });
					return true;
				} else if (n.tpl === 'gap') continue;
				else if (UNWRAP.has(n.tpl)) {
					if (walk(n.args[n.args.length - 1] ?? [])) return true;
				}
			}
		};
		walk(tree);
		const filtered = tokens.filter((t) => (t.t === 'text' ? t.s || t.edits.length : t.parts.length));
		if (filtered.length) paragraphs.push(filtered);
	}
	return { title, headings, paragraphs };
}

/** Parse a plain punctuated page (漢書, 通鑑) into paragraphs, keeping section headings. */
export function parsePlain(src) {
	const out = [];
	let heading = null;
	let body = src;
	const only = src.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/);
	if (only) body = only[1];
	for (const raw of body.split(/\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const h = line.match(/^(=+)\s*(.+?)\s*\1$/);
		if (h) {
			heading = text(parseTree(h[2])).trim();
			continue;
		}
		if (/^\{\{\s*(header|Header|wikipedia|footer|Textquality)/i.test(line) || line.startsWith('|') || line === '}}' || line.startsWith('__')) continue;
		let s = text(parseTree(line.replace(/^:+/, ''))).replace(/[\s　]+/g, '');
		s = s.replace(/^\d+/, '');
		if (s) out.push({ heading, text: s });
	}
	return out;
}
