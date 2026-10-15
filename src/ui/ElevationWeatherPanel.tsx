import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    curvature > 85
      ? t('inspector.twistyMountain')
      : curvature > 50
      ? t('inspector.mediumTwisty')
      : t('inspector.straightHighway');

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
            <span>{t('elevationWeather.maxGrade')} <strong>%{currentSpan.maxGradePercent}</strong></span>
          </div>

          {/* Curvature Score Badge */}
          <div className="stat-chip curvature-chip" title={t('elevationWeather.curvatureAlgorithm')}>
            <Compass size={14} className="chip-icon text-pink" />
            <span>{t('elevationWeather.curvature')} <strong>{curvature}</strong> ({curvatureLabel})</span>
          </div>

          {/* Surface Breakdown Badge */}
          <div className="stat-chip surface-chip" title={`${t('elevationWeather.surface')} %${surface.paved} ${t('inspector.paved')}, %${surface.gravel} ${t('inspector.gravel')}, %${surface.dirt} ${t('inspector.dirt')}`}>
            <Layers size={14} className="chip-icon text-amber" />
            <span>{t('elevationWeather.surface')} <strong>%{surface.paved} {t('inspector.paved')}</strong></span>
          </div>
        </div>

        {/* Timeline Slider & Weather Refresh */}
        <div className="timeline-control-group">
          <button
            onClick={() => refreshSpanWeather(currentSpan.id)}
            disabled={isCalculatingRoute}
            className="btn-tiny btn-refresh-weather"
            title={t('elevationWeather.refreshWeatherTitle')}
          >
            <RefreshCw size={12} className={isCalculatingRoute ? 'spin' : ''} />
            <span>{t('elevationWeather.refreshWeather')}</span>
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
              title={t('elevationWeather.simHourTitle')}
            />
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-tiny btn-collapse-toggle"
            title={isCollapsed ? t('elevationWeather.expandPanel') : t('elevationWeather.collapsePanel')}
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
            <span>{t('elevationWeather.expectedWeather')}</span>
          </div>
          <div className="weather-cards-row">
            {currentSpan.weatherPoints.map((wp, idx) => {
              const info = getWmoInfo(wp.weatherCode);
              const conditionLabel = t(`weather.wmo.${wp.weatherCode}`, { defaultValue: wp.conditionLabel || info.label });
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
                    <span className="w-condition">{conditionLabel}</span>
                  </div>
                  <div className="w-details">
                    <span title={t('elevationWeather.windSpeedAndDir')}>
                      <Wind size={11} className="inline text-sky" /> {wp.windSpeed} {t('elevationWeather.kmPerHour')}
                    </span>
                    <span title={t('elevationWeather.precipAmountAndProb')}>
                      <Droplets size={11} className="inline text-indigo" /> {wp.precipitationAmount}mm (%{wp.precipitationProbability})
                    </span>
                  </div>
                  {wp.warning === 'wind' && (
                    <div className="card-warning-tag">
                      <AlertTriangle size={11} className="inline mr-1" />
                      {t('elevationWeather.windWarning')}
                    </div>
                  )}
                  {wp.warning === 'freeze' && (
                    <div className="card-warning-tag freeze">
                      <AlertTriangle size={11} className="inline mr-1" />
                      {t('elevationWeather.freezeWarning')}
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
            <div><strong>{t('elevationWeather.location')}</strong> {hoverInfo.distance.toFixed(1)} km</div>
            <div><strong>{t('elevationWeather.elevation')}</strong> {hoverInfo.elevation} m</div>
            <div><strong>{t('elevationWeather.grade')}</strong> %{hoverInfo.grade}</div>
          </div>
        )}

        {/* Legend */}
        <div className="slope-legend">
          <span className="legend-item"><span className="dot bg-emerald" /> {t('elevationWeather.slopeFlat')}</span>
          <span className="legend-item"><span className="dot bg-amber" /> {t('elevationWeather.slopeModerate')}</span>
          <span className="legend-item"><span className="dot bg-rose" /> {t('elevationWeather.slopeSteep')}</span>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
