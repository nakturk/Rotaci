// Free Nominatim reverse geocoding with fast fallback
export async function reverseGeocode(lng: number, lat: number): Promise<string> {
  const fallback = `Nokta (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lon=${lng}&lat=${lat}&zoom=14`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'tr,en',
          'User-Agent': 'RotaciApp/1.0'
        }
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return fallback;
    const data = await res.json();
    if (data && data.display_name) {
      // Shorten the address to first 2-3 components (e.g. "Urla, İzmir")
      const parts = data.display_name.split(',').map((s: string) => s.trim());
      return parts.slice(0, 2).join(', ') || data.name || fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
