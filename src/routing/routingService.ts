// Multi-criteria Routing Service (Phase 2)
// Primary engine: FOSSGIS Valhalla (free, keyless). Fallback: OSRM demo server.
// - Vehicle profiles (auto / motorcycle / truck for camper / bicycle)
// - Tolls, highways, ferries, surface preference
// - Real elevation profile (Valhalla /height) and real surface breakdown (/trace_attributes)
// - Alternative routes (Valhalla alternates + contrasting criteria query)
// - Grade-aware (avoid steep / max grade) and curvature-aware candidate selection

import i18n from '../i18n';
import type {
  VehicleType,
  RouteOptions,
  RouteAlternative,
  ElevationSample,
  SurfaceBreakdown
} from '../trip/types';

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de';
const OSRM_URL = 'https://router.project-osrm.org';

/** Valhalla public server / local graph avoid budget: total circumference of all exclude_polygons */
export const AVOID_POLYGON_BUDGET_M = 48000;

export interface RouteMetrics {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  curvatureScore: number;
  surfaceBreakdown: SurfaceBreakdown;
  surfaceIsEstimated: boolean;
  ascentMeters: number;
  descentMeters: number;
  maxGradePercent: number;
  elevationProfile: ElevationSample[];
  hasToll: boolean;
  hasHighway: boolean;
  hasFerry: boolean;
}

export interface RouteCalculationResult extends RouteMetrics {
  provider: 'valhalla' | 'osrm' | 'straight';
  alternatives: RouteAlternative[];
  warnings: string[];
}

interface Candidate {
  shape?: string; // polyline6 (Valhalla only)
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  hasToll: boolean;
  hasHighway: boolean;
  hasFerry: boolean;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function decodePolyline6(str: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];

  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / 1e6, lat / 1e6]);
  }
  return coordinates;
}

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function calculateBearing(p1: [number, number], p2: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lon1 = toRad(p1[0]), lat1 = toRad(p1[1]);
  const lon2 = toRad(p2[0]), lat2 = toRad(p2[1]);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Curvature score: total heading change (degrees) per km, ignoring tiny jitter */
export function calculateCurvatureScore(coordinates: [number, number][], distanceKm: number): number {
  if (!coordinates || coordinates.length < 3 || distanceKm <= 0) return 0;
  let total = 0;
  for (let i = 1; i < coordinates.length - 1; i++) {
    // Skip near-duplicate vertices which produce random bearings
    if (haversineMeters(coordinates[i - 1], coordinates[i]) < 5) continue;
    if (haversineMeters(coordinates[i], coordinates[i + 1]) < 5) continue;
    const b1 = calculateBearing(coordinates[i - 1], coordinates[i]);
    const b2 = calculateBearing(coordinates[i], coordinates[i + 1]);
    let diff = Math.abs(b2 - b1);
    if (diff > 180) diff = 360 - diff;
    if (diff > 4 && diff < 150) total += diff; // >150° are U-turns / roundabout artefacts
  }
  return Math.round(total / Math.max(distanceKm, 1));
}

/** Rough surface estimate — only used when Valhalla trace_attributes is unavailable */
export function estimateSurfaceBreakdown(options?: RouteOptions): SurfaceBreakdown {
  if (!options) return { paved: 85, gravel: 12, dirt: 3 };
  if (options.surface === 'offroad') return { paved: 25, gravel: 55, dirt: 20 };
  if (options.surface === 'mixed') return { paved: 68, gravel: 24, dirt: 8 };
  return { paved: 94, gravel: 5, dirt: 1 };
}

export function polygonPerimeterMeters(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length; i++) {
    total += haversineMeters(coords[i], coords[(i + 1) % coords.length]);
  }
  return total;
}

/** Resample a polyline to (at most) n points evenly spaced by distance */
function resampleLine(coords: [number, number][], n: number): { points: [number, number][]; distances: number[] } {
  if (coords.length < 2) return { points: coords.slice(), distances: coords.map(() => 0) };
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1];
  if (total === 0) return { points: [coords[0]], distances: [0] };

  const count = Math.max(2, Math.min(n, Math.ceil(total / 30)));
  const points: [number, number][] = [];
  const distances: number[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const segLen = cum[j + 1] - cum[j] || 1;
    const t = Math.min(1, Math.max(0, (target - cum[j]) / segLen));
    points.push([
      coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t,
      coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t
    ]);
    distances.push(target);
  }
  return { points, distances };
}

