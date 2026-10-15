import React, { useState } from 'react';
import { useTripStore } from '../trip/tripStore';
import { useTranslation } from 'react-i18next';
import type { LinePattern } from '../trip/types';
import {
  Calendar,
  Plus,
  MapPin,
  ShieldAlert,
  Clock,
  Compass,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  X,
  Navigation,
  Flag,
  Eye,
  EyeOff,
  Palette,
  Globe,
  Copy,
  Sliders
} from 'lucide-react';
import { formatRadius } from '../trip/avoidAreaUtils';

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

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const {
    trip,
    globalPois,
    activeDayId,
    activeSpanId,
    pendingStartPoint,
    setPendingStartPoint,
    addSpanToActiveDay,
    setActiveDay,
    setActiveSpan,
    setSelectedPoi,
    addDay,
    updateDay,
    deleteDay,
    moveDay,
    toggleDayVisibility,
    updateDayStyle,
    deleteSpan,
    moveSpan,
    toggleSpanVisibility,
    deletePoi,
    togglePoiGlobal,
    setCopyingPoiModal,
    deleteAvoidArea,
    updateAvoidArea
  } = useTripStore();

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDayTitle, setEditingDayTitle] = useState('');
  const [confirmDayDeleteId, setConfirmDayDeleteId] = useState<string | null>(null);
  const [stylingDayId, setStylingDayId] = useState<string | null>(null);
  const [globalPoisOpen, setGlobalPoisOpen] = useState(true);
  const [tripPoisOpen, setTripPoisOpen] = useState(true);
  const [avoidAreasOpen, setAvoidAreasOpen] = useState(true);
  const [editingAvoidId, setEditingAvoidId] = useState<string | null>(null);

  const activeDay = trip.days.find((d) => d.id === activeDayId) || trip.days[0];

  const totalDistance = trip.days.reduce(
    (sum, d) => sum + d.spans.reduce((sSum, s) => sSum + s.distanceKm, 0),
    0
  );

  const totalMinutes = trip.days.reduce(
    (sum, d) => sum + d.spans.reduce((sSum, s) => sSum + s.durationMinutes, 0),
    0
  );

  const startEditDay = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDayId(id);
    setEditingDayTitle(currentTitle);
  };

  const saveEditDay = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingDayTitle.trim()) {
      updateDay(id, { title: editingDayTitle.trim() });
    }
    setEditingDayId(null);
  };

  return (
    <aside className="sidebar">
      {/* Trip Header Summary */}
      <div className="sidebar-header">
        <h2 className="trip-title">{trip.name}</h2>
        <div className="trip-stats-row">
          <div className="trip-stat">
            <Compass size={14} className="stat-icon text-sky" />
            <span><strong>{totalDistance.toFixed(1)}</strong> km</span>
          </div>
          <div className="trip-stat">
            <Clock size={14} className="stat-icon text-amber" />
            <span><strong>{Math.floor(totalMinutes / 60)}s {totalMinutes % 60}d</strong></span>
          </div>
          <div className="trip-stat">
            <Calendar size={14} className="stat-icon text-emerald" />
            <span><strong>{trip.days.length}</strong> gün</span>
          </div>
        </div>
      </div>

      {/* Days Section */}
      <div className="days-section">
        <div className="section-title-row">
          <span className="section-title">{t('trip.days')} ({trip.days.length})</span>
          <button onClick={() => addDay()} className="btn-icon-subtle" title={t('trip.addDay')}>
            <Plus size={16} />
          </button>
        </div>

        <div className="days-list">
          {trip.days.map((day, idx) => {
            const isSelected = day.id === activeDayId;
            const dayDistance = day.spans.reduce((sum, s) => sum + s.distanceKm, 0);
            const isEditing = editingDayId === day.id;

            const isDayHidden = day.isVisible === false;

            return (
              <div
                key={day.id}
                onClick={() => setActiveDay(day.id)}
                className={`day-card ${isSelected ? 'active' : ''} ${isDayHidden ? 'is-hidden' : ''}`}
                style={{ borderLeftColor: isDayHidden ? '#64748b' : day.color }}
              >
                <div className="day-header">
                  <span className="day-badge" style={{ backgroundColor: isDayHidden ? '#64748b' : day.color }}>
                    {day.index}. Gün
                  </span>
                  <span className="day-date">{day.date}</span>

                    {/* Day Actions */}
                  <div className="day-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleDayVisibility(day.id)}
                      className={`btn-tiny ${isDayHidden ? 'text-dimmed' : 'text-sky'}`}
                      title={isDayHidden ? 'Günü Haritada Göster' : 'Günü Haritada Gizle'}
                    >
                      {isDayHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      onClick={() => setStylingDayId(stylingDayId === day.id ? null : day.id)}
                      className={`btn-tiny ${stylingDayId === day.id ? 'active text-pink' : ''}`}
                      title="Gün Çizgi & Renk Stilini Düzenle"
                    >
                      <Palette size={12} />
                    </button>
                    <button
                      onClick={(e) => startEditDay(day.id, day.title, e)}
                      className="btn-tiny"
                      title="Günü Düzenle"
                    >
                      <Edit2 size={12} />
                    </button>
                    {idx > 0 && (
                      <button
                        onClick={() => moveDay(day.id, 'up')}
                        className="btn-tiny"
                        title="Yukarı Taşı"
                      >
                        <ChevronUp size={12} />
                      </button>
                    )}
                    {idx < trip.days.length - 1 && (
                      <button
                        onClick={() => moveDay(day.id, 'down')}
                        className="btn-tiny"
                        title="Aşağı Taşı"
                      >
                        <ChevronDown size={12} />
                      </button>
                    )}
                    {trip.days.length > 1 && (
                      confirmDayDeleteId === day.id ? (
                        <div className="inline-confirm-box" onClick={(e) => e.stopPropagation()}>
                          <span className="confirm-text">Silinsin mi?</span>
                          <button
                            onClick={() => {
                              deleteDay(day.id);
                              setConfirmDayDeleteId(null);
                            }}
                            className="btn-tiny text-rose"
                            title="Evet, Sil"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmDayDeleteId(null)}
                            className="btn-tiny text-slate"
                            title="İptal"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDayDeleteId(day.id);
                          }}
                          className="btn-tiny text-rose"
                          title="Günü Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Day Line Preview Bar */}
                <div
                  className={`day-line-preview style-${day.lineStyle || 'solid'}`}
                  style={{
                    borderColor: isDayHidden ? '#64748b' : day.color,
                    backgroundColor: (day.lineStyle || 'solid') === 'solid' ? (isDayHidden ? '#64748b' : day.color) : 'transparent',
                    height: `${Math.min(day.lineWidth ?? 5, 6)}px`
                  }}
                  title={`Gün Çizgi Stili: ${day.lineWidth ?? 5}px · ${day.lineStyle || 'solid'}`}
                />

                {isEditing ? (
                  <form onSubmit={(e) => saveEditDay(day.id, e)} className="day-edit-form" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingDayTitle}
                      onChange={(e) => setEditingDayTitle(e.target.value)}
                      autoFocus
                      className="input-tiny"
                    />
                    <button type="submit" className="btn-tiny text-emerald">
                      <Check size={13} />
                    </button>
                    <button type="button" onClick={() => setEditingDayId(null)} className="btn-tiny text-slate">
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <div className="day-title-text">{day.title}</div>
                )}

                <div className="day-meta">
                  <span>{day.spans.length} rota parçası</span>
                  <span>{dayDistance.toFixed(1)} km</span>
                </div>

                {/* Inline Day Style Editor */}
                {stylingDayId === day.id && (
                  <div className="day-style-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="style-panel-header">
                      <span className="style-panel-title">Gün Çizgi & Renk Stili</span>
                      <button onClick={() => setStylingDayId(null)} className="btn-tiny text-slate">
                        <X size={12} />
                      </button>
                    </div>

                    {/* Color Swatches */}
                    <div className="style-panel-section">
                      <span className="panel-sub-label">Renk</span>
                      <div className="color-swatches-grid mini">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateDayStyle(day.id, { color: c })}
                            className={`color-swatch-btn ${day.color === c ? 'active' : ''}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                        <label className="color-picker-label mini" title="Özel Renk Seç">
                          <input
                            type="color"
                            value={day.color}
                            onChange={(e) => updateDayStyle(day.id, { color: e.target.value })}
                            className="color-input-hidden"
                          />
                          <span className="color-picker-icon">🎨</span>
                        </label>
                      </div>
                    </div>

                    {/* Width selector */}
                    <div className="style-panel-section">
                      <span className="panel-sub-label">Kalınlık</span>
                      <div className="pill-btn-group">
                        {[
                          { w: 3, label: '3px' },
                          { w: 5, label: '5px' },
                          { w: 8, label: '8px' },
                          { w: 11, label: '11px' }
                        ].map(({ w, label }) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateDayStyle(day.id, { lineWidth: w })}
                            className={`pill-btn-mini ${(day.lineWidth ?? 5) === w ? 'active' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pattern selector */}
                    <div className="style-panel-section">
                      <span className="panel-sub-label">Çizgi Tipi</span>
                      <div className="pill-btn-group">
                        {[
                          { id: 'solid', label: 'Düz ──' },
                          { id: 'dashed', label: 'Kesik ╌╌' },
                          { id: 'dotted', label: 'Nokta ··' }
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => updateDayStyle(day.id, { lineStyle: p.id as LinePattern })}
                            className={`pill-btn-mini ${(day.lineStyle || 'solid') === p.id ? 'active' : ''}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Day Spans */}
      {activeDay && (
        <div className="spans-section">
          <div className="section-title-row">
            <span className="section-title">{activeDay.index}. Gün Rotaları ({activeDay.spans.length})</span>
            <div className="section-hint">
              <Navigation size={12} className="inline mr-1 text-sky" />
              <span>Haritaya sağ tıklayarak durak ekleyin</span>
            </div>
          </div>

          <div className="spans-list">
            {activeDay.spans.length === 0 ? (
              <div className="empty-spans-card">
                <p>Bu güne henüz rota eklenmedi.</p>
                <small>Harita üzerinde herhangi bir noktaya <strong>sağ tıklayarak</strong> "Buraya Git" seçebilirsiniz.</small>
              </div>
            ) : (
              activeDay.spans.map((span, sIdx) => {
                const isSpanSelected = span.id === activeSpanId;
                const isSpanHidden = span.isVisible === false;
                const effectiveSpanColor = span.color || activeDay.color;
                const effectiveSpanWidth = span.lineWidth ?? activeDay.lineWidth ?? 5;
                const effectiveSpanStyle = span.lineStyle || activeDay.lineStyle || 'solid';
                const hasSpanCustomStyle = !!(span.color || span.lineWidth || span.lineStyle);

                return (
                  <div
                    key={span.id}
                    onClick={() => setActiveSpan(span.id)}
                    className={`span-card ${isSpanSelected ? 'active' : ''} ${isSpanHidden ? 'is-hidden' : ''}`}
                  >
                    <div className="span-card-header">
                      <div className="span-index-group">
                        <span className="span-index-badge">#{span.order}</span>
                        <div
                          className={`span-line-indicator style-${effectiveSpanStyle}`}
                          style={{
                            borderColor: effectiveSpanColor,
                            backgroundColor: effectiveSpanStyle === 'solid' ? effectiveSpanColor : 'transparent',
                            height: `${Math.min(effectiveSpanWidth, 6)}px`
                          }}
                          title={`Çizgi: ${effectiveSpanWidth}px · ${effectiveSpanStyle} (${span.color ? 'Özel Renk' : 'Günden'})`}
                        />
                        {isSpanHidden && <span className="hidden-tag">Gizli</span>}
                      </div>
                      <div className="span-card-tools" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveSpan(span.id)}
                          className={`btn-tiny ${hasSpanCustomStyle ? 'text-pink' : 'text-slate'}`}
                          title="Parçacık Çizgi & Renk Stilini Düzenle (Sağ Panel)"
                        >
                          <Palette size={12} />
                        </button>
                        <button
                          onClick={() => toggleSpanVisibility(span.id)}
                          className={`btn-tiny ${isSpanHidden ? 'text-dimmed' : 'text-sky'}`}
                          title={isSpanHidden ? 'Rotayı Haritada Göster' : 'Rotayı Haritada Gizle'}
                        >
                          {isSpanHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        {sIdx > 0 && (
                          <button
                            onClick={() => moveSpan(activeDay.id, span.id, 'up')}
                            className="btn-tiny"
                            title="Yukarı Taşı"
                          >
                            <ChevronUp size={12} />
                          </button>
                        )}
                        {sIdx < activeDay.spans.length - 1 && (
                          <button
                            onClick={() => moveSpan(activeDay.id, span.id, 'down')}
                            className="btn-tiny"
                            title="Aşağı Taşı"
                          >
                            <ChevronDown size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSpan(span.id);
                          }}
                          className="btn-tiny text-rose"
                          title="Rotayı Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="span-nodes">
                      <div className="node-point start">
                        <span className="dot" />
                        <span className="node-label">{span.from.label}</span>
                      </div>
                      <div className="node-line" />
                      <div className="node-point end">
                        <span className="dot" />
                        <span className="node-label">{span.to.label}</span>
                      </div>
                    </div>

                    <div className="span-badges">
                      <span className="badge badge-vehicle">
                        {span.vehicleType === 'motorcycle'
                          ? '🏍️ Motosiklet'
                          : span.vehicleType === 'car'
                          ? '🚗 Otomobil'
                          : span.vehicleType === 'camper'
                          ? '🚐 Karavan'
                          : span.vehicleType === 'suv'
                          ? '🚙 4x4'
                          : '🚲 Bisiklet'}
                      </span>
                      <span className="badge badge-dist">{span.distanceKm.toFixed(1)} km</span>
                      <span className="badge badge-time">{span.durationMinutes} dk</span>
                      {span.options.curvyRoads && (
                        <span className="badge badge-curvy">~ Virajlı</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* POIs & Avoid Areas Summary */}
      <div className="extras-section">
        <div className="section-title-row">
          <span className="section-title">
            <MapPin size={14} className="inline mr-1 text-amber" /> {t('trip.pois')} ({globalPois.length + trip.pois.length})
          </span>
        </div>

        {/* 1. Global POIs (Home, Shared favorites across all trips) */}
        <button
          type="button"
          className="poi-subgroup-header clickable"
          onClick={() => setGlobalPoisOpen((prev) => !prev)}
          title={globalPoisOpen ? 'Global POI grubunu daralt' : 'Global POI grubunu genişlet'}
        >
          <div className="poi-subgroup-header-row">
            <span className="poi-subgroup-title">
              <Globe size={13} className="inline mr-1 text-sky" /> Global Noktalarım
              <span className="poi-count-badge ml-1.5">{globalPois.length}</span>
            </span>
            <span className={`chevron-indicator ${globalPoisOpen ? 'open' : ''}`}>
              <ChevronDown size={14} />
            </span>
          </div>
          <span className="poi-subgroup-desc">Tüm seyahatlerinizde hazır</span>
        </button>

        {globalPoisOpen && (
          <div className="poi-mini-list">
            {globalPois.length === 0 ? (
              <div className="empty-subgroup-hint">Henüz global POI yok. Haritada bir noktaya sağ tıklayıp ekleyebilirsiniz.</div>
            ) : (
              globalPois.map((poi) => (
                <div
                  key={poi.id}
                  className="poi-item is-global"
                  onClick={() => setSelectedPoi(poi.id)}
                  title="Haritada Odaklan"
                >
                  <span className="poi-icon">
                    {poi.category === 'personal'
                      ? '🏠'
                      : poi.category === 'fuel'
                      ? '⛽'
                      : poi.category === 'camp'
                      ? '⛺'
                      : poi.category === 'hotel'
                      ? '🏨'
                      : poi.category === 'viewpoint'
                      ? '🔭'
                      : poi.category === 'restaurant'
                      ? '🍽️'
                      : '⭐'}
                  </span>
                  <span className="poi-name" title={poi.label}>{poi.label}</span>
                  <div className="poi-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setPendingStartPoint({
                          id: `p-${Date.now()}-start`,
                          label: poi.label,
                          coordinates: poi.coordinates
                        });
                      }}
                      className="btn-tiny text-emerald"
                      title="Buradan Rota Başlat"
                    >
                      <Flag size={12} />
                    </button>
                    <button
                      onClick={async () => {
                        const fromPt = pendingStartPoint || undefined;
                        if (pendingStartPoint) setPendingStartPoint(null);
                        await addSpanToActiveDay(poi.coordinates, poi.label, fromPt);
                      }}
                      className="btn-tiny text-sky"
                      title="Buraya Rota Oluştur"
                    >
                      <Navigation size={12} />
                    </button>
                    <button
                      onClick={() => togglePoiGlobal(poi.id)}
                      className="btn-tiny text-amber"
                      title="Bu Seyahate Özel Yap (Globalden Çıkar)"
                    >
                      <Globe size={12} />
                    </button>
                    <button
                      onClick={() => setCopyingPoiModal({ id: poi.id, label: poi.label })}
                      className="btn-tiny text-slate-300"
                      title="Başka Seyahate Kopyala..."
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => deletePoi(poi.id)}
                      className="btn-tiny text-rose poi-del-btn"
                      title="POI Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. Trip-specific POIs */}
        <button
          type="button"
          className="poi-subgroup-header clickable mt-3"
          onClick={() => setTripPoisOpen((prev) => !prev)}
          title={tripPoisOpen ? 'Seyahat POI grubunu daralt' : 'Seyahat POI grubunu genişlet'}
        >
          <div className="poi-subgroup-header-row">
            <span className="poi-subgroup-title">
              <MapPin size={13} className="inline mr-1 text-emerald" /> Bu Seyahate Özel
              <span className="poi-count-badge ml-1.5">{trip.pois.length}</span>
            </span>
            <span className={`chevron-indicator ${tripPoisOpen ? 'open' : ''}`}>
              <ChevronDown size={14} />
            </span>
          </div>
          <span className="poi-subgroup-desc">Yalnızca bu seyahate ait</span>
        </button>

        {tripPoisOpen && (
          <div className="poi-mini-list">
            {trip.pois.length === 0 ? (
              <div className="empty-subgroup-hint">Bu seyahate özel nokta yok.</div>
            ) : (
              trip.pois.map((poi) => (
                <div
                  key={poi.id}
                  className="poi-item"
                  onClick={() => setSelectedPoi(poi.id)}
                  title="Haritada Odaklan"
                >
                  <span className="poi-icon">
                    {poi.category === 'personal'
                      ? '🏠'
                      : poi.category === 'fuel'
                      ? '⛽'
                      : poi.category === 'camp'
                      ? '⛺'
                      : poi.category === 'hotel'
                      ? '🏨'
                      : poi.category === 'viewpoint'
                      ? '🔭'
                      : poi.category === 'restaurant'
                      ? '🍽️'
                      : '⭐'}
                  </span>
                  <span className="poi-name" title={poi.label}>{poi.label}</span>
                  <div className="poi-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setPendingStartPoint({
                          id: `p-${Date.now()}-start`,
                          label: poi.label,
                          coordinates: poi.coordinates
                        });
                      }}
                      className="btn-tiny text-emerald"
                      title="Buradan Rota Başlat"
                    >
                      <Flag size={12} />
                    </button>
                    <button
                      onClick={async () => {
                        const fromPt = pendingStartPoint || undefined;
                        if (pendingStartPoint) setPendingStartPoint(null);
                        await addSpanToActiveDay(poi.coordinates, poi.label, fromPt);
                      }}
                      className="btn-tiny text-sky"
                      title="Buraya Rota Oluştur"
                    >
                      <Navigation size={12} />
                    </button>
                    <button
                      onClick={() => togglePoiGlobal(poi.id)}
                      className="btn-tiny text-sky"
                      title="Global POI Yap (Tüm Seyahatlerde Görünsün)"
                    >
                      <Globe size={12} />
                    </button>
                    <button
                      onClick={() => setCopyingPoiModal({ id: poi.id, label: poi.label })}
                      className="btn-tiny text-slate-300"
                      title="Başka Seyahate Kopyala..."
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => deletePoi(poi.id)}
                      className="btn-tiny text-rose poi-del-btn"
                      title="POI Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Avoid Areas */}
        <button
          type="button"
          className="poi-subgroup-header clickable mt-3"
          onClick={() => setAvoidAreasOpen((prev) => !prev)}
          title={avoidAreasOpen ? 'Yasak Bölgeleri daralt' : 'Yasak Bölgeleri genişlet'}
        >
          <div className="poi-subgroup-header-row">
            <span className="poi-subgroup-title">
              <ShieldAlert size={13} className="inline mr-1 text-rose" /> {t('trip.avoidAreas')}
              <span className="poi-count-badge ml-1.5">{trip.avoidAreas.length}</span>
            </span>
            <span className={`chevron-indicator ${avoidAreasOpen ? 'open' : ''}`}>
              <ChevronDown size={14} />
            </span>
          </div>
          <span className="poi-subgroup-desc">Rota hesaplamasında kaçınılacak alanlar</span>
        </button>

        {avoidAreasOpen && (
          <div className="poi-mini-list">
            {trip.avoidAreas.length === 0 ? (
              <div className="empty-subgroup-hint">Yasak bölge tanımlanmamış. Haritada bir noktaya sağ tıklayıp ekleyebilirsiniz.</div>
            ) : (
              trip.avoidAreas.map((area) => {
                const isEditing = editingAvoidId === area.id;
                const radius = area.radiusKm || 2;

                return (
                  <div key={area.id} className="avoid-item-card">
                    <div className="avoid-item-header">
                      <span className="avoid-icon">🛡️</span>
                      <span className="avoid-name" title={area.label}>{area.label}</span>
                      <span className="avoid-radius-badge">{formatRadius(radius)}</span>

                      <div className="avoid-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingAvoidId(isEditing ? null : area.id)}
                          className={`btn-tiny ${isEditing ? 'text-rose active' : 'text-slate-300'}`}
                          title="Boyutu Ayarla / Düzenle"
                        >
                          <Sliders size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAvoidArea(area.id);
                          }}
                          className="btn-tiny text-rose poi-del-btn"
                          title="Yasak Bölgeyi Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Size / Radius Slider Control */}
                    {isEditing && (
                      <div className="avoid-edit-panel">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-300 font-semibold">Kaçınma Alanı Boyutu:</span>
                          <span className="text-[11px] font-bold text-rose">{formatRadius(radius)}</span>
                        </div>

                        {/* Quick Presets */}
                        <div className="radius-presets-row mb-2">
                          {[1, 2, 3, 5, 10, 15].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`btn-preset-pill text-[10px] py-0.5 px-1.5 ${radius === preset ? 'active' : ''}`}
                              onClick={() => updateAvoidArea(area.id, { radiusKm: preset })}
                            >
                              {formatRadius(preset)}
                            </button>
                          ))}
                        </div>

                        {/* Real-time Slider */}
                        <input
                          type="range"
                          min="0.5"
                          max="25"
                          step="0.5"
                          value={radius}
                          onChange={(e) => updateAvoidArea(area.id, { radiusKm: parseFloat(e.target.value) })}
                          className="w-full cursor-pointer accent-rose-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>0.5 km</span>
                          <span>10 km</span>
                          <span>25 km</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
