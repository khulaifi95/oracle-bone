// Lookups over a chapter's tags.
import type { Chapter, Ed } from './types';

/** Segments where a person or place is tagged, in reading order. */
export function occurrences(ch: Chapter, id: string, ed: Ed = 'd'): string[] {
	const out: string[] = [];
	for (const seg of ch.segs) if (seg[ed].g?.some((g) => g[3] === id)) out.push(seg.id);
	return out;
}

/** The text of a segment with the tagged name, for showing a mention in context. */
export function snippet(ch: Chapter, segId: string, ed: Ed, script: 's' | 't'): string {
	const seg = ch.segs.find((s) => s.id === segId);
	return seg ? seg[ed][script] : '';
}
