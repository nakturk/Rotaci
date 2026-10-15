import { haversineMeters } from '../routing/routingService';

/**
 * Project point P onto segment AB in geographic coordinates.
 * Uses equirectangular approximation for high performance along short road segments.
 */
export function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { point: [number, number]; t: number; distanceMeters: number } {
  const [lngP, latP] = p;
  const [lngA, latA] = a;
  const [lngB, latB] = b;

  const midLat = ((latA + latB) / 2) * (Math.PI / 180);
  const cosMidLat = Math.cos(midLat);

  // Convert to local delta meters approximation
  const dx = (lngB - lngA) * 111320 * cosMidLat;
  const dy = (latB - latA) * 110540;
  const px = (lngP - lngA) * 111320 * cosMidLat;
  const py = (latP - latA) * 110540;

  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  }

  const projLng = Number((lngA + t * (lngB - lngA)).toFixed(6));
  const projLat = Number((latA + t * (latB - latA)).toFixed(6));
  const projPoint: [number, number] = [projLng, projLat];

  const distanceMeters = haversineMeters(p, projPoint);

  return {
    point: projPoint,
    t,
    distanceMeters
  };
}

/**
 * Finds the closest point on a polyline to point P, along with segment index and distance.
 */
export function findClosestPointOnPolyline(
  p: [number, number],
  polyline: [number, number][]
): { point: [number, number]; segmentIndex: number; distanceMeters: number } {
  if (!polyline || polyline.length === 0) {
    return { point: p, segmentIndex: -1, distanceMeters: Infinity };
  }
  if (polyline.length === 1) {
    return {
      point: polyline[0],
      segmentIndex: 0,
      distanceMeters: haversineMeters(p, polyline[0])
    };
  }

  let minDistance = Infinity;
  let bestPoint: [number, number] = polyline[0];
  let bestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const proj = projectPointOnSegment(p, polyline[i], polyline[i + 1]);
    if (proj.distanceMeters < minDistance) {
      minDistance = proj.distanceMeters;
      bestPoint = proj.point;
      bestSegmentIndex = i;
    }
  }

  return {
    point: bestPoint,
    segmentIndex: bestSegmentIndex,
    distanceMeters: minDistance
  };
}
