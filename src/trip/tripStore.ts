import { create } from 'zustand';
import type { Trip, Day, Span, StopPoint, POI, AvoidArea, VehicleType, RouteOptions, LinePattern } from './types';
import sampleRoadRoutes from './sampleRoadRoutes.json';
import { calculateRealRoadRoute } from '../routing/routingService';
import { calculateSpanWeatherPoints } from '../weather/weatherService';
import { reverseGeocode } from '../routing/geocodingService';
import { createCircularPolygon, getPolygonCenter, formatRadius } from './avoidAreaUtils';

// Storage keys
const STORAGE_KEY = 'rotaci_active_trip_v1';
const LIBRARY_STORAGE_KEY = 'rotaci_trips_library_v1';
const GLOBAL_POIS_STORAGE_KEY = 'rotaci_global_pois_v1';

// Sample initial trip with real road network geometry
const initialTrip: Trip = {
  id: 'trip-1',
  name: 'Ege Kıyı & Antik Kentler Rotası',
  description: 'İzmir, Çeşme, Efes ve Dilek Yarımadası kıyı keşfi',
  startDate: '2026-05-15',
  defaultStartTime: '09:00',
  defaultVehicle: 'motorcycle',
  days: [
    {
      id: 'day-1',
      index: 1,
      date: '2026-05-15',
      startTime: '09:00',
      title: 'İzmir Kordon - Urla Bağ Yolu - Çeşme Marina',
      color: '#3b82f6', // Mavi
      spans: [
        {
          id: 'span-1-1',
          order: 1,
          from: { id: 'p-1', label: 'İzmir Alsancak', coordinates: [27.1428, 38.4332] },
          to: { id: 'p-2', label: 'Urla Bağ Yolu & Sanat Sokağı', coordinates: [26.7645, 38.3228], stopDurationMinutes: 60 },
          mode: 'auto',
          vehicleType: 'motorcycle',
          options: {
            surface: 'paved',
            curvyRoads: true,
            avoidTolls: true,
            avoidHighways: false,
            avoidSteep: false
          },
          distanceKm: sampleRoadRoutes.r1.dist,
          durationMinutes: sampleRoadRoutes.r1.dur,
          ascentMeters: 280,
          descentMeters: 260,
          maxGradePercent: 6.8,
          coordinates: sampleRoadRoutes.r1.coords as [number, number][],
          elevationProfile: [
            { distance: 0, elevation: 12, grade: 1.2 },
            { distance: 10, elevation: 65, grade: 3.5 },
            { distance: 22, elevation: 180, grade: 5.1 },
            { distance: 30, elevation: 140, grade: -2.8 },
            { distance: 38.4, elevation: 45, grade: 1.0 }
          ],
          weatherPoints: [
            {
              coordinates: [27.1428, 38.4332],
              time: '09:00',
              temperature: 21,
              windSpeed: 14,
              windDirection: 310,
              precipitationProbability: 5,
              precipitationAmount: 0.0,
              weatherCode: 1,
              conditionLabel: 'Açık'
            },
            {
              coordinates: [26.7645, 38.3228],
              time: '09:45',
              temperature: 23,
              windSpeed: 22,
              windDirection: 330,
              precipitationProbability: 10,
              precipitationAmount: 0.0,
              weatherCode: 2,
              conditionLabel: 'Parçalı Bulutlu'
            }
          ]
        },
        {
          id: 'span-1-2',
          order: 2,
          from: { id: 'p-2', label: 'Urla Bağ Yolu', coordinates: [26.7645, 38.3228] },
          to: { id: 'p-3', label: 'Çeşme Marina & Kale', coordinates: [26.3012, 38.3235] },
          mode: 'auto',
          vehicleType: 'motorcycle',
          options: {
            surface: 'paved',
            curvyRoads: true,
            avoidTolls: true,
            avoidHighways: true,
            avoidSteep: false
          },
          distanceKm: sampleRoadRoutes.r2.dist,
          durationMinutes: sampleRoadRoutes.r2.dur,
          ascentMeters: 410,
          descentMeters: 440,
          maxGradePercent: 7.4,
          coordinates: sampleRoadRoutes.r2.coords as [number, number][],
          elevationProfile: [
            { distance: 0, elevation: 45, grade: 0.5 },
            { distance: 15, elevation: 195, grade: 4.8 },
            { distance: 32, elevation: 280, grade: 6.2 },
            { distance: 48.2, elevation: 8, grade: -5.1 }
          ],
          weatherPoints: [
            {
              coordinates: [26.7645, 38.3228],
              time: '11:00',
              temperature: 24,
              windSpeed: 38,
              windDirection: 340,
              precipitationProbability: 15,
              precipitationAmount: 0.0,
              weatherCode: 2,
              conditionLabel: 'Rüzgarlı / Parçalı',
              warning: 'wind'
            },
            {
              coordinates: [26.3012, 38.3235],
              time: '11:45',
              temperature: 23,
              windSpeed: 42,
              windDirection: 345,
              precipitationProbability: 20,
              precipitationAmount: 0.0,
              weatherCode: 3,
              conditionLabel: 'Kuvvetli Rüzgar',
              warning: 'wind'
            }
          ]
        }
      ]
    },
    {
      id: 'day-2',
      index: 2,
      date: '2026-05-16',
      startTime: '09:30',
      title: 'Çeşme - Seferihisar Sığacık - Kuşadası',
      color: '#10b981', // Yeşil
      spans: [
        {
          id: 'span-2-1',
          order: 1,
          from: { id: 'p-4', label: 'Çeşme Merkez', coordinates: [26.3012, 38.3235] },
          to: { id: 'p-5', label: 'Sığacık Kaleiçi & Teos', coordinates: [26.7865, 38.1965] },
          mode: 'auto',
          vehicleType: 'motorcycle',
          options: {
            surface: 'mixed',
            curvyRoads: true,
            avoidTolls: true,
            avoidHighways: true,
            avoidSteep: false
          },
          distanceKm: sampleRoadRoutes.r3.dist,
          durationMinutes: sampleRoadRoutes.r3.dur,
          ascentMeters: 520,
          descentMeters: 510,
          maxGradePercent: 8.2,
          coordinates: sampleRoadRoutes.r3.coords as [number, number][],
          elevationProfile: [
            { distance: 0, elevation: 8, grade: 0.8 },
            { distance: 20, elevation: 120, grade: 3.2 },
            { distance: 45, elevation: 310, grade: 5.6 },
            { distance: 68, elevation: 15, grade: -4.2 }
          ],
          weatherPoints: [
            {
              coordinates: [26.7865, 38.1965],
              time: '13:00',
              temperature: 25,
              windSpeed: 20,
              windDirection: 290,
              precipitationProbability: 0,
              precipitationAmount: 0.0,
              weatherCode: 1,
              conditionLabel: 'Güneşli'
            }
          ]
        }
      ]
    }
  ],
  pois: [
    { id: 'poi-1', label: 'Urla Bağevi Mola Noktası', category: 'restaurant', coordinates: [26.7645, 38.3228], isGlobal: false },
    { id: 'poi-2', label: 'Çeşme Rüzgar Seyir Tepesi', category: 'viewpoint', coordinates: [26.3400, 38.3100], isGlobal: true },
    { id: 'poi-3', label: 'Teos Antik Kamp Alanı', category: 'camp', coordinates: [26.7750, 38.1850], isGlobal: false }
  ],
  avoidAreas: [
    {
      id: 'avoid-1',
      label: 'İzmir Alsancak Yoğun Trafik Bölgesi',
      isGlobal: true,
      center: [27.1450, 38.4275],
      radiusKm: 2,
      coordinates: [
        [27.1350, 38.4200],
        [27.1550, 38.4200],
        [27.1550, 38.4350],
        [27.1350, 38.4350],
        [27.1350, 38.4200]
      ]
    }
  ]
};

