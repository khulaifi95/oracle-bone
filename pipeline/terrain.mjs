// Territory drawn along the lie of the land. Each held city spreads its holder's colour outward
// over a 0.05° grid, as far as it can go for a set cost; steep slopes and high ground cost more,
// every river cell costs a crossing, marshes are slow and the sea (with the land the sea covered
// then) cannot be crossed. Where two holders' spreads meet is their border, so borders follow
// ridges and rivers: 秦岭 and the 江 come out as they divided states, not as straight lines.
// Places held by no one that year spread too, so they keep others out but are not drawn.
import { readFile } from 'node:fs/promises';
import { contours } from 'd3-contour';

const STEP = 0.05;
/** how far a city's hold reaches: the cost of 32 cells (about 3.2°) of flat land */
const REACH = 64;
const RIVER = { major: 22, minor: 6 };
const MARSH = 3;

let dem = null;
async function elevation() {
	if (dem) return dem;
	const text = await readFile('sources/cache/etopo-0.05.csv', 'utf8').catch(() => {
		throw new Error('sources/cache/etopo-0.05.csv is missing: run npm run fetch');
	});
	const rows = text.split('\n').slice(2).filter(Boolean);
	const first = rows[0].split(',').map(Number);
	const lons = new Set();
	for (const r of rows) {
		const [lat, lon] = r.split(',');
		if (Number(lat) !== first[0]) break;
		lons.add(lon);
	}
	const nLon = lons.size;
	const nLat = rows.length / nLon;
	const h = new Float32Array(rows.length);
	rows.forEach((r, i) => (h[i] = Number(r.split(',')[2])));
	dem = { lat0: first[0], lon0: first[1], nLat, nLon, h };
	return dem;
}

/** bilinear elevation in metres */
function heightAt(lon, lat) {
	const x = (lon - dem.lon0) / STEP;
	const y = (lat - dem.lat0) / STEP;
	const i = Math.max(0, Math.min(dem.nLon - 2, Math.floor(x)));
	const j = Math.max(0, Math.min(dem.nLat - 2, Math.floor(y)));
	const fx = Math.min(1, Math.max(0, x - i));
	const fy = Math.min(1, Math.max(0, y - j));
	const at = (a, b) => dem.h[b * dem.nLon + a];
	return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
}

/** The cost grid of a base map; built once per map. */
async function grid(basemap) {
	await elevation();
	const [x0, y0, x1, y1] = basemap.bbox;
	const nx = Math.round((x1 - x0) / STEP);
	const ny = Math.round((y1 - y0) / STEP);
	const n = nx * ny;
	const lonOf = (i) => x0 + (i + 0.5) * STEP;
	const latOf = (j) => y1 - (j + 0.5) * STEP;

	// scanline fill of a ring, cell centres inside get `v`
	const fill = (arr, ring, v) => {
		for (let j = 0; j < ny; j++) {
			const lat = latOf(j);
			const xs = [];
			for (let k = 0, m = ring.length; k < m; k++) {
				const [ax, ay] = ring[k];
				const [bx, by] = ring[(k + 1) % m];
				if (ay <= lat !== by <= lat) xs.push(ax + ((lat - ay) / (by - ay)) * (bx - ax));
			}
			xs.sort((a, b) => a - b);
			for (let k = 0; k + 1 < xs.length; k += 2) {
				const from = Math.max(0, Math.ceil((xs[k] - x0) / STEP - 0.5));
				const to = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / STEP - 0.5));
				for (let i = from; i <= to; i++) arr[j * nx + i] = v;
			}
		}
	};
	const land = new Uint8Array(n);
	for (const r of basemap.land) fill(land, r, 1);
	for (const h of basemap.hanSea) fill(land, h.ring, 0);
	for (const r of basemap.lakes) fill(land, r, 0);
	const marsh = new Uint8Array(n);
	for (const m of basemap.marshes) fill(marsh, m.ring, 1);

	// rivers: every cell a course passes through, 4-connected so nothing slips past diagonally
	const river = new Float32Array(n);
	for (const r of basemap.rivers) {
		const pen = r.major ? RIVER.major : RIVER.minor;
		let prev = null;
		const mark = (i, j) => {
			if (i < 0 || j < 0 || i >= nx || j >= ny) return;
			const c = j * nx + i;
			river[c] = Math.max(river[c], pen);
		};
		for (let k = 0; k + 1 < r.line.length; k++) {
			const [ax, ay] = r.line[k];
			const [bx, by] = r.line[k + 1];
			const len = Math.hypot(bx - ax, by - ay) / STEP;
			const steps = Math.max(1, Math.ceil(len * 4));
			for (let s = 0; s <= steps; s++) {
				const lon = ax + ((bx - ax) * s) / steps;
				const lat = ay + ((by - ay) * s) / steps;
				const i = Math.floor((lon - x0) / STEP);
				const j = Math.floor((y1 - lat) / STEP);
				if (prev && prev[0] !== i && prev[1] !== j) mark(i, prev[1]);
				mark(i, j);
				prev = [i, j];
			}
		}
	}

	// the cost of standing on a cell: slope (metres per km) and height above 800 m
	const cost = new Float32Array(n);
	const dy = STEP * 111;
	for (let j = 0; j < ny; j++) {
		const lat = latOf(j);
		const dx = dy * Math.cos((lat * Math.PI) / 180);
		for (let i = 0; i < nx; i++) {
			const c = j * nx + i;
			if (!land[c]) continue;
			const lon = lonOf(i);
			const h = heightAt(lon, lat);
			const sx = (heightAt(lon + STEP, lat) - heightAt(lon - STEP, lat)) / (2 * dx);
			const sy = (heightAt(lon, lat + STEP) - heightAt(lon, lat - STEP)) / (2 * dy);
			cost[c] = 1 + Math.hypot(sx, sy) / 8 + Math.max(0, h - 800) / 500 + (marsh[c] ? MARSH : 0);
		}
	}
	return { x0, y1, nx, ny, land, river, cost };
}

