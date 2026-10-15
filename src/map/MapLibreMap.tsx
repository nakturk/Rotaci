import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTripStore } from '../trip/tripStore';
import { MapContextMenu } from '../ui/MapContextMenu';
import { X } from 'lucide-react';
import { getPolygonCenter } from '../trip/avoidAreaUtils';
import { haversineMeters } from '../routing/routingService';

// Set same-origin worker URL for MapLibre
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

type MapLibreInstance = maplibregl.Map;
type MapLibreMarker = maplibregl.Marker;

// Map style configurations
const LAYER_STYLES: Record<string, string | maplibregl.StyleSpecification> = {
  'openfreemap-liberty': 'https://tiles.openfreemap.org/styles/liberty',
  'openfreemap-bright': 'https://tiles.openfreemap.org/styles/bright',
  'openfreemap-positron': 'https://tiles.openfreemap.org/styles/positron',
  'osm': {
    version: 8,
    sources: {
      'osm-raster': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-raster-layer',
        type: 'raster',
        source: 'osm-raster',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  },
  'opentopo': {
    version: 8,
    sources: {
      'opentopo-raster': {
        type: 'raster',
        tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: 'Kartendaten: &copy; OpenStreetMap, SRTM | Kartendarstellung: &copy; OpenTopoMap'
      }
    },
    layers: [
      {
        id: 'opentopo-raster-layer',
        type: 'raster',
        source: 'opentopo-raster',
        minzoom: 0,
        maxzoom: 17
      }
    ]
  },
  'satellite': {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri'
      }
    },
    layers: [
      {
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-satellite',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
};

export const MapLibreMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const hasFittedBoundsRef = useRef(false);
  const hoverMarkerRef = useRef<MapLibreMarker | null>(null);

  const {
    trip,
    globalPois,
    activeDayId,
    activeSpanId,
    selectedPoiId,
    pendingStartPoint,
    setPendingStartPoint,
    addSpanToActiveDay,
    deletePoi,
    togglePoiGlobal,
    setCopyingPoiModal,
    mapLayer,
    is3dTerrain,
    showWeatherOverlay,
    isCalculatingRoute,
    hoverElevationCoord,
    setActiveSpan,
    setSelectedPoi,
    setContextMenu
  } = useTripStore();

  const renderRouteDataRef = useRef<() => void>(() => {});
  const is3dTerrainRef = useRef(is3dTerrain);
  is3dTerrainRef.current = is3dTerrain;
  const pendingStartPointRef = useRef(pendingStartPoint);
  pendingStartPointRef.current = pendingStartPoint;
  const pendingMarkerRef = useRef<MapLibreMarker | null>(null);

  // Helper: check if map style is ready to add sources and layers
  const isMapStyleReady = (map: MapLibreInstance | null): boolean => {
    if (!map) return false;
    const style = (map as any).style;
    return !!(style && (style._loaded || map.isStyleLoaded()));
  };

  // Helper: Draw or update all route lines, markers, avoid areas
  const renderRouteData = () => {
    const map = mapInstanceRef.current;
    if (!map || !isMapStyleReady(map)) return;

    // 1. Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 2. Prepare Features
    const allFeatures: any[] = [];
    const allCoordinates: [number, number][] = [];

    trip.days.forEach((day) => {
      // Skip if entire day is toggled hidden
      if (day.isVisible === false) return;

      const isCurrentDay = day.id === activeDayId;

      day.spans.forEach((span) => {
        // Skip if span is toggled hidden
        if (span.isVisible === false) return;

        const isCurrentSpan = span.id === activeSpanId;

        span.coordinates.forEach((coord) => allCoordinates.push(coord));

        const effectiveColor = span.color || day.color;
        const effectiveLineWidth = span.lineWidth ?? day.lineWidth ?? 5;
        const effectiveLineStyle = span.lineStyle || day.lineStyle || 'solid';

        allFeatures.push({
          type: 'Feature',
          properties: {
            spanId: span.id,
            dayId: day.id,
            color: effectiveColor,
            lineWidth: effectiveLineWidth,
            lineStyle: effectiveLineStyle,
            isCurrentDay,
            isCurrentSpan,
            distanceKm: span.distanceKm
          },
          geometry: {
            type: 'LineString',
            coordinates: span.coordinates
          }
        });

        // Add Stop Markers (A -> B)
        [span.from, span.to].forEach((stop, idx) => {
          const el = document.createElement('div');
          el.className = 'stop-marker';
          el.style.backgroundColor = isCurrentDay ? effectiveColor : '#64748b';
          el.innerHTML = `<span>${idx === 0 ? 'A' : 'B'}</span>`;

          const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="popup-content">
              <strong>${stop.label}</strong>
              <p>${day.title}</p>
              ${stop.stopDurationMinutes ? `<small>Mola: ${stop.stopDurationMinutes} dk</small>` : ''}
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(stop.coordinates)
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });

        // Add Weather Badges if enabled
        if (showWeatherOverlay && span.weatherPoints) {
          span.weatherPoints.forEach((wp) => {
            const el = document.createElement('div');
            el.className = `weather-badge ${wp.warning ? 'warning' : ''}`;
            el.innerHTML = `
              <div class="weather-temp">${wp.temperature}°C</div>
              <div class="weather-wind">
                <span class="wind-arrow" style="transform: rotate(${wp.windDirection}deg)">↑</span>
                <span>${wp.windSpeed} km/s</span>
              </div>
              ${wp.warning ? '<div class="weather-alert">⚠️ Rüzgar</div>' : ''}
            `;

            const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`
              <div class="popup-content weather-popup">
                <div class="popup-title">🕒 ${wp.time} - Beklenen Hava</div>
                <div><strong>Durum:</strong> ${wp.conditionLabel}</div>
                <div><strong>Sıcaklık:</strong> ${wp.temperature}°C</div>
                <div><strong>Rüzgar:</strong> ${wp.windSpeed} km/s (Yön: ${wp.windDirection}°)</div>
                <div><strong>Yağış:</strong> ${wp.precipitationAmount} mm (%${wp.precipitationProbability})</div>
                ${wp.warning === 'wind' ? '<div class="alert-box">⚠️ Motosiklet/Karavan: Şiddetli yan rüzgar riski!</div>' : ''}
              </div>
            `);

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat(wp.coordinates)
              .setPopup(popup)
              .addTo(map);

            markersRef.current.push(marker);
          });
        }
      });
    });

    // 3. Update or Add Routes Source & Layers
    const geojsonData = { type: 'FeatureCollection', features: allFeatures };
    const routeSource = map.getSource('routes-all') as maplibregl.GeoJSONSource | undefined;
    const hasRouteLayer = !!map.getLayer('routes-all-solid');

    if (routeSource && hasRouteLayer) {
      routeSource.setData(geojsonData as any);
    } else {
      ['routes-all-solid', 'routes-all-dashed', 'routes-all-dotted', 'routes-all-casing'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('routes-all')) map.removeSource('routes-all');

      map.addSource('routes-all', {
        type: 'geojson',
        data: geojsonData as any
      });

      // Outline casing
      map.addLayer({
        id: 'routes-all-casing',
        type: 'line',
        source: 'routes-all',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0f172a',
          'line-width': ['+', ['*', ['case', ['get', 'isCurrentSpan'], 1.35, 1.0], ['coalesce', ['get', 'lineWidth'], 5]], 3.5],
          'line-opacity': 0.85
        }
      });

      // Solid route layer
      map.addLayer({
        id: 'routes-all-solid',
        type: 'line',
        source: 'routes-all',
        filter: ['all', ['!=', ['get', 'lineStyle'], 'dashed'], ['!=', ['get', 'lineStyle'], 'dotted']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['*', ['case', ['get', 'isCurrentSpan'], 1.35, 1.0], ['coalesce', ['get', 'lineWidth'], 5]],
          'line-opacity': ['case', ['get', 'isCurrentDay'], 1.0, 0.45]
        }
      });

      // Dashed route layer
      map.addLayer({
        id: 'routes-all-dashed',
        type: 'line',
        source: 'routes-all',
        filter: ['==', ['get', 'lineStyle'], 'dashed'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['*', ['case', ['get', 'isCurrentSpan'], 1.35, 1.0], ['coalesce', ['get', 'lineWidth'], 5]],
          'line-opacity': ['case', ['get', 'isCurrentDay'], 1.0, 0.45],
          'line-dasharray': [2, 1.5]
        }
      });

      // Dotted route layer
      map.addLayer({
        id: 'routes-all-dotted',
        type: 'line',
        source: 'routes-all',
        filter: ['==', ['get', 'lineStyle'], 'dotted'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['*', ['case', ['get', 'isCurrentSpan'], 1.35, 1.0], ['coalesce', ['get', 'lineWidth'], 5]],
          'line-opacity': ['case', ['get', 'isCurrentDay'], 1.0, 0.45],
          'line-dasharray': [0.1, 2.2]
        }
      });

      // Interactive hover & click for all route line layers
      const interactiveLayers = ['routes-all-solid', 'routes-all-dashed', 'routes-all-dotted'];
      interactiveLayers.forEach((layerId) => {
        map.on('click', layerId, (e) => {
          if (e.features && e.features[0]) {
            const spanId = e.features[0].properties.spanId;
            setActiveSpan(spanId);
          }
        });

        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    }

    // 4. Update or Add Avoid Areas (Always sync so deleted areas disappear immediately)
    const avoidFeatures = (trip.avoidAreas || []).map((area) => ({
      type: 'Feature' as const,
      properties: {
        id: area.id,
        label: area.label,
        radiusKm: area.radiusKm || 2
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [area.coordinates]
      }
    }));

    const avoidData = { type: 'FeatureCollection' as const, features: avoidFeatures };
    const avoidSource = map.getSource('avoid-areas') as maplibregl.GeoJSONSource | undefined;
    const hasAvoidLayer = !!map.getLayer('avoid-areas-layer');

    if (avoidSource && hasAvoidLayer) {
      avoidSource.setData(avoidData as any);
    } else {
      if (map.getLayer('avoid-areas-outline')) map.removeLayer('avoid-areas-outline');
      if (map.getLayer('avoid-areas-layer')) map.removeLayer('avoid-areas-layer');
      if (map.getSource('avoid-areas')) map.removeSource('avoid-areas');

      map.addSource('avoid-areas', {
        type: 'geojson',
        data: avoidData as any
      });

      map.addLayer({
        id: 'avoid-areas-layer',
        type: 'fill',
        source: 'avoid-areas',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.28,
          'fill-outline-color': '#dc2626'
        }
      });

      map.addLayer({
        id: 'avoid-areas-outline',
        type: 'line',
        source: 'avoid-areas',
        paint: {
          'line-color': '#dc2626',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });

      map.on('click', 'avoid-areas-layer', (e) => {
        const feat = e.features?.[0];
        if (!feat || !feat.properties) return;
        const areaId = feat.properties.id;
        const currentTrip = useTripStore.getState().trip;
        const area = currentTrip.avoidAreas.find((a) => a.id === areaId);
        if (!area) return;

        const popupContent = document.createElement('div');
        popupContent.className = 'poi-popup-card';
        popupContent.innerHTML = `
          <div class="poi-popup-header">
            <strong>🛡️ ${area.label}</strong>
            <span class="poi-tag" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5;">
              ${area.radiusKm ? `${area.radiusKm} km Yarıçap` : 'Yasak Bölge'}
            </span>
          </div>
          <div class="poi-popup-actions" style="margin-top:8px;">
            <button class="btn-popup delete-avoid-btn" style="background:#fff1f2;color:#be123c;border-color:#fecdd3;">
              🗑️ Yasak Bölgeyi Sil
            </button>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 10, closeButton: true })
          .setLngLat(e.lngLat)
          .setDOMContent(popupContent)
          .addTo(map);

        popupContent.querySelector('.delete-avoid-btn')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          useTripStore.getState().deleteAvoidArea(area.id);
          popup.remove();
        });
      });

      map.on('mouseenter', 'avoid-areas-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'avoid-areas-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 5. Render POIs (both Global & Trip-Specific)
    const allMapPois = [
      ...globalPois,
      ...trip.pois.filter((tp) => !globalPois.some((gp) => gp.id === tp.id))
    ];

    allMapPois.forEach((poi) => {
      const el = document.createElement('div');
      el.className = `poi-marker ${poi.isGlobal ? 'is-global' : ''}`;
      el.dataset.poiId = poi.id;
      const icons: Record<string, string> = {
        fuel: '⛽',
        camp: '⛺',
        hotel: '🏨',
        viewpoint: '🔭',
        restaurant: '🍽️',
        attraction: '⭐',
        personal: '🏠'
      };
      el.innerHTML = `<span>${icons[poi.category] || '📍'}</span>`;

      // Build rich popup card with interactive route planning buttons
      const popupCard = document.createElement('div');
      popupCard.className = 'poi-popup-card';
      popupCard.innerHTML = `
        <div class="poi-popup-header">
          <strong>${poi.label}</strong>
          <span class="poi-tag ${poi.isGlobal ? 'tag-global' : 'tag-trip'}">
            ${poi.isGlobal ? '🌐 Global POI' : '📍 Seyahat POI'}
          </span>
        </div>
        <div class="poi-popup-coords">${poi.coordinates[1].toFixed(4)}° K, ${poi.coordinates[0].toFixed(4)}° D</div>
        <div class="poi-popup-actions">
          <button class="btn-popup start-route-btn">🚩 Buradan Başla</button>
          <button class="btn-popup route-to-btn">🏁 Buraya Rota Oluştur</button>
          <button class="btn-popup toggle-global-btn">
            ${poi.isGlobal ? '📍 Seyahate Özel Yap' : '🌐 Global Yap'}
          </button>
          <button class="btn-popup copy-trip-btn">📋 Başka Seyahate Kopyala</button>
          <button class="btn-popup delete-poi-btn">🗑️ Sil</button>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: true }).setDOMContent(popupCard);

      popupCard.querySelector('.start-route-btn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setPendingStartPoint({
          id: `p-${Date.now()}-start`,
          label: poi.label,
          coordinates: poi.coordinates
        });
        popup.remove();
      });

      popupCard.querySelector('.route-to-btn')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const fromPt = pendingStartPointRef.current || undefined;
        if (pendingStartPointRef.current) {
          setPendingStartPoint(null);
        }
        popup.remove();
        await addSpanToActiveDay(poi.coordinates, poi.label, fromPt);
      });

      popupCard.querySelector('.toggle-global-btn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePoiGlobal(poi.id);
        popup.remove();
      });

      popupCard.querySelector('.copy-trip-btn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setCopyingPoiModal({ id: poi.id, label: poi.label });
        popup.remove();
      });

      popupCard.querySelector('.delete-poi-btn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deletePoi(poi.id);
        popup.remove();
      });

      // Marker click: if route destination is pending, pick this POI immediately!
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (pendingStartPointRef.current) {
          const fromPt = pendingStartPointRef.current;
          setPendingStartPoint(null);
          await addSpanToActiveDay(poi.coordinates, poi.label, fromPt);
          return;
        }
        setSelectedPoi(poi.id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(poi.coordinates)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 6. Fit Bounds on initial load
    if (!hasFittedBoundsRef.current && allCoordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]);
      allCoordinates.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 1000 });
      hasFittedBoundsRef.current = true;
    }
  };

  // Keep renderRouteDataRef updated
  renderRouteDataRef.current = renderRouteData;

  // Helper: Apply or clear 3D terrain
  const applyTerrain = (map: MapLibreInstance, enabled: boolean) => {
    if (enabled) {
      if (!map.getSource('terrarium-dem')) {
        map.addSource('terrarium-dem', {
          type: 'raster-dem',
          encoding: 'terrarium',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 15
        });
      }
      map.setTerrain({ source: 'terrarium-dem', exaggeration: 1.5 });
      map.easeTo({ pitch: 55, duration: 1000 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 800 });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: LAYER_STYLES[mapLayer],
      center: [26.78, 38.32],
      zoom: 9.5,
      pitch: is3dTerrain ? 55 : 0,
      bearing: 0,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    const handleStyleOrLoad = () => {
      renderRouteDataRef.current();
      if (is3dTerrainRef.current) {
        applyTerrain(map, true);
      }
    };

    map.on('load', handleStyleOrLoad);
    map.on('style.load', handleStyleOrLoad);

    // Right-click Context Menu
    map.on('contextmenu', (e) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.point.x,
        y: e.point.y,
        lngLat: [e.lngLat.lng, e.lngLat.lat]
      });
    });

    // Close Context Menu on click & handle pending destination selection
    map.on('click', async (e) => {
      setContextMenu(null);
      if (pendingStartPointRef.current) {
        const fromPt = pendingStartPointRef.current;
        const toCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setPendingStartPoint(null);
        await addSpanToActiveDay(toCoords, undefined, fromPt);
      }
    });

    mapInstanceRef.current = map;
    (window as any).mapInstance = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Track previous layer to avoid redundant setStyle on mount
  const prevLayerRef = useRef(mapLayer);

  // Handle Layer Style Changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (prevLayerRef.current === mapLayer) return;
    prevLayerRef.current = mapLayer;

    const style = LAYER_STYLES[mapLayer];
    map.setStyle(style);
  }, [mapLayer]);

  // Handle 3D Terrain Toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isMapStyleReady(map)) {
      applyTerrain(map, is3dTerrain);
    } else {
      map.once('style.load', () => applyTerrain(map, is3dTerrain));
    }
  }, [is3dTerrain]);

  // Handle Pending Start Pin & Pulse Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (pendingStartPoint) {
      const el = document.createElement('div');
      el.className = 'pending-start-marker';
      el.innerHTML = `
        <div class="pending-start-pin">🚩</div>
        <div class="pending-start-pulse"></div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(pendingStartPoint.coordinates)
        .addTo(map);
      pendingMarkerRef.current = marker;
    }
  }, [pendingStartPoint]);

  // Crosshair Cursor when Picking Destination
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (pendingStartPoint) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }
  }, [pendingStartPoint]);

  // Cancel Pending Start on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingStartPointRef.current) {
        setPendingStartPoint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPendingStartPoint]);

  // Fly to selected POI
  useEffect(() => {
    if (!selectedPoiId) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const allPois = [...globalPois, ...trip.pois];
    const poi = allPois.find((p) => p.id === selectedPoiId);
    if (poi) {
      map.flyTo({ center: poi.coordinates, zoom: 12.5, duration: 1200 });
    }
  }, [selectedPoiId, globalPois, trip.pois]);

  // Update Data when trip, globalPois or active day/span changes
  useEffect(() => {
    renderRouteData();
  }, [trip, globalPois, activeDayId, activeSpanId, showWeatherOverlay]);

  // Synchronized Hover Marker between Elevation Chart & Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (hoverElevationCoord) {
      if (!hoverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'elevation-hover-sync-marker';
        hoverMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(hoverElevationCoord)
          .addTo(map);
      } else {
        hoverMarkerRef.current.setLngLat(hoverElevationCoord);
      }
    } else {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
    }
  }, [hoverElevationCoord]);

  const handleWrapperContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    const target = e.target as HTMLElement;
    if (target.closest('.modal-card') || target.closest('.map-context-menu')) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lngLat = map.unproject([x, y]);

    // Check if right-clicked on an existing POI marker
    const poiEl = target.closest('.poi-marker') as HTMLElement | null;
    const poiId = poiEl?.dataset?.poiId;
    const allPois = [...globalPois, ...trip.pois];
    const poi = poiId ? allPois.find((p) => p.id === poiId) : null;

    // Check if right-clicked on an avoid area
    let avoidArea = null;
    try {
      const renderedAvoids = map.queryRenderedFeatures([x, y], { layers: ['avoid-areas-layer'] });
      if (renderedAvoids && renderedAvoids.length > 0 && renderedAvoids[0].properties?.id) {
        avoidArea = trip.avoidAreas.find((a) => a.id === renderedAvoids[0].properties.id) || null;
      }
    } catch {}

    if (!avoidArea && trip.avoidAreas?.length) {
      avoidArea = trip.avoidAreas.find((a) => {
        const center = a.center || getPolygonCenter(a.coordinates);
        const radiusM = (a.radiusKm || 2) * 1000;
        return haversineMeters([lngLat.lng, lngLat.lat], center) <= radiusM;
      }) || null;
    }

    setContextMenu({
      visible: true,
      x,
      y,
      lngLat: poi ? poi.coordinates : [lngLat.lng, lngLat.lat],
      poiId: poi?.id,
      poiLabel: poi?.label,
      avoidAreaId: avoidArea?.id,
      avoidAreaLabel: avoidArea?.label
    });
  };

  return (
    <div className="map-wrapper" onContextMenu={handleWrapperContextMenu}>
      <div ref={mapContainerRef} className="map-container" />

      {/* Floating Destination Picker Guide Banner */}
      {pendingStartPoint && (
        <div className="destination-picker-banner">
          <div className="banner-badge">🚩 BAŞLANGIÇ SEÇİLDİ</div>
          <div className="banner-text">
            <strong>{pendingStartPoint.label}</strong>
            <span className="banner-sub">Rotayı oluşturmak için haritada hedef noktaya veya bir POI'ye tıklayın.</span>
          </div>
          <button
            className="btn-banner-cancel"
            onClick={() => setPendingStartPoint(null)}
            title="İptal Et (Esc)"
          >
            <X size={14} />
            <span>İptal</span>
          </button>
        </div>
      )}

      {/* Loading Overlay when calculating road route */}
      {isCalculatingRoute && (
        <div className="routing-calculating-badge">
          <span className="spinner" />
          <span>Yol Ağı Rotası Hesaplanıyor...</span>
        </div>
      )}

      {/* Interactive Map Context Menu */}
      <MapContextMenu />
    </div>
  );
};