// Load saved trips library and active trip from localStorage
function loadInitialTripsLibrary(): { trips: Trip[]; activeTrip: Trip } {
  let library: Trip[] = [];
  try {
    const rawLib = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (rawLib) {
      const parsed = JSON.parse(rawLib);
      if (Array.isArray(parsed) && parsed.length > 0) {
        library = parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read trips library:', e);
  }

  let active: Trip | null = null;
  try {
    const rawActive = localStorage.getItem(STORAGE_KEY);
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      if (parsed && parsed.id && Array.isArray(parsed.days)) {
        active = parsed;
      }
    }
  } catch {}

  if (library.length === 0) {
    library = [active || initialTrip];
  } else if (active) {
    const idx = library.findIndex((t) => t.id === active!.id);
    if (idx !== -1) {
      library[idx] = active;
    } else {
      library.unshift(active);
    }
  }

  const finalActive = active || library[0] || initialTrip;

  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalActive));
  } catch {}

  return { trips: library, activeTrip: finalActive };
}

const { trips: initialSavedTrips, activeTrip: savedTrip } = loadInitialTripsLibrary();

// Load persistent global POIs (Home, personal spots, shared favorites across all trips)
function loadInitialGlobalPois(): POI[] {
  try {
    const raw = localStorage.getItem(GLOBAL_POIS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read global pois from storage:', e);
  }
  return [
    { id: 'poi-home-default', label: 'Evim (İzmir)', category: 'personal', coordinates: [27.1428, 38.4332], isGlobal: true },
    { id: 'poi-1', label: 'Urla Şarap Bağları', category: 'viewpoint', coordinates: [26.7820, 38.3150], isGlobal: true },
    { id: 'poi-4', label: 'Dilek Koyu Kamp Alanı', category: 'camp', coordinates: [27.1550, 37.6980], isGlobal: true }
  ];
}

const initialGlobalPois = loadInitialGlobalPois();

const DAY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#e11d48'];

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  lngLat: [number, number];
  poiId?: string;
  poiLabel?: string;
  avoidAreaId?: string;
  avoidAreaLabel?: string;
}

interface TripStore {
  trip: Trip;
  savedTrips: Trip[];
  activeDayId: string;
  activeSpanId: string | null;
  selectedPoiId: string | null;
  pendingStartPoint: StopPoint | null;
  mapLayer: 'openfreemap-liberty' | 'openfreemap-bright' | 'openfreemap-positron' | 'osm' | 'opentopo' | 'satellite';
  is3dTerrain: boolean;
  showWeatherOverlay: boolean;
  timelineHour: number; // 0 - 24
  isCalculatingRoute: boolean;
  contextMenu: ContextMenuState | null;
  hoverElevationCoord: [number, number] | null;
  focusRouteTarget: { type: 'span' | 'day'; id: string; timestamp: number } | null;

