import React, { useState, useRef } from 'react';
import { useTripStore } from '../trip/tripStore';
import {
  TrendingUp,
  Clock,
  Mountain,
  Compass,
  RefreshCw,
  AlertTriangle,
  Layers,
  Thermometer,
  Wind,
  Droplets,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getWmoInfo } from '../weather/weatherService';

export const ElevationWeatherPanel: React.FC = () => {
  const {
    trip,
    activeDayId,
    activeSpanId,
    timelineHour,
    setTimelineHour,
    setHoverElevationCoord,
    refreshSpanWeather,
    isCalculatingRoute
  } = useTripStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    elevation: number;
    distance: number;
    grade: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const currentDay = trip.days.find((d) => d.id === activeDayId);
  const currentSpan = currentDay?.spans.find((s) => s.id === activeSpanId) || currentDay?.spans[0];

  if (!currentSpan) return null;

  const profile = currentSpan.elevationProfile || [];
  const maxElev = Math.max(...profile.map((p) => p.elevation), 200);
  const minElev = Math.min(...profile.map((p) => p.elevation), 0);
  const elevRange = maxElev - minElev || 100;

  const curvature = currentSpan.curvatureScore ?? 45;
  const curvatureLabel =
    curvature > 85 ? 'Bol Virajlı (Dağ/Kıyı)' : curvature > 50 ? 'Orta Virajlı' : 'Düz / Rahat';

  const surface = currentSpan.surfaceBreakdown || { paved: 88, gravel: 10, dirt: 2 };

  // Handle SVG mouse movement to sync coordinate with MapLibre
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || profile.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clientX / rect.width));

    const profileIndex = Math.min(
      profile.length - 1,
      Math.max(0, Math.round(fraction * (profile.length - 1)))
    );
    const p = profile[profileIndex];

    setHoverInfo({
      x: fraction * 800,
      elevation: p.elevation,
      distance: p.distance,
      grade: p.grade
    });

    if (currentSpan.coordinates && currentSpan.coordinates.length > 0) {
      const coordIndex = Math.min(
        currentSpan.coordinates.length - 1,
        Math.max(0, Math.round(fraction * (currentSpan.coordinates.length - 1)))
      );
      setHoverElevationCoord(currentSpan.coordinates[coordIndex]);
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
    setHoverElevationCoord(null);
  };

  return (
    <div className="elevation-weather-panel">
      {/* Top Header: Route Stats, Curvature & Surface */}
      <div className="panel-header">
        <div className="panel-stat-group">
          <div className="stat-chip">
            <Mountain size={14} className="chip-icon text-sky" />
            <span className="font-semibold">{currentSpan.from.label} &rarr; {currentSpan.to.label}</span>
          </div>

          <div className="stat-chip highlight">
            <TrendingUp size={14} className="chip-icon text-emerald" />
            <span>&uarr; {currentSpan.ascentMeters}m | &darr; {currentSpan.descentMeters}m</span>
          </div>

          <div className="stat-chip">
            <span>Maks Eğim: <strong>%{currentSpan.maxGradePercent}</strong></span>
          </div>

          {/* Curvature Score Badge */}
          <div className="stat-chip curvature-chip" title="Açı değişimi / km oranı (Kurviger algoritması)">
            <Compass size={14} className="chip-icon text-pink" />
            <span>Viraj: <strong>{curvature}</strong> ({curvatureLabel})</span>
          </div>

          {/* Surface Breakdown Badge */}
          <div className="stat-chip surface-chip" title={`Yüzey: %${surface.paved} Asfalt, %${surface.gravel} Stabilize, %${surface.dirt} Toprak`}>
            <Layers size={14} className="chip-icon text-amber" />
            <span>Yüzey: <strong>%{surface.paved} Asfalt</strong></span>
          </div>
        </div>

        {/* Timeline Slider & Weather Refresh */}
        <div className="timeline-control-group">
          <button
            onClick={() => refreshSpanWeather(currentSpan.id)}
            disabled={isCalculatingRoute}
            className="btn-tiny btn-refresh-weather"
            title="Open-Meteo'dan güncel hava durumunu yeniden çek"
          >
            <RefreshCw size={12} className={isCalculatingRoute ? 'spin' : ''} />
            <span>Hava Güncelle</span>
          </button>

          <div className="timeline-control">
            <Clock size={14} className="chip-icon text-sky" />
            <span className="timeline-label">{timelineHour}:00</span>
            <input
              type="range"
              min={6}
              max={23}
              value={timelineHour}
              onChange={(e) => setTimelineHour(Number(e.target.value))}
              className="timeline-slider"
              title="Seyahat Saati Kaydırıcısı (Saatlik Hava Durumu Simülasyonu)"
            />
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-tiny btn-collapse-toggle"
            title={isCollapsed ? 'Paneli Genişlet' : 'Paneli Küçült'}
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Weather Points Ribbon along Route */}
          {currentSpan.weatherPoints && currentSpan.weatherPoints.length > 0 && (
            <div className="weather-strip">
          <div className="weather-strip-title">
            <span>Rota Boyunca Beklenen Hava (Open-Meteo):</span>
          </div>
          <div className="weather-cards-row">
            {currentSpan.weatherPoints.map((wp, idx) => {
              const info = getWmoInfo(wp.weatherCode);
              return (
                <div key={idx} className={`weather-mini-card ${wp.warning ? 'has-warning' : ''}`}>
                  <div className="card-top">
                    <span className="w-time">🕒 {wp.time}</span>
                    <span className="w-icon">{info.icon}</span>
                  </div>
                  <div className="w-main">
                    <span className="w-temp">
                      <Thermometer size={12} className="inline text-amber" /> {wp.temperature}°C
                    </span>
                    <span className="w-condition">{wp.conditionLabel}</span>
                  </div>
                  <div className="w-details">
                    <span title="Rüzgar Hızı ve Yönü">
                      <Wind size={11} className="inline text-sky" /> {wp.windSpeed} km/s
                    </span>
                    <span title="Yağış Miktarı & Olasılığı">
                      <Droplets size={11} className="inline text-indigo" /> {wp.precipitationAmount}mm (%{wp.precipitationProbability})
                    </span>
                  </div>
                  {wp.warning === 'wind' && (
                    <div className="card-warning-tag">
                      <AlertTriangle size={11} className="inline mr-1" />
                      Yan Rüzgar Riski
                    </div>
                  )}
                  {wp.warning === 'freeze' && (
                    <div className="card-warning-tag freeze">
                      <AlertTriangle size={11} className="inline mr-1" />
                      Don / Buzlanma Riski
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Elevation SVG Chart */}
      <div className="chart-container">
        <svg
          ref={svgRef}
          viewBox="0 0 800 120"
          preserveAspectRatio="none"
          className="elevation-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {profile.length > 1 && (
            <path
              d={`
                M 0 120
                ${profile
                  .map((p, idx) => {
                    const x = (idx / (profile.length - 1)) * 800;
                    const y = 110 - ((p.elevation - minElev) / elevRange) * 90;
                    return `L ${x} ${y}`;
                  })
                  .join(' ')}
                L 800 120 Z
              `}
              fill="url(#elevGradient)"
            />
          )}

          {/* Elevation Line segments colored by slope */}
          {profile.map((p, idx) => {
            if (idx === profile.length - 1) return null;
            const next = profile[idx + 1];
            const x1 = (idx / (profile.length - 1)) * 800;
            const y1 = 110 - ((p.elevation - minElev) / elevRange) * 90;
            const x2 = ((idx + 1) / (profile.length - 1)) * 800;
            const y2 = 110 - ((next.elevation - minElev) / elevRange) * 90;

            let stroke = '#10b981'; // < 3% green
            if (Math.abs(p.grade) >= 3 && Math.abs(p.grade) < 6) stroke = '#eab308'; // 3-6% yellow
            if (Math.abs(p.grade) >= 6) stroke = '#ef4444'; // > 6% red

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}

          {/* Key milestone elevation points */}
          {profile.map((p, idx) => {
            const step = Math.max(1, Math.floor(profile.length / 6));
            const isMilestone = idx === 0 || idx === profile.length - 1 || idx % step === 0;
            if (!isMilestone) return null;

            const x = (idx / (profile.length - 1)) * 800;
            const y = 110 - ((p.elevation - minElev) / elevRange) * 90;
            return (
              <g key={`pt-${idx}`}>
                <circle cx={x} cy={y} r={3} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
                <text x={x} y={Math.max(14, y - 6)} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="500">
                  {p.elevation}m
                </text>
              </g>
            );
          })}

          {/* Interactive Hover Tracker Line */}
          {hoverInfo && (
            <g>
              <line
                x1={hoverInfo.x}
                y1={0}
                x2={hoverInfo.x}
                y2={120}
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              <circle
                cx={hoverInfo.x}
                cy={110 - ((hoverInfo.elevation - minElev) / elevRange) * 90}
                r={5.5}
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Box */}
        {hoverInfo && (
          <div
            className="chart-hover-tooltip"
            style={{
              left: `${Math.min(Math.max(hoverInfo.x * (window.innerWidth > 900 ? 0.9 : 0.8), 20), 720)}px`
            }}
          >
            <div><strong>Konum:</strong> {hoverInfo.distance.toFixed(1)} km</div>
            <div><strong>Yükseklik:</strong> {hoverInfo.elevation} m</div>
            <div><strong>Eğim:</strong> %{hoverInfo.grade}</div>
          </div>
        )}

        {/* Legend */}
        <div className="slope-legend">
          <span className="legend-item"><span className="dot bg-emerald" /> Düz (&lt;%3)</span>
          <span className="legend-item"><span className="dot bg-amber" /> Orta (%3-6)</span>
          <span className="legend-item"><span className="dot bg-rose" /> Dik (&gt;%6)</span>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