/** Pick the avoid polygons that fit into Valhalla's circumference budget, nearest to the span first */
export function selectAvoidPolygons(
  areas: [number, number][][],
  from: [number, number],
  to: [number, number]
): { included: [number, number][][]; skippedCount: number } {
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const ranked = areas
    .filter((p) => p && p.length >= 3)
    .map((p) => {
      const c: [number, number] = [
        p.reduce((s, q) => s + q[0], 0) / p.length,
        p.reduce((s, q) => s + q[1], 0) / p.length
      ];
      return { poly: p, center: c, perim: polygonPerimeterMeters(p), dist: haversineMeters(c, mid) };
    })
    .sort((a, b) => a.dist - b.dist);

  const included: [number, number][][] = [];
  let used = 0;
  let skippedCount = 0;

  for (const r of ranked) {
    if (used + r.perim <= AVOID_POLYGON_BUDGET_M) {
      // Valhalla expects closed rings
      const ring = r.poly.slice();
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      included.push(ring);
      used += r.perim;
    } else {
      const remaining = AVOID_POLYGON_BUDGET_M - used;
      if (remaining > 3000 && r.perim > 0) {
        // Scale polygon down slightly to fit budget rather than dropping it entirely
        const scale = Math.min(0.9, remaining / r.perim);
        const scaledRing: [number, number][] = r.poly.map(([lon, lat]) => [
          Number((r.center[0] + (lon - r.center[0]) * scale).toFixed(6)),
          Number((r.center[1] + (lat - r.center[1]) * scale).toFixed(6))
        ]);
        const first = scaledRing[0];
        const last = scaledRing[scaledRing.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) scaledRing.push(first);
        included.push(scaledRing);
        used += remaining;
      } else {
        skippedCount++;
      }
    }
  }
  return { included, skippedCount };
}

/**
 * Computes detour waypoints around avoid areas for routing engines (such as OSRM)
 * that don't support native exclude_polygons.
 */