  // Undo/Redo
  history: Trip[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // UI Selection
  setActiveDay: (dayId: string) => void;
  setActiveSpan: (spanId: string | null) => void;
  focusOnSpan: (spanId: string) => void;
  focusOnDay: (dayId: string) => void;
  setSelectedPoi: (poiId: string | null) => void;
  setPendingStartPoint: (point: StopPoint | null) => void;
  setMapLayer: (layer: TripStore['mapLayer']) => void;
  toggle3dTerrain: () => void;
  toggleWeatherOverlay: () => void;
  setTimelineHour: (hour: number) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setHoverElevationCoord: (coord: [number, number] | null) => void;

  // Day CRUD
  addDay: (title?: string, date?: string) => void;
  updateDay: (dayId: string, updates: Partial<Day>) => void;
  deleteDay: (dayId: string) => void;
  moveDay: (dayId: string, direction: 'up' | 'down') => void;
  toggleDayVisibility: (dayId: string) => void;
  updateDayStyle: (dayId: string, style: { color?: string; lineWidth?: number; lineStyle?: LinePattern }) => void;

  // Span CRUD & Routing
  addSpanToActiveDay: (toCoords: [number, number], toLabel?: string, fromPoint?: StopPoint) => Promise<void>;
  updateSpanOptions: (spanId: string, options: Partial<RouteOptions>) => void;
  updateSpanVehicle: (spanId: string, vehicle: VehicleType) => void;
  recalculateSpanRoute: (spanId: string) => Promise<void>;
  applySpanAlternative: (spanId: string, altId: string) => Promise<void>;
  refreshSpanWeather: (spanId: string) => Promise<void>;
  deleteSpan: (spanId: string) => void;
  moveSpan: (dayId: string, spanId: string, direction: 'up' | 'down') => void;
  toggleSpanVisibility: (spanId: string) => void;
  updateSpanStyle: (spanId: string, style: { color?: string | null; lineWidth?: number | null; lineStyle?: LinePattern | null }) => void;

  // POI & Avoid CRUD
  globalPois: POI[];
  addPoi: (poi: Omit<POI, 'id'>) => void;
  updatePoi: (poiId: string, updates: Partial<POI>) => void;
  deletePoi: (poiId: string) => void;
  togglePoiGlobal: (poiId: string) => void;
  copyPoiToTrip: (poiId: string, targetTripId: string) => void;
  copyingPoiModal: { id: string; label: string } | null;
  setCopyingPoiModal: (poi: { id: string; label: string } | null) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  addAvoidArea: (area: Omit<AvoidArea, 'id'>) => void;
  updateAvoidArea: (areaId: string, updates: Partial<AvoidArea>) => void;
  deleteAvoidArea: (areaId: string) => void;
  recalculateAllSpansForAvoidAreas: (overrideAvoidAreas?: AvoidArea[]) => Promise<void>;

  // Trip Management & Multi-Trip
  switchTrip: (tripId: string) => void;
  newTrip: (name?: string) => void;
  deleteTrip: (tripId: string) => void;
  duplicateTrip: (tripId: string) => void;
  setTripName: (name: string) => void;
  resetToSampleTrip: () => void;
}

export const useTripStore = create<TripStore>((set, get) => {
  // Helper to commit new trip with history & storage
  const commitTrip = (newTrip: Trip) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTrip));
      const currentSaved = get().savedTrips || [];
      const idx = currentSaved.findIndex((t) => t.id === newTrip.id);
      let updatedSaved: Trip[];
      if (idx !== -1) {
        updatedSaved = currentSaved.map((t) => (t.id === newTrip.id ? newTrip : t));
      } else {
        updatedSaved = [newTrip, ...currentSaved];
      }
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
      set({ savedTrips: updatedSaved });
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newTrip);
      // Keep up to 25 history states
      if (newHistory.length > 25) newHistory.shift();

      return {
        trip: newTrip,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: newHistory.length > 1,
        canRedo: false
      };
    });
  };

  return {
    trip: savedTrip,
    savedTrips: initialSavedTrips,
    globalPois: initialGlobalPois,
    activeDayId: savedTrip.days[0]?.id || 'day-1',
    activeSpanId: savedTrip.days[0]?.spans[0]?.id || null,
    selectedPoiId: null,
    pendingStartPoint: null,
    mapLayer: 'openfreemap-liberty',
    is3dTerrain: false,
    showWeatherOverlay: true,
    timelineHour: 10,
    isCalculatingRoute: false,
    contextMenu: null,
    hoverElevationCoord: null,
    focusRouteTarget: null,

    // Undo/Redo initial state
    history: [savedTrip],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,

    undo: () => {
      const state = get();
      if (state.historyIndex > 0) {
        const targetIndex = state.historyIndex - 1;
        const targetTrip = state.history[targetIndex];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(targetTrip));
        } catch {}

        set({
          trip: targetTrip,
          historyIndex: targetIndex,
          canUndo: targetIndex > 0,
          canRedo: true,
          activeDayId: targetTrip.days.find((d) => d.id === state.activeDayId)
            ? state.activeDayId
            : targetTrip.days[0]?.id || ''
        });
      }
    },

    redo: () => {
      const state = get();
      if (state.historyIndex < state.history.length - 1) {
        const targetIndex = state.historyIndex + 1;
        const targetTrip = state.history[targetIndex];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(targetTrip));
        } catch {}

        set({
          trip: targetTrip,
          historyIndex: targetIndex,
          canUndo: true,
          canRedo: targetIndex < state.history.length - 1,
          activeDayId: targetTrip.days.find((d) => d.id === state.activeDayId)
            ? state.activeDayId
            : targetTrip.days[0]?.id || ''
        });
      }
    },

    setActiveDay: (dayId) => {
      set({
        activeDayId: dayId,
        activeSpanId: null,
        contextMenu: null,
        pendingStartPoint: null,
        focusRouteTarget: { type: 'day', id: dayId, timestamp: Date.now() }
      });
    },

    setActiveSpan: (spanId) => {
      if (!spanId) {
        set({ activeSpanId: null });
        return;
      }
      const state = get();
      const parentDay = state.trip.days.find((d) => d.spans.some((s) => s.id === spanId));
      set({
        activeDayId: parentDay ? parentDay.id : state.activeDayId,
        activeSpanId: spanId,
        focusRouteTarget: { type: 'span', id: spanId, timestamp: Date.now() }
      });
    },

    focusOnSpan: (spanId) => {
      get().setActiveSpan(spanId);
    },

    focusOnDay: (dayId) => {
      get().setActiveDay(dayId);
    },

    setSelectedPoi: (poiId) => set({ selectedPoiId: poiId }),
    setPendingStartPoint: (point) => set({ pendingStartPoint: point }),
    setMapLayer: (mapLayer) => set({ mapLayer }),
    toggle3dTerrain: () => set((state) => ({ is3dTerrain: !state.is3dTerrain })),
    toggleWeatherOverlay: () => set((state) => ({ showWeatherOverlay: !state.showWeatherOverlay })),
    setTimelineHour: (timelineHour) => set({ timelineHour }),
    setContextMenu: (contextMenu) => set({ contextMenu }),
    setHoverElevationCoord: (hoverElevationCoord) => set({ hoverElevationCoord }),

    // Day CRUD
    addDay: (customTitle, customDate) => {
      const state = get();
      const newIndex = state.trip.days.length + 1;
      const prevDate = state.trip.days[state.trip.days.length - 1]?.date || '2026-05-16';
      
      // Calculate next consecutive date
      let nextDate = customDate;
      if (!nextDate) {
        try {
          const d = new Date(prevDate);
          d.setDate(d.getDate() + 1);
          nextDate = d.toISOString().split('T')[0];
        } catch {
          nextDate = '2026-05-17';
        }
      }

      const newDay: Day = {
        id: `day-${Date.now()}`,
        index: newIndex,
        date: nextDate,
        startTime: '09:00',
        title: customTitle || `${newIndex}. Gün: Keşif Rotası`,
        color: DAY_COLORS[(newIndex - 1) % DAY_COLORS.length],
        spans: []
      };

      const updatedTrip: Trip = {
        ...state.trip,
        days: [...state.trip.days, newDay]
      };

      commitTrip(updatedTrip);
      set({ activeDayId: newDay.id, activeSpanId: null });
    },

    updateDay: (dayId, updates) => {
      const state = get();
      const updatedDays = state.trip.days.map((d) => (d.id === dayId ? { ...d, ...updates } : d));
      commitTrip({ ...state.trip, days: updatedDays });
    },

    deleteDay: (dayId) => {
      const state = get();
      if (state.trip.days.length <= 1) return; // Keep at least 1 day
      const remainingDays = state.trip.days
        .filter((d) => d.id !== dayId)
        .map((d, idx) => ({ ...d, index: idx + 1 }));

      const nextActiveDayId = remainingDays[0]?.id || '';
      commitTrip({ ...state.trip, days: remainingDays });
      set({ activeDayId: nextActiveDayId, activeSpanId: null });
    },

    moveDay: (dayId, direction) => {
      const state = get();
      const days = [...state.trip.days];
      const index = days.findIndex((d) => d.id === dayId);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === days.length - 1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = days[index];
      days[index] = days[targetIndex];
      days[targetIndex] = temp;

      const reindexed = days.map((d, i) => ({ ...d, index: i + 1 }));
      commitTrip({ ...state.trip, days: reindexed });
    },

    toggleDayVisibility: (dayId) => {
      const state = get();
      const updatedDays = state.trip.days.map((d) =>
        d.id === dayId ? { ...d, isVisible: d.isVisible === false ? true : false } : d
      );
      commitTrip({ ...state.trip, days: updatedDays });
    },

    updateDayStyle: (dayId, style) => {
      const state = get();
      const updatedDays = state.trip.days.map((d) =>
        d.id === dayId ? { ...d, ...style } : d
      );
      commitTrip({ ...state.trip, days: updatedDays });
    },

    // Span CRUD & Reactive Routing
    addSpanToActiveDay: async (toCoords, toLabel, customFromPoint) => {
      const state = get();
      let activeDay = state.trip.days.find((d) => d.id === state.activeDayId);
      if (!activeDay) {
        activeDay = state.trip.days[0];
        if (!activeDay) return;
      }

      set({ isCalculatingRoute: true });

      const activeStartPoint = customFromPoint || state.pendingStartPoint;

      // Resolve 'to' label if not provided
      const resolvedToLabel = toLabel || (await reverseGeocode(toCoords[0], toCoords[1]));

      let fromPoint: StopPoint;
      if (activeStartPoint) {
        fromPoint = activeStartPoint;
      } else if (activeDay.spans.length > 0) {
        const lastSpan = activeDay.spans[activeDay.spans.length - 1];
        fromPoint = {
          id: `p-${Date.now()}-from`,
          label: lastSpan.to.label,
          coordinates: lastSpan.to.coordinates
        };
      } else {
        // Check previous day's last stop
        const dayIdx = state.trip.days.findIndex((d) => d.id === activeDay!.id);
        if (dayIdx > 0 && state.trip.days[dayIdx - 1].spans.length > 0) {
          const prevSpans = state.trip.days[dayIdx - 1].spans;
          const prevLastStop = prevSpans[prevSpans.length - 1].to;
          fromPoint = {
            id: `p-${Date.now()}-from`,
            label: prevLastStop.label,
            coordinates: prevLastStop.coordinates
          };
        } else {
          // No start point yet in the active day or trip:
          // Designate this point as pendingStartPoint and await destination!
          set({
            pendingStartPoint: {
              id: `p-${Date.now()}-start`,
              label: resolvedToLabel,
              coordinates: toCoords
            },
            isCalculatingRoute: false
          });
          return;
        }
      }

      const toPoint: StopPoint = {
        id: `p-${Date.now()}-to`,
        label: resolvedToLabel,
        coordinates: toCoords,
        stopDurationMinutes: 30
      };

      const vehicleType: VehicleType = state.trip.defaultVehicle || 'motorcycle';
      const defaultOptions: RouteOptions = {
        surface: 'paved',
        curvyRoads: true,
        avoidTolls: false,
        avoidHighways: false,
        avoidSteep: false,
        avoidFerries: false
      };

      // Determine departure minutes
      const [startH, startM] = (activeDay.startTime || '09:00').split(':').map(Number);
      let depMinutes = (startH || 9) * 60 + (startM || 0);
      for (const sp of activeDay.spans) {
        depMinutes += sp.durationMinutes + (sp.to.stopDurationMinutes || 0);
      }
      const depHourStr = String(Math.floor((depMinutes % 1440) / 60)).padStart(2, '0');
      const depMinStr = String(depMinutes % 60).padStart(2, '0');
      const departureTime = `${depHourStr}:${depMinStr}`;

      // Calculate real road route via Valhalla with Phase 2 criteria
      const avoidPolygons = state.trip.avoidAreas?.map((a) => a.coordinates) || [];
      const routeRes = await calculateRealRoadRoute(
        fromPoint.coordinates,
        toPoint.coordinates,
        vehicleType,
        defaultOptions,
        avoidPolygons
      );

      const etaTotalMin = depMinutes + routeRes.durationMinutes;
      const etaHourStr = String(Math.floor((etaTotalMin % 1440) / 60)).padStart(2, '0');
      const etaMinStr = String(etaTotalMin % 60).padStart(2, '0');
      const calculatedEta = `${etaHourStr}:${etaMinStr}`;

      // Fetch real weather forecast from Open-Meteo
      const weatherPoints = await calculateSpanWeatherPoints(
        routeRes.coordinates,
        activeDay.date,
        depMinutes,
        routeRes.durationMinutes,
        vehicleType
      );

      const newSpan: Span = {
        id: `span-${Date.now()}`,
        order: activeDay.spans.length + 1,
        from: fromPoint,
        to: toPoint,
        mode: 'auto',
        vehicleType,
        options: defaultOptions,
        distanceKm: routeRes.distanceKm,
        durationMinutes: routeRes.durationMinutes,
        ascentMeters: routeRes.ascentMeters,
        descentMeters: routeRes.descentMeters,
        maxGradePercent: routeRes.maxGradePercent,
        curvatureScore: routeRes.curvatureScore,
        surfaceBreakdown: routeRes.surfaceBreakdown,
        surfaceIsEstimated: routeRes.surfaceIsEstimated,
        coordinates: routeRes.coordinates,
        elevationProfile: routeRes.elevationProfile,
        weatherPoints,
        departureTime,
        calculatedEta,
        hasToll: routeRes.hasToll,
        hasHighway: routeRes.hasHighway,
        hasFerry: routeRes.hasFerry,
        routingProvider: routeRes.provider,
        routingWarnings: routeRes.warnings,
        alternatives: routeRes.alternatives
      };

      const updatedDays = state.trip.days.map((d) =>
        d.id === activeDay!.id ? { ...d, spans: [...d.spans, newSpan] } : d
      );

      set({
        isCalculatingRoute: false,
        activeSpanId: newSpan.id,
        pendingStartPoint: null,
        focusRouteTarget: { type: 'span', id: newSpan.id, timestamp: Date.now() }
      });
      commitTrip({ ...state.trip, days: updatedDays });
    },

    updateSpanOptions: (spanId, newOptions) => {
      const state = get();
      const updatedDays = state.trip.days.map((day) => ({
        ...day,
        spans: day.spans.map((span) =>
          span.id === spanId ? { ...span, options: { ...span.options, ...newOptions } } : span
        )
      }));
      commitTrip({ ...state.trip, days: updatedDays });
      // Recalculate route with new options asynchronously
      get().recalculateSpanRoute(spanId);
    },

    updateSpanVehicle: (spanId, vehicleType) => {
      const state = get();
      const updatedDays = state.trip.days.map((day) => ({
        ...day,
        spans: day.spans.map((span) =>
          span.id === spanId ? { ...span, vehicleType } : span
        )
      }));
      commitTrip({ ...state.trip, days: updatedDays });
      // Recalculate route for vehicle profile asynchronously
      get().recalculateSpanRoute(spanId);
    },

    recalculateSpanRoute: async (spanId: string) => {
      const state = get();
      for (const d of state.trip.days) {
        const spanIndex = d.spans.findIndex((sp) => sp.id === spanId);
        if (spanIndex !== -1) {
          const s = d.spans[spanIndex];
          set({ isCalculatingRoute: true });

          // Calculate departure minutes for this span
          const [startH, startM] = (d.startTime || '09:00').split(':').map(Number);
          let depMinutes = (startH || 9) * 60 + (startM || 0);
          for (let i = 0; i < spanIndex; i++) {
            depMinutes += d.spans[i].durationMinutes + (d.spans[i].to.stopDurationMinutes || 0);
          }
          const depHourStr = String(Math.floor((depMinutes % 1440) / 60)).padStart(2, '0');
          const depMinStr = String(depMinutes % 60).padStart(2, '0');
          const departureTime = `${depHourStr}:${depMinStr}`;

          const avoidPolygons = state.trip.avoidAreas?.map((a) => a.coordinates) || [];
          const res = await calculateRealRoadRoute(
            s.from.coordinates,
            s.to.coordinates,
            s.vehicleType,
            s.options,
            avoidPolygons
          );

          const etaTotalMin = depMinutes + res.durationMinutes;
          const etaHourStr = String(Math.floor((etaTotalMin % 1440) / 60)).padStart(2, '0');
          const etaMinStr = String(etaTotalMin % 60).padStart(2, '0');
          const calculatedEta = `${etaHourStr}:${etaMinStr}`;

          // Fetch fresh weather points
          const weatherPoints = await calculateSpanWeatherPoints(
            res.coordinates,
            d.date,
            depMinutes,
            res.durationMinutes,
            s.vehicleType
          );

          const updatedDays = state.trip.days.map((day) => ({
            ...day,
            spans: day.spans.map((sp) =>
              sp.id === spanId
                ? {
                    ...sp,
                    coordinates: res.coordinates,
                    distanceKm: res.distanceKm,
                    durationMinutes: res.durationMinutes,
                    curvatureScore: res.curvatureScore,
                    surfaceBreakdown: res.surfaceBreakdown,
                    surfaceIsEstimated: res.surfaceIsEstimated,
                    ascentMeters: res.ascentMeters,
                    descentMeters: res.descentMeters,
                    maxGradePercent: res.maxGradePercent,
                    elevationProfile: res.elevationProfile,
                    hasToll: res.hasToll,
                    hasHighway: res.hasHighway,
                    hasFerry: res.hasFerry,
                    routingProvider: res.provider,
                    routingWarnings: res.warnings,
                    alternatives: res.alternatives,
                    departureTime,
                    calculatedEta,
                    weatherPoints
                  }
                : sp
            )
          }));

          set({ isCalculatingRoute: false });
          commitTrip({ ...state.trip, days: updatedDays });
          break;
        }
      }
    },

    applySpanAlternative: async (spanId: string, altId: string) => {
      const state = get();
      for (const d of state.trip.days) {
        const spanIndex = d.spans.findIndex((sp) => sp.id === spanId);
        if (spanIndex !== -1 && d.spans[spanIndex].alternatives) {
          const s = d.spans[spanIndex];
          const alt = s.alternatives?.find((a) => a.id === altId);
          if (alt) {
            set({ isCalculatingRoute: true });

            // Calculate departure minutes
            const [startH, startM] = (d.startTime || '09:00').split(':').map(Number);
            let depMinutes = (startH || 9) * 60 + (startM || 0);
            for (let i = 0; i < spanIndex; i++) {
              depMinutes += d.spans[i].durationMinutes + (d.spans[i].to.stopDurationMinutes || 0);
            }
            const depHourStr = String(Math.floor((depMinutes % 1440) / 60)).padStart(2, '0');
            const depMinStr = String(depMinutes % 60).padStart(2, '0');
            const departureTime = `${depHourStr}:${depMinStr}`;

            const etaTotalMin = depMinutes + alt.durationMinutes;
            const etaHourStr = String(Math.floor((etaTotalMin % 1440) / 60)).padStart(2, '0');
            const etaMinStr = String(etaTotalMin % 60).padStart(2, '0');
            const calculatedEta = `${etaHourStr}:${etaMinStr}`;

            const weatherPoints = await calculateSpanWeatherPoints(
              alt.coordinates,
              d.date,
              depMinutes,
              alt.durationMinutes,
              s.vehicleType
            );

            // Recreate remaining alternatives pool, keeping previous route as an alternative
            const remainingAlts = [
              {
                id: `alt-prev-${Date.now()}`,
                name: `Önceki Rota (${s.distanceKm} km, ${Math.floor(s.durationMinutes / 60)}s ${s.durationMinutes % 60}d)`,
                coordinates: s.coordinates,
                distanceKm: s.distanceKm,
                durationMinutes: s.durationMinutes,
                curvatureScore: s.curvatureScore ?? 0,
                surfaceBreakdown: s.surfaceBreakdown || { paved: 90, gravel: 10, dirt: 0 },
                surfaceIsEstimated: s.surfaceIsEstimated,
                ascentMeters: s.ascentMeters,
                descentMeters: s.descentMeters,
                maxGradePercent: s.maxGradePercent,
                elevationProfile: s.elevationProfile,
                hasToll: s.hasToll,
                hasHighway: s.hasHighway,
                hasFerry: s.hasFerry,
                options: s.options
              },
              ...(s.alternatives || []).filter((a) => a.id !== altId)
            ];

            const updatedDays = state.trip.days.map((day) => ({
              ...day,
              spans: day.spans.map((sp) =>
                sp.id === spanId
                  ? {
                      ...sp,
                      coordinates: alt.coordinates,
                      distanceKm: alt.distanceKm,
                      durationMinutes: alt.durationMinutes,
                      curvatureScore: alt.curvatureScore,
                      surfaceBreakdown: alt.surfaceBreakdown,
                      surfaceIsEstimated: alt.surfaceIsEstimated,
                      ascentMeters: alt.ascentMeters ?? sp.ascentMeters,
                      descentMeters: alt.descentMeters ?? sp.descentMeters,
                      maxGradePercent: alt.maxGradePercent ?? sp.maxGradePercent,
                      elevationProfile: alt.elevationProfile ?? sp.elevationProfile,
                      hasToll: alt.hasToll,
                      hasHighway: alt.hasHighway,
                      hasFerry: alt.hasFerry,
                      options: alt.options || sp.options,
                      departureTime,
                      calculatedEta,
                      alternatives: remainingAlts,
                      weatherPoints
                    }
                  : sp
              )
            }));

            set({
              isCalculatingRoute: false,
              activeSpanId: spanId,
              focusRouteTarget: { type: 'span', id: spanId, timestamp: Date.now() }
            });
            commitTrip({ ...state.trip, days: updatedDays });
            break;
          }
        }
      }
    },

    refreshSpanWeather: async (spanId: string) => {
      const state = get();
      for (const d of state.trip.days) {
        const spanIndex = d.spans.findIndex((sp) => sp.id === spanId);
        if (spanIndex !== -1) {
          const s = d.spans[spanIndex];
          set({ isCalculatingRoute: true });

          const [startH, startM] = (d.startTime || '09:00').split(':').map(Number);
          let depMinutes = (startH || 9) * 60 + (startM || 0);
          for (let i = 0; i < spanIndex; i++) {
            depMinutes += d.spans[i].durationMinutes + (d.spans[i].to.stopDurationMinutes || 0);
          }

          const weatherPoints = await calculateSpanWeatherPoints(
            s.coordinates,
            d.date,
            depMinutes,
            s.durationMinutes,
            s.vehicleType
          );

          const updatedDays = state.trip.days.map((day) => ({
            ...day,
            spans: day.spans.map((sp) =>
              sp.id === spanId ? { ...sp, weatherPoints } : sp
            )
          }));

          set({ isCalculatingRoute: false });
          commitTrip({ ...state.trip, days: updatedDays });
          break;
        }
      }
    },

    deleteSpan: (spanId) => {
      const state = get();
      const updatedDays = state.trip.days.map((day) => ({
        ...day,
        spans: day.spans
          .filter((s) => s.id !== spanId)
          .map((s, idx) => ({ ...s, order: idx + 1 }))
      }));
      commitTrip({ ...state.trip, days: updatedDays });
      if (state.activeSpanId === spanId) {
        set({ activeSpanId: null });
      }
    },

    moveSpan: (dayId, spanId, direction) => {
      const state = get();
      const day = state.trip.days.find((d) => d.id === dayId);
      if (!day) return;
      const spans = [...day.spans];
      const index = spans.findIndex((s) => s.id === spanId);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === spans.length - 1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = spans[index];
      spans[index] = spans[targetIndex];
      spans[targetIndex] = temp;

      const reordered = spans.map((s, i) => ({ ...s, order: i + 1 }));
      const updatedDays = state.trip.days.map((d) =>
        d.id === dayId ? { ...d, spans: reordered } : d
      );
      commitTrip({ ...state.trip, days: updatedDays });
    },

    toggleSpanVisibility: (spanId) => {
      const state = get();
      const updatedDays = state.trip.days.map((day) => ({
        ...day,
        spans: day.spans.map((s) =>
          s.id === spanId ? { ...s, isVisible: s.isVisible === false ? true : false } : s
        )
      }));
      commitTrip({ ...state.trip, days: updatedDays });
    },

    updateSpanStyle: (spanId, style) => {
      const state = get();
      const updatedDays = state.trip.days.map((day) => ({
        ...day,
        spans: day.spans.map((s) => {
          if (s.id !== spanId) return s;
          const updated = { ...s };
          if (style.color !== undefined) {
            if (style.color === null) delete updated.color;
            else updated.color = style.color;
          }
          if (style.lineWidth !== undefined) {
            if (style.lineWidth === null) delete updated.lineWidth;
            else updated.lineWidth = style.lineWidth;
          }
          if (style.lineStyle !== undefined) {
            if (style.lineStyle === null) delete updated.lineStyle;
            else updated.lineStyle = style.lineStyle;
          }
          return updated;
        })
      }));
      commitTrip({ ...state.trip, days: updatedDays });
    },

    // POI & Avoid Area CRUD (Global vs Trip-Specific)
    addPoi: (poiData) => {
      const state = get();
      if (poiData.isGlobal) {
        const newPoi: POI = {
          ...poiData,
          id: `poi-global-${Date.now()}`,
          isGlobal: true
        };
        const updatedGlobal = [newPoi, ...state.globalPois];
        try {
          localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
        } catch {}
        set({ globalPois: updatedGlobal, selectedPoiId: newPoi.id });
      } else {
        const newPoi: POI = {
          ...poiData,
          id: `poi-${Date.now()}`,
          isGlobal: false
        };
        commitTrip({
          ...state.trip,
          pois: [...state.trip.pois, newPoi]
        });
        set({ selectedPoiId: newPoi.id });
      }
    },

    updatePoi: (poiId, updates) => {
      const state = get();
      const inGlobal = state.globalPois.find((p) => p.id === poiId);
      if (inGlobal) {
        if (updates.isGlobal === false) {
          // Demote from global to trip-specific
          const updatedGlobal = state.globalPois.filter((p) => p.id !== poiId);
          try {
            localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
          } catch {}
          const demotedPoi: POI = { ...inGlobal, ...updates, isGlobal: false };
          commitTrip({ ...state.trip, pois: [...state.trip.pois, demotedPoi] });
          set({ globalPois: updatedGlobal });
        } else {
          const updatedGlobal = state.globalPois.map((p) => (p.id === poiId ? { ...p, ...updates } : p));
          try {
            localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
          } catch {}
          set({ globalPois: updatedGlobal });
        }
        return;
      }

      const inTrip = state.trip.pois.find((p) => p.id === poiId);
      if (inTrip) {
        if (updates.isGlobal === true) {
          // Promote to global
          const updatedTripPois = state.trip.pois.filter((p) => p.id !== poiId);
          commitTrip({ ...state.trip, pois: updatedTripPois });
          const promotedPoi: POI = { ...inTrip, ...updates, isGlobal: true };
          const updatedGlobal = [promotedPoi, ...state.globalPois];
          try {
            localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
          } catch {}
          set({ globalPois: updatedGlobal });
        } else {
          commitTrip({
            ...state.trip,
            pois: state.trip.pois.map((p) => (p.id === poiId ? { ...p, ...updates } : p))
          });
        }
      }
    },

    deletePoi: (poiId) => {
      const state = get();
      if (state.globalPois.some((p) => p.id === poiId)) {
        const updatedGlobal = state.globalPois.filter((p) => p.id !== poiId);
        try {
          localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
        } catch {}
        set({ globalPois: updatedGlobal });
      }
      if (state.trip.pois.some((p) => p.id === poiId)) {
        commitTrip({
          ...state.trip,
          pois: state.trip.pois.filter((p) => p.id !== poiId)
        });
      }
      if (state.selectedPoiId === poiId) {
        set({ selectedPoiId: null });
      }
    },

    togglePoiGlobal: (poiId) => {
      const state = get();
      const inGlobal = state.globalPois.find((p) => p.id === poiId);
      if (inGlobal) {
        // Demote to trip
        const updatedGlobal = state.globalPois.filter((p) => p.id !== poiId);
        try {
          localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
        } catch {}
        const demotedPoi: POI = { ...inGlobal, isGlobal: false };
        commitTrip({ ...state.trip, pois: [...state.trip.pois, demotedPoi] });
        set({ globalPois: updatedGlobal });
        return;
      }

      const inTrip = state.trip.pois.find((p) => p.id === poiId);
      if (inTrip) {
        // Promote to global
        const updatedTripPois = state.trip.pois.filter((p) => p.id !== poiId);
        commitTrip({ ...state.trip, pois: updatedTripPois });
        const promotedPoi: POI = { ...inTrip, isGlobal: true };
        const updatedGlobal = [promotedPoi, ...state.globalPois];
        try {
          localStorage.setItem(GLOBAL_POIS_STORAGE_KEY, JSON.stringify(updatedGlobal));
        } catch {}
        set({ globalPois: updatedGlobal });
      }
    },

    copyPoiToTrip: (poiId, targetTripId) => {
      const state = get();
      const sourcePoi =
        state.globalPois.find((p) => p.id === poiId) ||
        state.trip.pois.find((p) => p.id === poiId);
      if (!sourcePoi) return;

      const targetTrip = state.savedTrips.find((t) => t.id === targetTripId);
      if (!targetTrip) return;

      const clonedPoi: POI = {
        ...sourcePoi,
        id: `poi-copy-${Date.now()}`,
        isGlobal: false
      };

      const updatedTargetTrip: Trip = {
        ...targetTrip,
        pois: [...targetTrip.pois, clonedPoi]
      };

      if (targetTripId === state.trip.id) {
        commitTrip(updatedTargetTrip);
      } else {
        const updatedSaved = state.savedTrips.map((t) => (t.id === targetTripId ? updatedTargetTrip : t));
        try {
          localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
        } catch {}
        set({ savedTrips: updatedSaved });
      }
    },

    copyingPoiModal: null,
    setCopyingPoiModal: (poi) => set({ copyingPoiModal: poi }),
    toastMessage: null,
    showToast: (msg) => {
      set({ toastMessage: msg });
      setTimeout(() => {
        if (get().toastMessage === msg) {
          set({ toastMessage: null });
        }
      }, 3500);
    },

    recalculateAllSpansForAvoidAreas: async (overrideAvoidAreas?: AvoidArea[]) => {
      const state = get();
      const currentTrip = state.trip;
      const avoidList = overrideAvoidAreas !== undefined ? overrideAvoidAreas : (currentTrip.avoidAreas || []);
      const avoidPolygons = avoidList.map((a) => a.coordinates).filter((c) => c && c.length >= 3);

      set({ isCalculatingRoute: true });

      try {
        const updatedDays: Day[] = [];

        for (const day of currentTrip.days) {
          const [startH, startM] = (day.startTime || '09:00').split(':').map(Number);
          let depMinutes = (startH || 9) * 60 + (startM || 0);
          const updatedSpans: Span[] = [];

          for (const s of day.spans) {
            const depHourStr = String(Math.floor((depMinutes % 1440) / 60)).padStart(2, '0');
            const depMinStr = String(depMinutes % 60).padStart(2, '0');
            const departureTime = `${depHourStr}:${depMinStr}`;

            const res = await calculateRealRoadRoute(
              s.from.coordinates,
              s.to.coordinates,
              s.vehicleType,
              s.options,
              avoidPolygons
            );

            const etaTotalMin = depMinutes + res.durationMinutes;
            const etaHourStr = String(Math.floor((etaTotalMin % 1440) / 60)).padStart(2, '0');
            const etaMinStr = String(etaTotalMin % 60).padStart(2, '0');
            const calculatedEta = `${etaHourStr}:${etaMinStr}`;

            let weatherPoints = s.weatherPoints;
            try {
              weatherPoints = await calculateSpanWeatherPoints(
                res.coordinates,
                day.date,
                depMinutes,
                res.durationMinutes,
                s.vehicleType
              );
            } catch {
              // Preserve existing weather points if weather calculation encounters issue
            }

            updatedSpans.push({
              ...s,
              coordinates: res.coordinates,
              distanceKm: res.distanceKm,
              durationMinutes: res.durationMinutes,
              curvatureScore: res.curvatureScore,
              surfaceBreakdown: res.surfaceBreakdown,
              surfaceIsEstimated: res.surfaceIsEstimated,
              ascentMeters: res.ascentMeters,
              descentMeters: res.descentMeters,
              maxGradePercent: res.maxGradePercent,
              elevationProfile: res.elevationProfile,
              hasToll: res.hasToll,
              hasHighway: res.hasHighway,
              hasFerry: res.hasFerry,
              routingProvider: res.provider,
              routingWarnings: res.warnings,
              alternatives: res.alternatives,
              departureTime,
              calculatedEta,
              weatherPoints
            });

            depMinutes += res.durationMinutes + (s.to.stopDurationMinutes || 0);
          }

          updatedDays.push({
            ...day,
            spans: updatedSpans
          });
        }

        const nextTrip: Trip = {
          ...currentTrip,
          avoidAreas: avoidList,
          days: updatedDays
        };

        commitTrip(nextTrip);
      } catch (err) {
        console.error('Failed to recalculate all spans for avoid areas:', err);
      } finally {
        set({ isCalculatingRoute: false });
      }
    },

    addAvoidArea: (areaData) => {
      const state = get();
      const center = areaData.center || getPolygonCenter(areaData.coordinates);
      const radiusKm = areaData.radiusKm || 2;
      const coordinates =
        areaData.coordinates && areaData.coordinates.length > 5
          ? areaData.coordinates
          : createCircularPolygon(center, radiusKm);

      const newArea: AvoidArea = {
        ...areaData,
        id: `avoid-${Date.now()}`,
        center,
        radiusKm,
        coordinates
      };
      const newAvoidAreas = [...state.trip.avoidAreas, newArea];
      commitTrip({
        ...state.trip,
        avoidAreas: newAvoidAreas
      });
      get().showToast(`🛡️ "${newArea.label}" eklendi, tüm rotalar güncelleniyor...`);
      get().recalculateAllSpansForAvoidAreas(newAvoidAreas);
    },

    updateAvoidArea: (areaId, updates) => {
      const state = get();
      const existing = state.trip.avoidAreas.find((a) => a.id === areaId);
      if (!existing) return;

      const updatedRadius = updates.radiusKm !== undefined ? updates.radiusKm : (existing.radiusKm || 2);
      const center = updates.center || existing.center || getPolygonCenter(existing.coordinates);
      let coordinates = updates.coordinates;

      if (!coordinates && updates.radiusKm !== undefined) {
        coordinates = createCircularPolygon(center, updatedRadius);
      }

      const updatedArea: AvoidArea = {
        ...existing,
        ...updates,
        center,
        radiusKm: updatedRadius,
        coordinates: coordinates || existing.coordinates
      };

      const newAvoidAreas = state.trip.avoidAreas.map((a) => (a.id === areaId ? updatedArea : a));
      commitTrip({
        ...state.trip,
        avoidAreas: newAvoidAreas
      });
      get().showToast(`📏 Yasak bölge boyutu (${formatRadius(updatedRadius)}) güncellendi, rotalar ayarlanıyor...`);
      get().recalculateAllSpansForAvoidAreas(newAvoidAreas);
    },

    deleteAvoidArea: (areaId) => {
      const state = get();
      const targetArea = state.trip.avoidAreas.find((a) => a.id === areaId);
      const newAvoidAreas = state.trip.avoidAreas.filter((a) => a.id !== areaId);
      commitTrip({
        ...state.trip,
        avoidAreas: newAvoidAreas
      });
      const areaLabel = targetArea ? `"${targetArea.label}" ` : '';
      get().showToast(`🗑️ ${areaLabel}Yasak bölge silindi, tüm rotalar güncelleniyor...`);
      get().recalculateAllSpansForAvoidAreas(newAvoidAreas);
    },

    // Trip Management & Multi-Trip
    switchTrip: (tripId: string) => {
      const state = get();
      if (state.trip.id === tripId) return;
      const targetTrip = state.savedTrips.find((t) => t.id === tripId);
      if (!targetTrip) return;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(targetTrip));
      } catch {}

      set({
        trip: targetTrip,
        activeDayId: targetTrip.days[0]?.id || '',
        activeSpanId: targetTrip.days[0]?.spans[0]?.id || null,
        selectedPoiId: null,
        pendingStartPoint: null,
        contextMenu: null,
        history: [targetTrip],
        historyIndex: 0,
        canUndo: false,
        canRedo: false
      });
    },

    newTrip: (name) => {
      const freshTrip: Trip = {
        id: `trip-${Date.now()}`,
        name: name || 'Yeni Seyahat Rotası',
        description: 'Yeni rota planı',
        startDate: new Date().toISOString().split('T')[0],
        defaultStartTime: '09:00',
        defaultVehicle: 'motorcycle',
        days: [
          {
            id: `day-${Date.now()}-1`,
            index: 1,
            date: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            title: '1. Gün: Keşif',
            color: '#3b82f6',
            spans: []
          }
        ],
        pois: [],
        avoidAreas: []
      };

      const currentSaved = get().savedTrips || [];
      const updatedSaved = [freshTrip, ...currentSaved];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshTrip));
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
      } catch {}

      set({
        trip: freshTrip,
        savedTrips: updatedSaved,
        activeDayId: freshTrip.days[0].id,
        activeSpanId: null,
        selectedPoiId: null,
        pendingStartPoint: null,
        contextMenu: null,
        history: [freshTrip],
        historyIndex: 0,
        canUndo: false,
        canRedo: false
      });
    },

    deleteTrip: (tripId: string) => {
      const state = get();
      if (state.savedTrips.length <= 1) return; // Keep at least one trip
      const updatedSaved = state.savedTrips.filter((t) => t.id !== tripId);
      try {
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
      } catch {}

      if (state.trip.id === tripId) {
        const nextTrip = updatedSaved[0];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTrip));
        } catch {}
        set({
          trip: nextTrip,
          savedTrips: updatedSaved,
          activeDayId: nextTrip.days[0]?.id || '',
          activeSpanId: nextTrip.days[0]?.spans[0]?.id || null,
          selectedPoiId: null,
          pendingStartPoint: null,
          contextMenu: null,
          history: [nextTrip],
          historyIndex: 0,
          canUndo: false,
          canRedo: false
        });
      } else {
        set({ savedTrips: updatedSaved });
      }
    },

    duplicateTrip: (tripId: string) => {
      const state = get();
      const sourceTrip = state.savedTrips.find((t) => t.id === tripId) || state.trip;
      const clonedTrip: Trip = {
        ...JSON.parse(JSON.stringify(sourceTrip)),
        id: `trip-${Date.now()}`,
        name: `${sourceTrip.name} (Kopya)`
      };

      const updatedSaved = [clonedTrip, ...state.savedTrips];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clonedTrip));
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
      } catch {}

      set({
        trip: clonedTrip,
        savedTrips: updatedSaved,
        activeDayId: clonedTrip.days[0]?.id || '',
        activeSpanId: clonedTrip.days[0]?.spans[0]?.id || null,
        selectedPoiId: null,
        pendingStartPoint: null,
        contextMenu: null,
        history: [clonedTrip],
        historyIndex: 0,
        canUndo: false,
        canRedo: false
      });
    },

    setTripName: (name) => {
      const state = get();
      commitTrip({ ...state.trip, name });
    },

    resetToSampleTrip: () => {
      const sample: Trip = {
        ...JSON.parse(JSON.stringify(initialTrip)),
        id: `trip-sample-${Date.now()}`,
        name: 'Ege Kıyı & Antik Kentler Rotası (Örnek)'
      };

      const currentSaved = get().savedTrips || [];
      const updatedSaved = [sample, ...currentSaved];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updatedSaved));
      } catch {}

      set({
        trip: sample,
        savedTrips: updatedSaved,
        activeDayId: sample.days[0].id,
        activeSpanId: sample.days[0].spans[0]?.id || null,
        selectedPoiId: null,
        pendingStartPoint: null,
        contextMenu: null,
        history: [sample],
        historyIndex: 0,
        canUndo: false,
        canRedo: false
      });
    }
  };
});
