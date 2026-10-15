/**
 * Utility functions for Avoid Areas (calculating circular polygons, radius and centers)
 */

export function createCircularPolygon(
  center: [number, number],
  radiusKm: number,
  numPoints = 16
): [number, number][] {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos(latRad);

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    const dLat = (radiusKm * Math.sin(angle)) / kmPerLat;
    const dLng = (radiusKm * Math.cos(angle)) / kmPerLng;
    coords.push([
      Number((lng + dLng).toFixed(6)),
      Number((lat + dLat).toFixed(6))
    ]);
  }
  return coords;
}

export function getPolygonCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  let sumLng = 0;
  let sumLat = 0;
  // Exclude duplicate last closing point if present
  const points = coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
    ? coords.slice(0, -1)
    : coords;

  const count = points.length;
  for (let i = 0; i < count; i++) {
    sumLng += points[i][0];
    sumLat += points[i][1];
  }
  return [Number((sumLng / count).toFixed(6)), Number((sumLat / count).toFixed(6))];
}

export function formatRadius(radiusKm: number): string {
  if (radiusKm < 1) {
    return `${Math.round(radiusKm * 1000)} m`;
  }
  return `${radiusKm.toFixed(1)} km`;
}
