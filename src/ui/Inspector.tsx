import React from 'react';
import { useTripStore } from '../trip/tripStore';
import { useTranslation } from 'react-i18next';
import type { VehicleType, SurfacePreference, LinePattern } from '../trip/types';
import {
  Sliders,
  Shield,
  Layers,
  CornerUpRight,
  TrendingDown,
  Navigation,
  Palette,
  RotateCcw,
  Ship,
  Percent,
  AlertTriangle,
  Mountain
} from 'lucide-react';

const COLOR_PRESETS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#f97316',
  '#84cc16',
  '#6366f1'
];

export const Inspector: React.FC = () => {
  const { t } = useTranslation();
  const {
    trip,
    activeDayId,
    activeSpanId,
    updateSpanOptions,
    updateSpanVehicle,
    updateSpanStyle,
    applySpanAlternative
  } = useTripStore();

  const activeDay = trip.days.find((d) => d.id === activeDayId);
  const activeSpan = activeDay?.spans.find((s) => s.id === activeSpanId);

  if (!activeSpan) {
    return (
      <aside className="inspector empty">
        <div className="empty-message">
          <Navigation size={28} className="text-slate mb-2" />
          <p>Düzenlemek için haritadan veya listeden bir rota parçası seçin.</p>
        </div>
      </aside>
    );
  }

  const { options } = activeSpan;
  const effectiveColor = activeSpan.color || activeDay?.color || '#3b82f6';
  const effectiveWidth = activeSpan.lineWidth ?? activeDay?.lineWidth ?? 5;
  const effectiveLineStyle = activeSpan.lineStyle || activeDay?.lineStyle || 'solid';
  const hasCustomStyle = !!(activeSpan.color || activeSpan.lineWidth || activeSpan.lineStyle);

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <Sliders size={16} className="text-sky" />
          <span>Rota Kriterleri</span>
        </div>
        <span className="span-order-tag">{activeSpan.order}. Parça</span>
      </div>

      {/* Vehicle Type Selection */}
      <div className="form-group">
        <label className="form-label">{t('routing.vehicle')}</label>
        <div className="vehicle-grid">
          {[
            { id: 'car', label: 'Otomobil', icon: '🚗' },
            { id: 'motorcycle', label: 'Motosiklet', icon: '🏍️' },
            { id: 'camper', label: 'Karavan', icon: '🚐' },
            { id: 'suv', label: '4x4 Arazi', icon: '🚙' },
            { id: 'bicycle', label: 'Bisiklet', icon: '🚲' }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => updateSpanVehicle(activeSpan.id, v.id as VehicleType)}
              className={`vehicle-btn ${activeSpan.vehicleType === v.id ? 'active' : ''}`}
            >
              <span className="v-icon">{v.icon}</span>
              <span className="v-label">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic description of the selected vehicle profile */}
        <div className="vehicle-profile-card">
          {activeSpan.vehicleType === 'motorcycle' && (
            <p>🏍️ <strong>Motosiklet:</strong> Virajlı tali yolları ve dağ geçitlerini tercih eder. Otoyolları azaltır, manzaralı güzergâhları öne çıkarır.</p>
          )}
          {activeSpan.vehicleType === 'car' && (
            <p>🚗 <strong>Otomobil:</strong> Standart binek araç profili. Düzgün asfalt zeminleri ve standart hız sınırlarını optimize eder.</p>
          )}
          {activeSpan.vehicleType === 'camper' && (
            <p>🚐 <strong>Karavan (Camper):</strong> Valhalla kamyon modelini kullanır (3.2m yükseklik, 2.35m genişlik, 3.5t ağırlık). Dar köy sokaklarından, alçak tünellerden ve aşırı dik yokuşlardan kaçınır.</p>
          )}
          {activeSpan.vehicleType === 'suv' && (
            <p>🚙 <strong>4x4 Arazi:</strong> Toprak, stabilize, tarla ve orman içi patika yolları (tracks) rotaya dahil etmeye izin verir.</p>
          )}
          {activeSpan.vehicleType === 'bicycle' && (
            <p>🚲 <strong>Bisiklet:</strong> Karayolları ve otoyollardan kaçınır; bisiklet parkurları, kırsal yollar ve az eğimli rotaları seçer.</p>
          )}
        </div>
      </div>

      {/* Surface Preference (Asfalt / Karma / Offroad) */}
      <div className="form-group">
        <label className="form-label">{t('routing.surface')}</label>
        <div className="surface-buttons">
          {[
            { id: 'paved', label: t('routing.surfacePaved') },
            { id: 'mixed', label: t('routing.surfaceMixed') },
            { id: 'offroad', label: t('routing.surfaceOffroad') }
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => updateSpanOptions(activeSpan.id, { surface: s.id as SurfacePreference })}
              className={`pill-btn ${options.surface === s.id ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Routing Criteria Toggles */}
      <div className="form-group">
        <label className="form-label">Özel Rota Tercihleri</label>
        <div className="toggle-list">
          <label className="toggle-item">
            <span className="toggle-label">
              <CornerUpRight size={15} className="text-amber" />
              <span>{t('routing.curvyRoads')}</span>
            </span>
            <input
              type="checkbox"
              checked={options.curvyRoads}
              onChange={(e) => updateSpanOptions(activeSpan.id, { curvyRoads: e.target.checked })}
              className="checkbox-custom"
            />
          </label>

          <label className="toggle-item">
            <span className="toggle-label">
              <TrendingDown size={15} className="text-emerald" />
              <span>{t('routing.avoidSteep')}</span>
            </span>
            <input
              type="checkbox"
              checked={options.avoidSteep}
              onChange={(e) => updateSpanOptions(activeSpan.id, { avoidSteep: e.target.checked })}
              className="checkbox-custom"
            />
          </label>

          <label className="toggle-item">
            <span className="toggle-label">
              <Shield size={15} className="text-rose" />
              <span>{t('routing.avoidTolls')}</span>
            </span>
            <input
              type="checkbox"
              checked={options.avoidTolls}
              onChange={(e) => updateSpanOptions(activeSpan.id, { avoidTolls: e.target.checked })}
              className="checkbox-custom"
            />
          </label>

          <label className="toggle-item">
            <span className="toggle-label">
              <Layers size={15} className="text-indigo" />
              <span>{t('routing.avoidHighways')}</span>
            </span>
            <input
              type="checkbox"
              checked={options.avoidHighways}
              onChange={(e) => updateSpanOptions(activeSpan.id, { avoidHighways: e.target.checked })}
              className="checkbox-custom"
            />
          </label>

          <label className="toggle-item">
            <span className="toggle-label">
              <Ship size={15} className="text-cyan-400" />
              <span>{t('routing.avoidFerries')}</span>
            </span>
            <input
              type="checkbox"
              checked={options.avoidFerries ?? false}
              onChange={(e) => updateSpanOptions(activeSpan.id, { avoidFerries: e.target.checked })}
              className="checkbox-custom"
            />
          </label>
        </div>

        {/* Max Grade Limit Selector */}
        <div className="grade-limit-row mt-3">
          <label className="sub-label flex items-center justify-between text-xs text-dim mb-1">
            <span>
              <Percent size={13} className="inline mr-1 text-emerald" />
              {t('routing.maxGradeLimit')}
            </span>
            <span className="text-sky font-semibold">
              {options.maxGradeLimit ? `%${options.maxGradeLimit} maks` : 'Sınırsız'}
            </span>
          </label>
          <div className="grade-limit-buttons">
            {[
              { val: undefined, label: 'Yok' },
              { val: 6, label: '%6' },
              { val: 8, label: '%8' },
              { val: 10, label: '%10' },
              { val: 12, label: '%12' },
              { val: 15, label: '%15' }
            ].map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => updateSpanOptions(activeSpan.id, { maxGradeLimit: g.val })}
                className={`btn-tiny grade-btn ${options.maxGradeLimit === g.val ? 'active' : ''}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routing Engine & Warnings Banner */}
      {activeSpan.routingWarnings && activeSpan.routingWarnings.length > 0 && (
        <div className="routing-warnings-banner">
          {activeSpan.routingWarnings.map((w, i) => (
            <div key={i} className="warning-item">
              <AlertTriangle size={13} className="inline mr-1 text-amber flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alternative Routes Card */}
      {activeSpan.alternatives && activeSpan.alternatives.length > 0 && (
        <div className="form-group alternatives-box">
          <label className="form-label flex items-center justify-between">
            <span>
              <Navigation size={14} className="inline mr-1 text-sky" />
              <span>Alternatif Rotalar</span>
            </span>
            <span className="text-dim text-xs">{activeSpan.alternatives.length} alternatif</span>
          </label>
          <div className="alternatives-list">
            {activeSpan.alternatives.map((alt) => (
              <div key={alt.id} className="alternative-card">
                <div className="alt-details">
                  <div className="alt-title">{alt.name}</div>
                  <div className="alt-metrics">
                    <span>{alt.distanceKm} km</span> ·{' '}
                    <span>{Math.floor(alt.durationMinutes / 60)}s {alt.durationMinutes % 60}d</span> ·{' '}
                    <span className="text-pink">Viraj: {alt.curvatureScore}</span>
                    {alt.maxGradePercent ? <span> · Eğim: %{alt.maxGradePercent}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => applySpanAlternative(activeSpan.id, alt.id)}
                  className="btn-tiny btn-switch-alt"
                  title="Bu rotayı aktif rota olarak kullan"
                >
                  Kullan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line & Color Styling */}
      <div className="form-group style-section">
        <div className="section-subtitle-row">
          <label className="form-label">
            <Palette size={15} className="inline mr-1 text-pink" />
            <span>Çizgi & Renk Stili</span>
          </label>
          {hasCustomStyle && (
            <button
              onClick={() => updateSpanStyle(activeSpan.id, { color: null, lineWidth: null, lineStyle: null })}
              className="btn-tiny text-sky reset-style-btn"
              title="Günün varsayılan stiline dön"
            >
              <RotateCcw size={11} className="inline mr-1" />
              Günden Devral
            </button>
          )}
        </div>

        {/* Live Line Preview */}
        <div className="line-preview-box">
          <div className="line-preview-info">
            <span className="preview-label">Önizleme:</span>
            <span className="preview-badge" style={{ color: effectiveColor }}>
              {activeSpan.color ? 'Özel' : 'Günden'} · {effectiveWidth}px · {
                effectiveLineStyle === 'solid' ? 'Düz' : effectiveLineStyle === 'dashed' ? 'Kesikli' : 'Noktalı'
              }
            </span>
          </div>
          <div className="line-preview-track">
            <div
              className={`line-preview-bar style-${effectiveLineStyle}`}
              style={{
                borderColor: effectiveColor,
                backgroundColor: effectiveLineStyle === 'solid' ? effectiveColor : 'transparent',
                height: `${Math.min(effectiveWidth, 8)}px`
              }}
            />
          </div>
        </div>

        {/* Color Palette */}
        <div className="style-subsection">
          <span className="sub-label">Parçacık Rengi</span>
          <div className="color-swatches-grid">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateSpanStyle(activeSpan.id, { color: c })}
                className={`color-swatch-btn ${effectiveColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <label className="color-picker-label" title="Özel Renk Seç">
              <input
                type="color"
                value={effectiveColor}
                onChange={(e) => updateSpanStyle(activeSpan.id, { color: e.target.value })}
                className="color-input-hidden"
              />
              <span className="color-picker-icon">🎨</span>
            </label>
          </div>
        </div>

        {/* Line Thickness */}
        <div className="style-subsection">
          <span className="sub-label">Çizgi Kalınlığı</span>
          <div className="width-buttons-row">
            {[
              { w: 3, label: 'İnce (3px)' },
              { w: 5, label: 'Normal (5px)' },
              { w: 8, label: 'Kalın (8px)' },
              { w: 11, label: 'Geniş (11px)' }
            ].map(({ w, label }) => (
              <button
                key={w}
                type="button"
                onClick={() => updateSpanStyle(activeSpan.id, { lineWidth: w })}
                className={`pill-btn ${effectiveWidth === w ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Line Pattern (Solid / Dashed / Dotted) */}
        <div className="style-subsection">
          <span className="sub-label">Çizgi Deseni</span>
          <div className="pattern-buttons-row">
            {[
              { id: 'solid', label: 'Düz', preview: '────' },
              { id: 'dashed', label: 'Kesikli', preview: '╌╌╌╌' },
              { id: 'dotted', label: 'Noktalı', preview: '····' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSpanStyle(activeSpan.id, { lineStyle: p.id as LinePattern })}
                className={`pill-btn pattern-btn ${effectiveLineStyle === p.id ? 'active' : ''}`}
              >
                <span className="pattern-glyph">{p.preview}</span>
                <span className="pattern-name">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Curvature & Road Character Card */}
      <div className="surface-stats-card">
        <div className="surface-stat-title">
          <span>Viraj Skoru (Açı / km)</span>
          <span className="stat-highlight-pink">{activeSpan.curvatureScore ?? 65} / 100</span>
        </div>
        <div className="curvature-meter-bar">
          <div
            className="curvature-fill"
            style={{ width: `${Math.min(100, Math.max(10, activeSpan.curvatureScore ?? 65))}%` }}
          />
        </div>
        <div className="curvature-desc-row">
          <span>
            {(activeSpan.curvatureScore ?? 65) > 85
              ? '🏔️ Bol Virajlı Dağ/Kıyı Yolu'
              : (activeSpan.curvatureScore ?? 65) > 50
              ? '🌿 Orta Seviye Virajlı Yol'
              : '🛣️ Düz / Otoyol Karakterli'}
          </span>
        </div>
      </div>

        <div className="surface-stats-card">
        <div className="surface-stat-title flex items-center justify-between">
          <span>Yol Yüzeyi Dağılımı</span>
          <span className="text-xs text-dim">
            {activeSpan.surfaceIsEstimated ? 'Tahmini' : '✓ OSM Gerçek'}
          </span>
        </div>
        <div className="surface-bar">
          <div
            className="bar-seg paved"
            style={{ width: `${activeSpan.surfaceBreakdown?.paved ?? 88}%` }}
            title={`Asfalt: %${activeSpan.surfaceBreakdown?.paved ?? 88}`}
          />
          <div
            className="bar-seg gravel"
            style={{ width: `${activeSpan.surfaceBreakdown?.gravel ?? 10}%` }}
            title={`Stabilize: %${activeSpan.surfaceBreakdown?.gravel ?? 10}`}
          />
          <div
            className="bar-seg dirt"
            style={{ width: `${activeSpan.surfaceBreakdown?.dirt ?? 2}%` }}
            title={`Toprak: %${activeSpan.surfaceBreakdown?.dirt ?? 2}`}
          />
        </div>
        <div className="surface-legend-row">
          <span><span className="sq paved" /> %{activeSpan.surfaceBreakdown?.paved ?? 88} Asfalt</span>
          <span><span className="sq gravel" /> %{activeSpan.surfaceBreakdown?.gravel ?? 10} Stabilize</span>
          <span><span className="sq dirt" /> %{activeSpan.surfaceBreakdown?.dirt ?? 2} Toprak</span>
        </div>
      </div>

      {/* Elevation & Grade Card */}
      <div className="surface-stats-card">
        <div className="surface-stat-title flex items-center justify-between">
          <span>
            <Mountain size={14} className="inline mr-1 text-sky" />
            Topografya & Eğim
          </span>
          <span className="text-xs text-dim">DEM Yükseklik</span>
        </div>
        <div className="elevation-mini-metrics">
          <div className="elev-metric">
            <span className="label">Tırmanış:</span>
            <span className="value text-emerald">+{activeSpan.ascentMeters}m</span>
          </div>
          <div className="elev-metric">
            <span className="label">İniş:</span>
            <span className="value text-sky">-{activeSpan.descentMeters}m</span>
          </div>
          <div className="elev-metric">
            <span className="label">Maks. Eğim:</span>
            <span className="value text-amber">%{activeSpan.maxGradePercent}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