class Heap {
	constructor() {
		this.k = [];
		this.v = [];
	}
	push(key, val) {
		const { k, v } = this;
		let i = k.length;
		k.push(key);
		v.push(val);
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (k[p] <= key) break;
			k[i] = k[p];
			v[i] = v[p];
			i = p;
		}
		k[i] = key;
		v[i] = val;
	}
	pop() {
		const { k, v } = this;
		const top = v[0];
		const lk = k.pop();
		const lv = v.pop();
		if (k.length) {
			let i = 0;
			for (;;) {
				let c = 2 * i + 1;
				if (c >= k.length) break;
				if (c + 1 < k.length && k[c + 1] < k[c]) c++;
				if (k[c] >= lk) break;
				k[i] = k[c];
				v[i] = v[c];
				i = c;
			}
			k[i] = lk;
			v[i] = lv;
		}
		return top;
	}
	get size() {
		return this.k.length;
	}
}

const NEIGH = [
	[1, 0, 1],
	[-1, 0, 1],
	[0, 1, 1],
	[0, -1, 1],
	[1, 1, Math.SQRT2],
	[1, -1, Math.SQRT2],
	[-1, 1, Math.SQRT2],
	[-1, -1, Math.SQRT2]
];

/** label every land cell with the seed that reaches it most cheaply (-1: nobody within reach) */
function spread(g, seeds) {
	const { nx, ny, land, river, cost } = g;
	const n = nx * ny;
	const best = new Float32Array(n).fill(Infinity);
	const label = new Int16Array(n).fill(-1);
	const heap = new Heap();
	for (const [lon, lat, l] of seeds) {
		const i = Math.floor((lon - g.x0) / STEP);
		const j = Math.floor((g.y1 - lat) / STEP);
		if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
		const c = j * nx + i;
		if (best[c] === 0) continue;
		best[c] = 0;
		label[c] = l;
		heap.push(0, c);
	}
	while (heap.size) {
		const c = heap.pop();
		const d = best[c];
		const i = c % nx;
		const j = (c - i) / nx;
		for (const [di, dj, len] of NEIGH) {
			const a = i + di;
			const b = j + dj;
			if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
			const e = b * nx + a;
			if (!land[e]) continue;
			// no cutting a corner past water or a river
			if (di && dj && (!land[j * nx + a] || !land[b * nx + i] || river[j * nx + a] || river[b * nx + i])) continue;
			const nd = d + (len * (cost[c] + cost[e])) / 2 + river[e];
			if (nd > REACH || nd >= best[e]) continue;
			best[e] = nd;
			label[e] = label[c];
			heap.push(nd, e);
		}
	}
	return label;
}

/** Douglas–Peucker on a polyline of [x, y] */
function simplify(pts, tol) {
	if (pts.length < 3) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const L = Math.hypot(bx - ax, by - ay) || 1e-9;
		let far = -1;
		let dmax = tol;
		for (let k = a + 1; k < b; k++) {
			const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L;
			if (d > dmax) (dmax = d), (far = k);
		}
		if (far >= 0) {
			keep[far] = 1;
			stack.push([a, far], [far, b]);
		}
	}
	return pts.filter((_, k) => keep[k]);
}

