export type VehicleType = 'car' | 'motorcycle' | 'camper' | 'suv' | 'bicycle';

export type SurfacePreference = 'paved' | 'mixed' | 'offroad';

export interface RouteOptions {
  surface: SurfacePreference;
  curvyRoads: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidSteep: boolean;
  avoidFerries?: boolean;
  maxGradeLimit?: number; // percent, undefined = no limit
}

export interface SurfaceBreakdown {
  paved: number;
  gravel: number;
  dirt: number;
}

export interface ElevationSample {
  distance: number; // km from span start
  elevation: number; // m
  grade: number; // %
  coord?: [number, number]; // [lng, lat]
}

export type WeatherSource = 'forecast' | 'historical' | 'climate' | 'unavailable';

export interface StopPoint {
  id: string;
  label: string;
  coordinates: [number, number]; // [lng, lat]
  stopDurationMinutes?: number;
}

export interface WeatherPoint {
  coordinates: [number, number];
  time: string;
  temperature: number; // °C
  windSpeed: number; // km/h
  windDirection: number; // degrees
  precipitationProbability: number; // %
  precipitationAmount: number; // mm
  weatherCode: number; // WMO
  conditionLabel: string;
  windGusts?: number; // km/h
  source?: WeatherSource;
  date?: string; // YYYY-MM-DD actually queried (climate uses previous year)
  warning?: 'wind' | 'freeze' | 'storm' | 'heat';
}

export interface Span {
  id: string;
  order: number;
  from: StopPoint;
  to: StopPoint;
  mode: 'auto' | 'manual';
  vehicleType: VehicleType;
  options: RouteOptions;
  distanceKm: number;
  durationMinutes: number;
  ascentMeters: number;
  descentMeters: number;
  maxGradePercent: number;
  coordinates: [number, number][]; // line coordinates
  elevationProfile?: ElevationSample[];
  weatherPoints?: WeatherPoint[];
  departureTime?: string; // HH:MM computed from day start + previous spans
  calculatedEta?: string; // HH:MM
  routingProvider?: 'valhalla' | 'osrm' | 'straight';
  routingWarnings?: string[];
  surfaceIsEstimated?: boolean;
  hasToll?: boolean;
  hasHighway?: boolean;
  hasFerry?: boolean;
  isVisible?: boolean; // default true
  color?: string; // override day color
  lineWidth?: number; // 2 - 12 (default inherits from day or 5)
  lineStyle?: LinePattern; // 'solid' | 'dashed' | 'dotted' (default inherits from day or 'solid')
  curvatureScore?: number; // degrees of turn per km (Kurviger style)
  surfaceBreakdown?: SurfaceBreakdown;
  alternatives?: RouteAlternative[];
}

export interface RouteAlternative {
  id: string;
  name: string;
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  curvatureScore: number;
  surfaceBreakdown: SurfaceBreakdown;
  surfaceIsEstimated?: boolean;
  ascentMeters?: number;
  descentMeters?: number;
  maxGradePercent?: number;
  elevationProfile?: ElevationSample[];
  hasToll?: boolean;
  hasHighway?: boolean;
  hasFerry?: boolean;
  options?: RouteOptions; // criteria that produced this alternative
}

export type LinePattern = 'solid' | 'dashed' | 'dotted';

export interface Day {
  id: string;
  index: number;
  date: string;
  startTime: string;
  title: string;
  notes?: string;
  color: string;
  lineWidth?: number; // default 5
  lineStyle?: LinePattern; // default 'solid'
  isVisible?: boolean; // default true
  spans: Span[];
}

export interface POI {
  id: string;
  label: string;
  category: 'fuel' | 'camp' | 'hotel' | 'viewpoint' | 'restaurant' | 'attraction' | 'personal';
  coordinates: [number, number];
  isGlobal: boolean;
  notes?: string;
}

export interface AvoidArea {
  id: string;
  label: string;
  coordinates: [number, number][]; // polygon points
  isGlobal: boolean;
  radiusKm?: number; // size in kilometers
  center?: [number, number]; // [lng, lat]
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;
  defaultStartTime: string;
  defaultVehicle: VehicleType;
  days: Day[];
  pois: POI[];
  avoidAreas: AvoidArea[];
}

export type RoutingProviderId = 'valhalla' | 'osrm';

