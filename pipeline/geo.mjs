// Base map: land, coastline, lakes and the main rivers of the 秦汉 world, clipped and
// simplified from Natural Earth, then corrected towards the geography of about 200 BC:
// - the lower 黄河 is redrawn along its Western Han course (before AD 11), which ran
//   north-east to the sea near today's 黄骅; the modern lower course is kept and labelled
//   济水, whose bed it roughly follows;
// - the 淮 ran straight to the sea past 淮阴; 洪泽湖 and the other lakes of the lower 淮 and
//   泗 formed after the 黄河 took the 淮's bed in 1128, and are left out;
// - the coast of 苏北, the 长江 mouth (with no 崇明) and the 黄河 delta in 渤海 lay well
//   inland of today's; the land built out since is shown as sea, with today's coast dashed;
// - marshes of the time (大野泽, 云梦泽, 彭蠡泽 ...) are drawn as approximate outlines.
// All the corrected lines are approximate and follow the usual reconstructions (谭其骧《中国
// 历史地图集》第二册).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BBOX = [102, 24, 124, 42.5];
const RIVERS = {
	Huang: '河', 'Chang Jiang': '江', Yangtze: '江', Han: '汉水', Wei: '渭水', Fen: '汾水', Huai: '淮水', Jing: '泾水',
	Zhang: '漳水', Ying: '颍水', Qin: '沁水', Dan: '丹水', Xiang: '湘水', Gan: '赣水', Jialing: '西汉水', Fuchun: '浙江',
	Sanggan: '治水', Yongding: '治水', Luan: '濡水', Yi: '沂水', Ru: '汝水'
};
// 洞庭 and 太湖 (震泽) existed in Han times; 鄱阳湖 took its place south of the 江 later
const LAKES = ['Dongting', 'Tai'];
const HAN_HE = [
	[113.42, 34.95], [113.9, 35.05], [114.3, 35.3], [114.6, 35.6], [114.95, 35.88], [115.3, 36.3], [115.62, 36.75],
	[116.0, 37.1], [116.3, 37.45], [116.55, 37.85], [116.85, 38.25], [117.3, 38.45], [117.75, 38.6]
];

