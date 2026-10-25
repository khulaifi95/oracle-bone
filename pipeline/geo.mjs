// Base map: coastline, lakes and the main rivers of the 秦汉 world, clipped and simplified
// from Natural Earth. The lower 黄河 is redrawn along its Western Han course (before AD 11),
// which ran north-east to the sea near today's 黄骅; the modern lower course is kept and
// labelled 济水, whose bed it roughly follows.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BBOX = [102, 24, 124, 42.5];
const RIVERS = {
	Huang: '河', 'Chang Jiang': '江', Yangtze: '江', Han: '汉水', Wei: '渭水', Fen: '汾水', Huai: '淮水', Jing: '泾水',
	Zhang: '漳水', Ying: '颍水', Qin: '沁水', Dan: '丹水', Xiang: '湘水', Gan: '赣水', Jialing: '西汉水', Fuchun: '浙江',
	Sanggan: '治水', Yongding: '治水', Luan: '濡水', Yi: '沂水', Ru: '汝水', Bian: '汳水', Si: '泗水'
};
const LAKES = ['Dongting', 'Poyang', 'Tai'];
const HAN_HE = [
	[113.42, 34.95], [113.9, 35.05], [114.3, 35.3], [114.6, 35.6], [114.95, 35.88], [115.3, 36.3], [115.62, 36.75],
	[116.0, 37.1], [116.3, 37.45], [116.55, 37.85], [116.85, 38.25], [117.3, 38.45], [117.75, 38.6]
];

const inside = ([x, y]) => x >= BBOX[0] && x <= BBOX[2] && y >= BBOX[1] && y <= BBOX[3];

function simplify(points, tol) {
	if (points.length < 3) return points;
	const [a, b] = [points[0], points[points.length - 1]];
	let max = 0;
	let idx = 0;
	for (let i = 1; i < points.length - 1; i++) {
		const p = points[i];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1);
		if (d > max) {
			max = d;
			idx = i;
		}
	}
	if (max <= tol) return [a, b];
	return [...simplify(points.slice(0, idx + 1), tol).slice(0, -1), ...simplify(points.slice(idx), tol)];
}

/** Split a line into the runs that fall inside the box. */
function clip(line) {
	const out = [];
	let cur = [];
	for (const p of line) {
		if (inside(p)) cur.push(p);
		else if (cur.length) {
			out.push(cur);
			cur = [];
		}
	}
	if (cur.length) out.push(cur);
	return out.filter((l) => l.length > 1);
}

const round = (l) => l.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);

export async function buildBasemap() {
	const load = async (n) => JSON.parse(await readFile(path.join(ROOT, 'sources/cache', n), 'utf8'));
	const rivers = await load('ne_10m_rivers_lake_centerlines.geojson');
	const coast = await load('ne_50m_coastline.geojson');
	const lakes = await load('ne_50m_lakes.geojson');
	const out = { bbox: BBOX, coast: [], lakes: [], rivers: [] };
	for (const f of coast.features) for (const l of linesOf(f.geometry)) for (const c of clip(l)) out.coast.push(round(simplify(c, 0.04)));
	for (const f of lakes.features) {
		if (!LAKES.some((n) => (f.properties.name ?? '').includes(n))) continue;
		for (const l of linesOf(f.geometry)) if (l.some(inside)) out.lakes.push(round(simplify(l, 0.02)));
	}
	for (const f of rivers.features) {
		const name = RIVERS[f.properties.name];
		if (!name || !f.geometry) continue;
		for (const l of linesOf(f.geometry)) {
			for (const c of clip(l)) {
				if (name === '河') {
					// West of 荥阳 the course is unchanged; east of it, keep the modern course as 济水.
					const west = c.filter(([x]) => x <= 113.45);
					const east = c.filter(([x]) => x > 113.45);
					if (west.length > 1) out.rivers.push({ name, major: true, line: round(simplify(west, 0.02)) });
					if (east.length > 1) out.rivers.push({ name: '济水', line: round(simplify(east, 0.02)) });
					continue;
				}
				out.rivers.push({ name, major: name === '江' || name === '淮水', line: round(simplify(c, 0.02)) });
			}
		}
	}
	out.rivers.push({ name: '河', major: true, ancient: true, line: HAN_HE });
	return out;
}
