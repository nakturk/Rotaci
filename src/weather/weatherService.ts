// Open-Meteo Weather Service (free, keyless)
// Picks the right data source for the travel date:
//   - within forecast window (≈ today-90d … today+15d) → Forecast API (hourly, incl. precipitation probability)
//   - older dates → Historical Archive API (what actually happened)
//   - further in the future → Climate estimate: same calendar day of the previous year (archive)
// Multiple points are fetched in a single batched request and cached per session.

import type { WeatherPoint, WeatherSource } from '../trip/types';

export const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Açık Güneşli', icon: '☀️' },
  1: { label: 'Çoğunlukla Açık', icon: '🌤️' },
  2: { label: 'Parçalı Bulutlu', icon: '⛅' },
  3: { label: 'Kapalı / Bulutlu', icon: '☁️' },
  45: { label: 'Sisli', icon: '🌫️' },
  48: { label: 'Kırağılı Sis', icon: '🌫️' },
  51: { label: 'Hafif Çiseleme', icon: '🌦️' },
  53: { label: 'Orta Çiseleme', icon: '🌦️' },
  55: { label: 'Yoğun Çiseleme', icon: '🌧️' },
  56: { label: 'Donan Çiseleme', icon: '🌧️' },
  57: { label: 'Yoğun Donan Çiseleme', icon: '🌧️' },
  61: { label: 'Hafif Yağmur', icon: '🌦️' },
  63: { label: 'Orta Şiddette Yağmur', icon: '🌧️' },
  65: { label: 'Şiddetli Yağmur', icon: '🌧️' },
  66: { label: 'Donan Yağmur', icon: '🌧️' },
  67: { label: 'Şiddetli Donan Yağmur', icon: '🌧️' },
  71: { label: 'Hafif Kar', icon: '🌨️' },
  73: { label: 'Orta Kar Yağışı', icon: '🌨️' },
  75: { label: 'Yoğun Kar Yağışı', icon: '❄️' },
  77: { label: 'Kar Taneleri', icon: '🌨️' },
  80: { label: 'Sağanak Yağış', icon: '🌧️' },
  81: { label: 'Kuvvetli Sağanak', icon: '⛈️' },
  82: { label: 'Şiddetli Sağanak', icon: '⛈️' },
  85: { label: 'Kar Sağanağı', icon: '🌨️' },
  86: { label: 'Yoğun Kar Sağanağı', icon: '❄️' },
  95: { label: 'Gök Gürültülü Fırtına', icon: '⛈️' },
  96: { label: 'Dolu ile Fırtına', icon: '⛈️' },
  99: { label: 'Şiddetli Dolu Fırtınası', icon: '⛈️' }
};

export function getWmoInfo(code: number) {
  return WMO_CODES[code] || { label: 'Bilinmiyor', icon: '❔' };
}

export const WEATHER_SOURCE_LABELS: Record<WeatherSource, string> = {
  forecast: 'Tahmin',
  historical: 'Gerçekleşen (arşiv)',
  climate: 'İklim tahmini (geçen yıl aynı gün)',
  unavailable: 'Veri yok'
};

const FORECAST_PAST_DAYS = 85;
const FORECAST_FUTURE_DAYS = 15;
const ARCHIVE_DELAY_DAYS = 6; // archive lags ~5 days behind

const HOURLY_FORECAST =
  'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const HOURLY_ARCHIVE = 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m';

function daysFromToday(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function shiftYear(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  // Feb 29 → Feb 28 in non-leap years
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + years}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function resolveWeatherSource(date: string): { source: WeatherSource; queryDate: string } {
  const delta = daysFromToday(date);
  if (delta >= -FORECAST_PAST_DAYS && delta <= FORECAST_FUTURE_DAYS) return { source: 'forecast', queryDate: date };
  if (delta < -ARCHIVE_DELAY_DAYS) return { source: 'historical', queryDate: date };
  // Future beyond forecast horizon → go back whole years until the date is safely in the archive
  let years = -1;
  let q = shiftYear(date, years);
  while (daysFromToday(q) > -ARCHIVE_DELAY_DAYS) {
    years -= 1;
    q = shiftYear(date, years);
  }
  return { source: 'climate', queryDate: q };
}

// Session cache: key = source|date|lat|lng → hourly block
const cache = new Map<string, any>();
const keyOf = (source: WeatherSource, date: string, c: [number, number]) =>
  `${source}|${date}|${c[1].toFixed(2)}|${c[0].toFixed(2)}`;

async function fetchHourlyBatch(coords: [number, number][], source: WeatherSource, date: string): Promise<(any | null)[]> {
  const result: (any | null)[] = coords.map((c) => cache.get(keyOf(source, date, c)) ?? null);
  const missingIdx = result.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  if (!missingIdx.length) return result;

  const lats = missingIdx.map((i) => coords[i][1].toFixed(4)).join(',');
  const lngs = missingIdx.map((i) => coords[i][0].toFixed(4)).join(',');
  const base =
    source === 'forecast'
      ? `https://api.open-meteo.com/v1/forecast?hourly=${HOURLY_FORECAST}`
      : `https://archive-api.open-meteo.com/v1/archive?hourly=${HOURLY_ARCHIVE}`;
  const url = `${base}&latitude=${lats}&longitude=${lngs}&start_date=${date}&end_date=${date}&timezone=auto&wind_speed_unit=kmh`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.reason || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];
    missingIdx.forEach((origIdx, k) => {
      const hourly = list[k]?.hourly;
      if (hourly?.time) {
        cache.set(keyOf(source, date, coords[origIdx]), hourly);
        result[origIdx] = hourly;
      }
    });
  } catch (err) {
    console.warn(`Open-Meteo (${source}) request failed:`, err);
  }
  return result;
}