/** Douglas–Peucker on a closed ring, as two halves (its ends meet, so it has no chord of its own) */
function simplifyRing(r, tol) {
	const m = r.length >> 1;
	return [...simplify(r.slice(0, m + 1), tol).slice(0, -1), ...simplify([...r.slice(m), r[0]], tol)];
}

/** a moving average around a closed ring, twice: the grid's steps become curves */
function smoothRing(r) {
	let pts = r;
	for (let pass = 0; pass < 2; pass++) {
		const m = pts.length;
		pts = pts.map((_, k) => {
			let x = 0;
			let y = 0;
			for (let d = -2; d <= 2; d++) {
				const p = pts[(k + d + m) % m];
				x += p[0];
				y += p[1];
			}
			return [x / 5, y / 5];
		});
	}
	return pts;
}

/**
 * Shapes for each distinct set of holdings.
 * `years`: { year: [{ name, holds: [placeId] }] }; `places`: [{ id, lon, lat }].
 * Returns { shapes: [{ areas: { name: [ring as flat lon,lat] }, borders: [line as flat lon,lat] }], years: { year: index } }.
 */
export async function territoryShapes(basemap, places, years) {
	const g = await grid(basemap);
	const { nx, ny, land } = g;
	const toLon = (x) => +(g.x0 + x * STEP).toFixed(3);
	const toLat = (y) => +(g.y1 - y * STEP).toFixed(3);
	const flat = (pts) => pts.flatMap(([x, y]) => [toLon(x), toLat(y)]);
	const shapes = [];
	const bySig = new Map();
	const out = {};
	for (const [year, list] of Object.entries(years)) {
		const sig = JSON.stringify(list.map((p) => [p.name, p.holds]));
		if (!bySig.has(sig)) {
			bySig.set(sig, shapes.length);
			shapes.push(shape(list));
		}
		out[year] = bySig.get(sig);
	}
	return { shapes, years: out };

	function shape(list) {
		const holder = new Map();
		list.forEach((p, k) => p.holds.forEach((id) => holder.set(id, k)));
		// held places first, so a held city and an unheld one on the same spot count as held
		const seeds = places
			.map((p) => [p.lon, p.lat, holder.get(p.id) ?? -2])
			.sort((a, b) => (b[2] >= 0) - (a[2] >= 0));
		const label = spread(g, seeds);
		// colour runs a few cells out to sea, so the coast (drawn from the land outline) is filled to the edge
		const fillLabel = Int16Array.from(label);
		for (let pass = 0; pass < 3; pass++) {
			const prev = Int16Array.from(fillLabel);
			for (let c = 0; c < nx * ny; c++) {
				if (land[c] || prev[c] >= 0) continue;
				const i = c % nx;
				const j = (c - i) / nx;
				for (const [di, dj] of NEIGH.slice(0, 4)) {
					const a = i + di;
					const b = j + dj;
					if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
					if (prev[b * nx + a] >= 0) {
						fillLabel[c] = prev[b * nx + a];
						break;
					}
				}
			}
		}
		const labelAt = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? -1 : label[j * nx + i]);
		const areas = {};
		const borders = [];
		const gen = contours().size([nx, ny]).thresholds([0.5]);
		list.forEach((p, k) => {
			const mask = new Float64Array(nx * ny);
			let any = false;
			for (let c = 0; c < nx * ny; c++) if (fillLabel[c] === k) (mask[c] = 1), (any = true);
			if (!any) return;
			const rings = [];
			for (const poly of gen(mask)[0].coordinates)
				for (const raw of poly) {
					const ring = raw.slice(0, -1);
					if (ring.length < 4) continue;
					// a vertex lies on a border where a cell around it belongs to a later holder
					const onBorder = ring.map(([x, y]) => {
						const fi = Math.floor(x - 0.5);
						const fj = Math.floor(y - 0.5);
						for (const [a, b] of [[fi, fj], [fi + 1, fj], [fi, fj + 1], [fi + 1, fj + 1]]) {
							const o = labelAt(a, b);
							if (o > k) return true;
						}
						return false;
					});
					const sm = smoothRing(ring);
					rings.push(flat(simplifyRing(sm, 0.35)));
					// runs of border vertices, walked from a vertex that is not on one
					const start = onBorder.indexOf(false);
					if (start < 0) {
						borders.push(flat(simplifyRing(sm, 0.35)));
						continue;
					}
					let run = [];
					for (let s = 1; s <= ring.length; s++) {
						const v = (start + s) % ring.length;
						if (onBorder[v]) run.push(sm[v]);
						else {
							if (run.length > 1) borders.push(flat(simplify(run, 0.35)));
							run = [];
						}
					}
				}
			if (rings.length) areas[p.name] = rings;
		});
		return { areas, borders };
	}
}