export function calculateAvoidDetourWaypoints(
  from: [number, number],
  to: [number, number],
  avoidPolygons: [number, number][][]
): [number, number][] {
  if (!avoidPolygons || avoidPolygons.length === 0) return [];
  const waypoints: [number, number][] = [];

  for (const poly of avoidPolygons) {
    if (!poly || poly.length < 3) continue;
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;

    let maxDist = 0;
    for (const p of poly) {
      const d = haversineMeters([cx, cy], p);
      if (d > maxDist) maxDist = d;
    }
    const avoidRadiusM = Math.max(maxDist, 800);

    // Don't detour if from or to is inside or immediately at the avoid area boundary
    const distFrom = haversineMeters(from, [cx, cy]);
    const distTo = haversineMeters(to, [cx, cy]);
    if (distFrom < avoidRadiusM * 0.92 || distTo < avoidRadiusM * 0.92) continue;

    // Check if the straight line from -> to passes within the avoid radius
    const AB = [to[0] - from[0], to[1] - from[1]];
    const AC = [cx - from[0], cy - from[1]];
    const lenSq = AB[0] * AB[0] + AB[1] * AB[1];
    if (lenSq < 1e-10) continue;

    const t = Math.max(0, Math.min(1, (AC[0] * AB[0] + AC[1] * AB[1]) / lenSq));
    const P: [number, number] = [from[0] + t * AB[0], from[1] + t * AB[1]];
    const distToPath = haversineMeters(P, [cx, cy]);

    // If the path intersects or is close to the forbidden zone
    if (distToPath < avoidRadiusM * 1.35) {
      const norm = [-AB[1], AB[0]];
      const nLen = Math.hypot(norm[0], norm[1]);
      if (nLen < 1e-10) continue;

      const un = [norm[0] / nLen, norm[1] / nLen];
      const dispM = avoidRadiusM * 1.45 + 500;
      const latRad = (cy * Math.PI) / 180;
      const cosLat = Math.max(0.1, Math.cos(latRad));
      const degLat = dispM / 111320;
      const degLon = dispM / (111320 * cosLat);

      const W1: [number, number] = [
        Number((cx + un[0] * degLon).toFixed(6)),
        Number((cy + un[1] * degLat).toFixed(6))
      ];
      const W2: [number, number] = [
        Number((cx - un[0] * degLon).toFixed(6)),
        Number((cy - un[1] * degLat).toFixed(6))
      ];

      const len1 = haversineMeters(from, W1) + haversineMeters(W1, to);
      const len2 = haversineMeters(from, W2) + haversineMeters(W2, to);

      waypoints.push(len1 <= len2 ? W1 : W2);
    }
  }

  return waypoints;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 20000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const reason = body?.error || body?.reason || `HTTP ${res.status}`;
      throw new Error(reason);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const postJson = (path: string, payload: unknown, timeoutMs?: number) =>
  fetchJson(
    `${VALHALLA_URL}${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    timeoutMs
  );

// ---------------------------------------------------------------------------
// Valhalla costing
// ---------------------------------------------------------------------------

function buildCosting(vehicleType: VehicleType, options: RouteOptions): { costing: string; costingOptions: Record<string, any> } {
  const paved = options.surface === 'paved';
  const offroad = options.surface === 'offroad';
  const mixed = options.surface === 'mixed';

  // "Virajlı yol" — Valhalla has no direct curvature costing; we discourage highways/primary
  // roads here and additionally pick the most curvy candidate among alternates later.
  const highwayPref = options.avoidHighways ? 0.0 : options.curvyRoads ? 0.15 : 1.0;
  const tollPenalty = options.avoidTolls ? 15000 : 0;
  const tracks = offroad ? 1.0 : mixed ? 0.5 : 0.0;
  const ferry = options.avoidFerries ? 0.0 : 0.5;

  const motorized = {
    use_highways: highwayPref,
    use_tolls: options.avoidTolls ? 0.0 : 0.5,
    toll_booth_cost: tollPenalty,
    toll_booth_penalty: tollPenalty,
    use_ferry: ferry,
    use_tracks: tracks,
    exclude_unpaved: paved
  };

  switch (vehicleType) {
    case 'bicycle':
      return {
        costing: 'bicycle',
        costingOptions: {
          bicycle: {
            bicycle_type: offroad ? 'Mountain' : mixed ? 'Hybrid' : 'Road',
            use_hills: options.avoidSteep ? 0.05 : 0.5,
            avoid_bad_surfaces: paved ? 0.9 : mixed ? 0.3 : 0.0,
            use_ferry: ferry
          }
        }
      };
    case 'motorcycle':
      return {
        costing: 'motorcycle',
        costingOptions: {
          motorcycle: {
            ...motorized,
            use_trails: offroad ? 1.0 : mixed ? 0.4 : 0.0,
            use_primary: options.curvyRoads ? 0.3 : 0.6
          }
        }
      };
    case 'camper':
      // Camper / caravan → truck costing with realistic dimensions (height/width/length/weight)
      return {
        costing: 'truck',
        costingOptions: {
          truck: {
            ...motorized,
            height: 3.2,
            width: 2.35,
            length: 7.5,
            weight: 3.5,
            axle_load: 2.0,
            hazmat: false
          }
        }
      };
    case 'suv':
      return {
        costing: 'auto',
        costingOptions: {
          auto: { ...motorized, use_tracks: offroad ? 1.0 : mixed ? 0.7 : 0.0 }
        }
      };
    case 'car':
    default:
      return { costing: 'auto', costingOptions: { auto: motorized } };
  }
}

function tripToCandidate(trip: any): Candidate | null {
  if (!trip?.legs?.length) return null;
  const shape: string = trip.legs.length === 1 ? trip.legs[0].shape : '';
  const coordinates = trip.legs.flatMap((l: any) => decodePolyline6(l.shape));
  return {
    shape: shape || undefined,
    coordinates,
    distanceKm: Number(trip.summary.length.toFixed(1)),
    durationMinutes: Math.round(trip.summary.time / 60),
    hasToll: !!trip.summary.has_toll,
    hasHighway: !!trip.summary.has_highway,
    hasFerry: !!trip.summary.has_ferry
  };
}

async function queryValhalla(
  from: [number, number],
  to: [number, number],
  vehicleType: VehicleType,
  options: RouteOptions,
  polygons: [number, number][][],
  alternates: number
): Promise<Candidate[]> {
  const { costing, costingOptions } = buildCosting(vehicleType, options);
  const payload: any = {
    locations: [
      { lon: from[0], lat: from[1] },
      { lon: to[0], lat: to[1] }
    ],
    costing,
    costing_options: costingOptions,
    directions_type: 'none',
    units: 'kilometers'
  };
  if (alternates > 0) payload.alternates = alternates;
  if (polygons.length > 0) payload.exclude_polygons = polygons;

  let data: any;
  try {
    data = await postJson('/route', payload);
  } catch (err) {
    // Retry without polygons (keeps toll/highway criteria intact) before giving up
    if (payload.exclude_polygons) {
      console.warn('Valhalla rejected request with exclude_polygons, retrying without:', err);
      delete payload.exclude_polygons;
      data = await postJson('/route', payload);
    } else {
      throw err;
    }
  }

  const list: Candidate[] = [];
  const main = tripToCandidate(data.trip);
  if (main) list.push(main);
  for (const alt of data.alternates || []) {
    const c = tripToCandidate(alt.trip);
    if (c) list.push(c);
  }
  return list;
}

// ---------------------------------------------------------------------------
// Elevation & surface enrichment
// ---------------------------------------------------------------------------

export async function fetchElevationProfile(coords: [number, number][]): Promise<{
  profile: ElevationSample[];
  ascent: number;
  descent: number;
  maxGrade: number;
} | null> {
  if (coords.length < 2) return null;
  const { points, distances } = resampleLine(coords, 300);
  try {
    const data = await postJson('/height', {
      shape: points.map(([lon, lat]) => ({ lat, lon })),
      range: false
    });
    const raw: (number | null)[] = data.height || [];
    if (!raw.length) return null;

    // Fill gaps (sea / missing DEM tiles)
    const heights: number[] = [];
    let last = raw.find((h) => typeof h === 'number' && h > -1000) ?? 0;
    for (const h of raw) {
      if (typeof h === 'number' && h > -1000) last = h;
      heights.push(last as number);
    }

    // Light smoothing (3-point moving average) to remove DEM noise
    const smooth = heights.map((_, i) => {
      const a = heights[Math.max(0, i - 1)];
      const b = heights[i];
      const c = heights[Math.min(heights.length - 1, i + 1)];
      return (a + b + c) / 3;
    });

    let ascent = 0;
    let descent = 0;
    let maxGrade = 0;
    const profile: ElevationSample[] = [];

    for (let i = 0; i < smooth.length; i++) {
      if (i > 0) {
        const dh = smooth[i] - smooth[i - 1];
        if (dh > 0) ascent += dh;
        else descent -= dh;
      }
      // Grade over a ~200 m window to avoid spikes
      let k = i;
      while (k < smooth.length - 1 && distances[k] - distances[i] < 200) k++;
      const run = distances[k] - distances[i];
      const grade = run > 50 ? ((smooth[k] - smooth[i]) / run) * 100 : 0;
      const clamped = Math.max(-30, Math.min(30, grade));
      if (Math.abs(clamped) > maxGrade) maxGrade = Math.abs(clamped);

      profile.push({
        distance: Number((distances[i] / 1000).toFixed(2)),
        elevation: Math.round(smooth[i]),
        grade: Number(clamped.toFixed(1)),
        coord: points[i]
      });
    }

    return {
      profile,
      ascent: Math.round(ascent),
      descent: Math.round(descent),
      maxGrade: Number(maxGrade.toFixed(1))
    };
  } catch (err) {
    console.warn('Elevation fetch failed:', err);
    return null;
  }
}

async function fetchSurfaceBreakdown(shape: string | undefined, coords: [number, number][], costing: string): Promise<SurfaceBreakdown | null> {
  try {
    const base: any = {
      costing: costing === 'truck' ? 'truck' : costing,
      shape_match: 'edge_walk',
      filters: { attributes: ['edge.surface', 'edge.length'], action: 'include' }
    };
    if (shape) {
      base.encoded_polyline = shape;
      base.shape_format = 'polyline6';
    } else {
      base.shape = resampleLine(coords, 1500).points.map(([lon, lat]) => ({ lat, lon }));
      base.shape_match = 'map_snap';
    }
    const data = await postJson('/trace_attributes', base, 25000);
    const edges: { surface?: string; length?: number }[] = data.edges || [];
    if (!edges.length) return null;

    let paved = 0, gravel = 0, dirt = 0;
    for (const e of edges) {
      const len = e.length || 0;
      const s = e.surface || 'paved';
      if (s.startsWith('paved')) paved += len;
      else if (s === 'compacted' || s === 'gravel') gravel += len;
      else dirt += len; // dirt, path, impassable
    }
    const total = paved + gravel + dirt || 1;
    const p = Math.round((paved / total) * 100);
    const g = Math.round((gravel / total) * 100);
    return { paved: p, gravel: g, dirt: Math.max(0, 100 - p - g) };
  } catch (err) {
    console.warn('Surface (trace_attributes) fetch failed:', err);
    return null;
  }
}

async function enrichCandidate(c: Candidate, costing: string, options: RouteOptions, withSurface: boolean): Promise<RouteMetrics> {
  const [elev, surface] = await Promise.all([
    fetchElevationProfile(c.coordinates),
    withSurface ? fetchSurfaceBreakdown(c.shape, c.coordinates, costing) : Promise.resolve(null)
  ]);
  return {
    coordinates: c.coordinates,
    distanceKm: c.distanceKm,
    durationMinutes: c.durationMinutes,
    curvatureScore: calculateCurvatureScore(c.coordinates, c.distanceKm),
    surfaceBreakdown: surface || estimateSurfaceBreakdown(options),
    surfaceIsEstimated: !surface,
    ascentMeters: elev?.ascent ?? 0,
    descentMeters: elev?.descent ?? 0,
    maxGradePercent: elev?.maxGrade ?? 0,
    elevationProfile: elev?.profile ?? [],
    hasToll: c.hasToll,
    hasHighway: c.hasHighway,
    hasFerry: c.hasFerry
  };
}

function isDistinct(a: { distanceKm: number; durationMinutes: number }, b: { distanceKm: number; durationMinutes: number }) {
  return Math.abs(a.distanceKm - b.distanceKm) > 0.5 || Math.abs(a.durationMinutes - b.durationMinutes) > 2;
}

function describeRoute(m: RouteMetrics): string {
  const tags: string[] = [];
  tags.push(m.hasToll ? i18n.t('routing.tollRoad') : i18n.t('routing.freeRoad'));
  return tags.join(', ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function calculateRealRoadRoute(
  from: [number, number],
  to: [number, number],
  vehicleType: VehicleType,
  options: RouteOptions,
  avoidAreas: [number, number][][] = []
): Promise<RouteCalculationResult> {
  const warnings: string[] = [];
  const { costing } = buildCosting(vehicleType, options);
  const { included, skippedCount } = selectAvoidPolygons(avoidAreas, from, to);
  if (skippedCount > 0) {
    warnings.push(
      i18n.t('routing.warnings.avoidSkipped', { count: skippedCount })
    );
  }

  try {
    const wantsSelection = options.avoidSteep || !!options.maxGradeLimit || options.curvyRoads;

    // 1. Primary request (+ Valhalla alternates) and a contrasting-criteria request in parallel
    const contrastOptions: RouteOptions = options.avoidTolls
      ? { ...options, avoidTolls: false }
      : options.avoidHighways
      ? { ...options, avoidHighways: false }
      : { ...options, avoidTolls: true };

    const [primaryList, contrastList] = await Promise.all([
      queryValhalla(from, to, vehicleType, options, included, wantsSelection ? 2 : 1),
      vehicleType === 'bicycle'
        ? Promise.resolve([] as Candidate[])
        : queryValhalla(from, to, vehicleType, contrastOptions, included, 0).catch(() => [] as Candidate[])
    ]);

    if (!primaryList.length) throw new Error('Valhalla returned no route');

    // 2. Enrich primary candidates with elevation (surface later, only for the chosen ones)
    const enriched = await Promise.all(primaryList.map((c) => enrichCandidate(c, costing, options, false)));

    // 3. Choose the best candidate by grade / curvature preferences
    let chosenIdx = 0;
    if (enriched.length > 1) {
      let pool = enriched.map((m, i) => ({ m, i }));
      if (options.maxGradeLimit) {
        const ok = pool.filter((p) => p.m.maxGradePercent <= options.maxGradeLimit!);
        if (ok.length) pool = ok;
        else warnings.push(i18n.t('routing.warnings.noRouteBelowGrade', { grade: options.maxGradeLimit }));
      }
      if (options.avoidSteep || options.maxGradeLimit) {
        pool.sort((a, b) => a.m.maxGradePercent * 40 + a.m.ascentMeters - (b.m.maxGradePercent * 40 + b.m.ascentMeters));
        // Don't accept a huge detour just for slightly flatter roads
        const best = pool.find((p) => p.m.durationMinutes <= enriched[0].durationMinutes * 1.6) || pool[0];
        chosenIdx = best.i;
      } else if (options.curvyRoads) {
        const best = pool
          .filter((p) => p.m.durationMinutes <= enriched[0].durationMinutes * 1.5)
          .sort((a, b) => b.m.curvatureScore - a.m.curvatureScore)[0];
        if (best) chosenIdx = best.i;
      }
    } else if (options.maxGradeLimit && enriched[0].maxGradePercent > options.maxGradeLimit) {
      warnings.push(i18n.t('routing.warnings.maxGradeExceeded', { grade: enriched[0].maxGradePercent, limit: options.maxGradeLimit }));
    }

    const chosen = enriched[chosenIdx];
    const chosenSurface = await fetchSurfaceBreakdown(primaryList[chosenIdx].shape, chosen.coordinates, costing);
    if (chosenSurface) {
      chosen.surfaceBreakdown = chosenSurface;
      chosen.surfaceIsEstimated = false;
    }

    if (options.avoidTolls && chosen.hasToll) {
      warnings.push(i18n.t('routing.warnings.tollIncluded'));
    }

    // 4. Build alternatives list (other Valhalla alternates + contrasting criteria route)
    const alternatives: RouteAlternative[] = [];
    enriched.forEach((m, i) => {
      if (i === chosenIdx || !isDistinct(m, chosen)) return;
      alternatives.push({
        ...m,
        id: `alt-v${i}`,
        name: i18n.t('routing.alternativeTitle', { index: alternatives.length + 1, desc: describeRoute(m) }),
        options: { ...options }
      });
    });

    if (contrastList.length) {
      const contrast = await enrichCandidate(contrastList[0], costing, contrastOptions, true);
      const distinctFromAll = isDistinct(contrast, chosen) && alternatives.every((a) => isDistinct(a, contrast));
      if (distinctFromAll) {
        const name = options.avoidTolls
          ? i18n.t('routing.tollAlternative', { desc: describeRoute(contrast) })
          : options.avoidHighways
          ? i18n.t('routing.highwayAlternative', { desc: describeRoute(contrast) })
          : i18n.t('routing.freeAlternative', { desc: describeRoute(contrast) });
        alternatives.push({ ...contrast, id: 'alt-contrast', name, options: contrastOptions });
      }
    }

    return { ...chosen, provider: 'valhalla', alternatives, warnings };
  } catch (err) {
    console.warn('Valhalla routing failed, falling back to OSRM:', err);
    warnings.push(i18n.t('routing.warnings.valhallaFallback'));
  }

  // Fallback: OSRM (with avoid area detour waypoints when present)
  try {
    const profile = vehicleType === 'bicycle' ? 'bike' : 'driving';
    const detourPoints = calculateAvoidDetourWaypoints(from, to, avoidAreas);
    const allWaypoints = [from, ...detourPoints, to];
    const coordsStr = allWaypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');

    let data: any = null;
    try {
      data = await fetchJson(
        `${OSRM_URL}/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson`
      );
    } catch (osrmDetourErr) {
      if (detourPoints.length > 0) {
        console.warn('OSRM detour route failed, retrying direct:', osrmDetourErr);
        data = await fetchJson(
          `${OSRM_URL}/route/v1/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`
        );
      } else {
        throw osrmDetourErr;
      }
    }

    if (data?.code === 'Ok' && data.routes?.length) {
      const route = data.routes[0];
      const cand: Candidate = {
        coordinates: route.geometry.coordinates,
        distanceKm: Number((route.distance / 1000).toFixed(1)),
        durationMinutes: Math.round(route.duration / 60),
        hasToll: false,
        hasHighway: false,
        hasFerry: false
      };
      if (detourPoints.length > 0) {
        warnings.push(i18n.t('routing.warnings.avoidDetourApplied'));
      }
      const m = await enrichCandidate(cand, costing, options, false);
      return { ...m, provider: 'osrm', alternatives: [], warnings };
    }
  } catch (err) {
    console.warn('OSRM fallback routing error:', err);
  }

  // Last resort: straight line (clearly flagged)
  warnings.push(i18n.t('routing.warnings.straightLineFallback'));
  const dist = Number((haversineMeters(from, to) / 1000).toFixed(1));
  return {
    coordinates: [from, to],
    distanceKm: dist,
    durationMinutes: Math.round((dist / 60) * 60),
    curvatureScore: 0,
    surfaceBreakdown: estimateSurfaceBreakdown(options),
    surfaceIsEstimated: true,
    ascentMeters: 0,
    descentMeters: 0,
    maxGradePercent: 0,
    elevationProfile: [],
    hasToll: false,
    hasHighway: false,
    hasFerry: false,
    provider: 'straight',
    alternatives: [],
    warnings
  };
}