function evaluateWarning(
  vehicleType: string | undefined,
  temperature: number,
  windSpeed: number,
  gusts: number,
  weatherCode: number,
  precipitation: number
): WeatherPoint['warning'] {
  const exposed = vehicleType === 'motorcycle' || vehicleType === 'camper' || vehicleType === 'bicycle';
  if (exposed && (windSpeed >= 38 || gusts >= 55)) return 'wind';
  if (!exposed && gusts >= 75) return 'wind';
  if (temperature <= 2) return 'freeze';
  if (weatherCode >= 95 || weatherCode === 82 || precipitation >= 6) return 'storm';
  if (temperature >= 38) return 'heat';
  return undefined;
}

function buildPoint(
  hourly: any | null,
  coordinates: [number, number],
  hour: number,
  minute: number,
  source: WeatherSource,
  queryDate: string,
  vehicleType?: string
): WeatherPoint {
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (!hourly) {
    return {
      coordinates,
      time,
      temperature: NaN,
      windSpeed: NaN,
      windDirection: 0,
      precipitationProbability: NaN,
      precipitationAmount: NaN,
      weatherCode: -1,
      conditionLabel: 'Hava verisi alınamadı',
      source: 'unavailable',
      date: queryDate
    };
  }
  const idx = Math.min(Math.max(hour, 0), hourly.time.length - 1);
  const num = (arr: any[] | undefined, fallback = 0) => (arr && typeof arr[idx] === 'number' ? arr[idx] : fallback);

  const temperature = Math.round(num(hourly.temperature_2m));
  const windSpeed = Math.round(num(hourly.wind_speed_10m));
  const windGusts = Math.round(num(hourly.wind_gusts_10m, windSpeed));
  const windDirection = Math.round(num(hourly.wind_direction_10m));
  const precipitationAmount = Number(num(hourly.precipitation).toFixed(1));
  const weatherCode = num(hourly.weather_code, 1);
  // Archive has no probability → derive from actual precipitation
  const precipitationProbability = hourly.precipitation_probability
    ? Math.round(num(hourly.precipitation_probability))
    : precipitationAmount > 0
    ? 100
    : 0;

  return {
    coordinates,
    time,
    temperature,
    windSpeed,
    windGusts,
    windDirection,
    precipitationProbability,
    precipitationAmount,
    weatherCode,
    conditionLabel: getWmoInfo(weatherCode).label,
    source,
    date: queryDate,
    warning: evaluateWarning(vehicleType, temperature, windSpeed, windGusts, weatherCode, precipitationAmount)
  };
}

/** Index along route coordinates at a given distance fraction (0..1) */
function pointAtFraction(coords: [number, number][], cum: number[], fraction: number): [number, number] {
  const target = cum[cum.length - 1] * fraction;
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < target) i++;
  return coords[Math.min(i + 1, coords.length - 1)];
}

/**
 * Samples weather along a span: start, every ~40 km (max 6 points), end.
 * Each point uses its own ETA computed from the departure time and the span duration.
 */
export async function calculateSpanWeatherPoints(
  coordinates: [number, number][],
  date: string,
  departureMinutes: number, // minutes since midnight
  durationMinutes: number,
  vehicleType: string
): Promise<WeatherPoint[]> {
  if (!coordinates || coordinates.length === 0) return [];

  const cum: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [a, b] = [coordinates[i - 1], coordinates[i]];
    const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
    const dy = b[1] - a[1];
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy) * 111.32);
  }
  const totalKm = cum[cum.length - 1];
  const segments = Math.min(5, Math.max(1, Math.round(totalKm / 40)));
  const fractions = Array.from({ length: segments + 1 }, (_, i) => i / segments);

  const samples = fractions.map((f) => {
    const minutes = departureMinutes + durationMinutes * f;
    const dayOffset = Math.floor(minutes / 1440);
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return {
      coord: pointAtFraction(coordinates, cum, f),
      hour: Math.floor(m / 60),
      minute: m % 60,
      dayOffset
    };
  });

  // Group by calendar day (long night drives may cross midnight)
  const results: WeatherPoint[] = new Array(samples.length);
  const byDay = new Map<number, number[]>();
  samples.forEach((s, i) => byDay.set(s.dayOffset, [...(byDay.get(s.dayOffset) || []), i]));

  for (const [offset, idxs] of byDay) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + offset);
    const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { source, queryDate } = resolveWeatherSource(dayStr);
    const hourlies = await fetchHourlyBatch(idxs.map((i) => samples[i].coord), source, queryDate);
    idxs.forEach((sampleIdx, k) => {
      const s = samples[sampleIdx];
      results[sampleIdx] = buildPoint(hourlies[k], s.coord, s.hour, s.minute, source, queryDate, vehicleType);
    });
  }
  return results;
}