// the 淮 below 盱眙, before the 黄河 took its bed
const HAN_HUAI = [[118.45, 33.02], [118.75, 33.3], [119.05, 33.55], [119.4, 33.75], [119.75, 33.95], [120.0, 34.05]];
const CANALS_AND_RIVERS = [
	{ name: '鸿沟', line: [[113.45, 34.9], [113.95, 34.83], [114.35, 34.78], [114.55, 34.45], [114.8, 34.05], [114.95, 33.72]] },
	{ name: '睢水', line: [[114.4, 34.75], [115.0, 34.55], [115.65, 34.42], [116.3, 34.15], [116.9, 33.82], [117.55, 33.6], [118.25, 33.88]] },
	{ name: '泗水', line: [[117.25, 35.62], [116.95, 35.38], [116.78, 35.0], [116.9, 34.6], [117.18, 34.28], [117.6, 34.24], [117.95, 34.3], [118.3, 33.95], [118.65, 33.72], [119.02, 33.56]] },
	{ name: '汳水', line: [[114.35, 34.78], [115.2, 34.65], [116.0, 34.45], [116.6, 34.3], [117.18, 34.28]] }
];
// The coast of about 200 BC where it differs from today's: each `coast` runs along the old
// shore, `sea` closes the polygon seaward over the land built out since.
const HAN_SEA = [
	{
		name: '苏北、长江口',
		coast: [
			[119.3, 34.62], [119.6, 34.35], [119.95, 34.1], [120.12, 33.6], [120.2, 33.3], [120.33, 32.9], [120.55, 32.55], [120.45, 32.3],
			[120.1, 32.22], [119.75, 32.25], [119.45, 32.22], [119.9, 32.02], [120.3, 31.93], [120.8, 31.78], [121.13, 31.55], [121.22, 31.22], [121.3, 30.86]
		],
		sea: [[122.6, 30.86], [122.6, 34.62]]
	},
	{
		name: '渤海西南岸',
		coast: [[117.5, 39.3], [117.42, 39.0], [117.4, 38.6], [117.62, 38.25], [117.92, 38.0], [118.22, 37.72], [118.55, 37.38], [118.7, 37.15], [118.95, 37.05], [119.08, 37.08]],
		sea: [[119.6, 37.3], [119.6, 39.3]]
	}
];
// marshes of the time: centre, radii in degrees, rotation
const MARSHES = [
	{ name: '大野泽', c: [116.08, 35.38], r: [0.32, 0.17], rot: -20 },
	{ name: '云梦泽', c: [113.25, 30.25], r: [0.8, 0.3], rot: -10 },
	{ name: '彭蠡泽', c: [116.3, 29.95], r: [0.42, 0.16], rot: 30 },
	{ name: '荥泽', c: [113.45, 34.92], r: [0.08, 0.05], rot: 0 },
	{ name: '圃田泽', c: [113.95, 34.72], r: [0.14, 0.07], rot: 0 },
	{ name: '孟诸泽', c: [115.95, 34.6], r: [0.15, 0.08], rot: 0 },
	{ name: '菏泽', c: [115.55, 35.15], r: [0.1, 0.06], rot: 0 },
	{ name: '雷夏泽', c: [115.6, 35.55], r: [0.09, 0.06], rot: 0 },
	{ name: '巨鹿泽', c: [115.0, 37.25], r: [0.3, 0.15], rot: 10 }
];
const MOUNTAINS = [
	{ name: '太行山', lon: 113.7, lat: 36.7 },
	{ name: '南山', lon: 108.3, lat: 33.85 },
	{ name: '崤山', lon: 111.3, lat: 34.55 },
	{ name: '华山', lon: 110.08, lat: 34.48 },
	{ name: '骊山', lon: 109.25, lat: 34.33 },
	{ name: '商山', lon: 110.1, lat: 33.8 },
	{ name: '泰山', lon: 117.1, lat: 36.25 },
	{ name: '芒砀山', lon: 116.4, lat: 34.12 },
	{ name: '会稽山', lon: 120.6, lat: 29.85 },
	{ name: '恒山', lon: 113.9, lat: 39.65 }
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

/** Clip a polygon ring to the box (Sutherland–Hodgman). */
function clipRing(ring) {
	const edges = [
		[(p) => p[0] >= BBOX[0], (a, b) => cut(a, b, 0, BBOX[0])],
		[(p) => p[0] <= BBOX[2], (a, b) => cut(a, b, 0, BBOX[2])],
		[(p) => p[1] >= BBOX[1], (a, b) => cut(a, b, 1, BBOX[1])],
		[(p) => p[1] <= BBOX[3], (a, b) => cut(a, b, 1, BBOX[3])]
	];
	function cut(a, b, k, v) {
		const t = (v - a[k]) / (b[k] - a[k]);
		return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
	}
	let out = ring;
	for (const [keep, cross] of edges) {
		const inp = out;
		out = [];
		for (let i = 0; i < inp.length; i++) {
			const a = inp[i];
			const b = inp[(i + 1) % inp.length];
			if (keep(b)) {
				if (!keep(a)) out.push(cross(a, b));
				out.push(b);
			} else if (keep(a)) out.push(cross(a, b));
		}
		if (!out.length) break;
	}
	return out;
}
function ellipse({ c, r, rot }) {
	const a = (rot * Math.PI) / 180;
	const pts = [];
	for (let i = 0; i < 24; i++) {
		const t = (i / 24) * 2 * Math.PI;
		// wobble the outline a little so the marshes do not look drawn with a compass
		const w = 1 + 0.12 * Math.sin(3 * t + c[0]) + 0.06 * Math.cos(5 * t + c[1]);
		const x = r[0] * Math.cos(t) * w;
		const y = r[1] * Math.sin(t) * w;
		pts.push([c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)]);
	}
	return pts;
}

const round = (l) => l.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);

export async function buildBasemap(period = 'qinhan') {
	const load = async (n) => JSON.parse(await readFile(path.join(ROOT, 'sources/cache', n), 'utf8'));
	const rivers = await load('ne_10m_rivers_lake_centerlines.geojson');
	const coast = await load('ne_50m_coastline.geojson');
	const lakes = await load('ne_50m_lakes.geojson');
	const land = await load('ne_50m_land.geojson');
	const out = { bbox: BBOX, land: [], coast: [], lakes: [], rivers: [], hanSea: [], marshes: [], mountains: MOUNTAINS };
	for (const f of land.features) {
		const g = f.geometry;
		const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
		for (const poly of polys) {
			const ring = clipRing(poly[0]);
			if (ring.length < 3) continue;
			// a closed ring has no chord to simplify against: simplify its two halves
			const m = Math.floor(ring.length / 2);
			const simple = [...simplify(ring.slice(0, m + 1), 0.03), ...simplify([...ring.slice(m), ring[0]], 0.03).slice(1, -1)];
			if (simple.length > 2) out.land.push(round(simple));
		}
	}
	for (const h of HAN_SEA) out.hanSea.push({ name: h.name, coast: h.coast, ring: [...h.coast, ...h.sea] });
	for (const m of MARSHES) out.marshes.push({ name: m.name, c: m.c, ring: round(ellipse(m)) });
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
	out.rivers.push({ name: '淮水', major: true, ancient: true, line: HAN_HUAI });
	for (const r of CANALS_AND_RIVERS) out.rivers.push({ name: r.name, ancient: true, line: r.line });
	return out;
}
