import React, { useEffect, useState } from 'react';
import { useTripStore } from '../trip/tripStore';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  Layers,
  Box,
  CloudSun,
  Download,
  Languages,
  Undo2,
  Redo2,
  PlusCircle,
  RotateCcw,
  FolderKanban,
  ChevronDown,
  Check,
  Copy,
  Trash2,
  Edit2
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    trip,
    savedTrips,
    switchTrip,
    newTrip,
    deleteTrip,
    duplicateTrip,
    setTripName,
    resetToSampleTrip,
    mapLayer,
    is3dTerrain,
    showWeatherOverlay,
    canUndo,
    canRedo,
    undo,
    redo,
    setMapLayer,
    toggle3dTerrain,
    toggleWeatherOverlay
  } = useTripStore();

  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.trip-switcher-wrapper')) {
        setSwitcherOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [switcherOpen]);

  // Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(nextLang);
  };

  const handleExportGpx = () => {
    // Generate GPX structure
    const gpxPoints = trip.days.flatMap((d) =>
      d.spans.flatMap((s) =>
        s.coordinates.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"><ele>50</ele></trkpt>`).join('\n')
      )
    ).join('\n');

    const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rotacı - https://github.com/nakturk/rotaci" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${trip.name}</name>
    <desc>${trip.description}</desc>
  </metadata>
  <trk>
    <name>${trip.name}</name>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="topbar">
      {/* Brand, Trip Switcher & Trip Title */}
      <div className="topbar-brand-section">
        <div className="brand-logo">
          <Compass size={22} className="logo-icon text-sky" />
          <span className="brand-name">Rotacı</span>
        </div>
        <div className="divider-vertical" />

        {/* Trip Switcher & Editable Trip Title */}
        <div className="trip-switcher-wrapper">
          <div className="trip-name-input-group" title={t('app.editTripNameTitle')}>
            <input
              type="text"
              value={trip.name}
              onChange={(e) => setTripName(e.target.value)}
              className="trip-name-input"
              placeholder={t('app.tripNamePlaceholder')}
            />
            <Edit2 size={13} className="trip-name-edit-icon" />
          </div>

          <button
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className={`btn-trip-switcher ${switcherOpen ? 'active' : ''}`}
            title={t('app.tripsMenuTitle')}
          >
            <FolderKanban size={15} />
            <span className="switcher-text">{t('app.tripsMenu')}</span>
            <span className="switcher-count">{savedTrips.length}</span>
            <ChevronDown size={14} className={`chevron-icon ${switcherOpen ? 'rotate' : ''}`} />
          </button>

          {/* Saved Trips Dropdown */}
          {switcherOpen && (
            <div className="trip-switcher-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="switcher-header">
                <span className="switcher-title">📁 {t('app.savedTrips')} ({savedTrips.length})</span>
                <button
                  className="btn-create-trip-tiny"
                  onClick={() => {
                    newTrip();
                    setSwitcherOpen(false);
                  }}
                  title={t('app.startNewTrip')}
                >
                  <PlusCircle size={14} />
                  <span>{t('app.newTrip')}</span>
                </button>
              </div>

              <div className="switcher-trips-list">
                {savedTrips.map((st) => {
                  const isActive = st.id === trip.id;
                  const totalDays = st.days.length;
                  const totalSpans = st.days.reduce((acc, d) => acc + d.spans.length, 0);

                  return (
                    <div
                      key={st.id}
                      className={`switcher-trip-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        switchTrip(st.id);
                        setSwitcherOpen(false);
                      }}
                    >
                      <div className="trip-item-left">
                        <div className="trip-active-indicator">
                          {isActive && <Check size={14} className="text-emerald" />}
                        </div>
                        <div className="trip-item-info">
                          <span className="trip-item-name">{st.name}</span>
                          <span className="trip-item-meta">
                            {t('app.dayCount', { count: totalDays })} • {t('app.spanCount', { count: totalSpans })} • {st.startDate || t('app.noDate')}
                          </span>
                        </div>
                      </div>

                      <div className="trip-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => duplicateTrip(st.id)}
                          className="btn-item-action text-sky"
                          title={t('app.duplicateTrip')}
                        >
                          <Copy size={13} />
                        </button>
                        {savedTrips.length > 1 && (
                          <button
                            onClick={() => deleteTrip(st.id)}
                            className="btn-item-action text-rose"
                            title={t('app.deleteTrip')}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="switcher-footer">
                <button
                  onClick={() => {
                    resetToSampleTrip();
                    setSwitcherOpen(false);
                  }}
                  className="btn-restore-sample"
                  title={t('app.restoreSampleTripDesc')}
                >
                  <RotateCcw size={13} />
                  <span>{t('app.restoreSampleTrip')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="undo-redo-group">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`btn-icon-subtle ${!canUndo ? 'disabled' : ''}`}
            title={t('app.undo')}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`btn-icon-subtle ${!canRedo ? 'disabled' : ''}`}
            title={t('app.redo')}
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      {/* Map Controls & Tools */}
      <div className="topbar-actions">
        {/* Map Layer Selector */}
        <div className="control-dropdown">
          <Layers size={16} className="dropdown-icon" />
          <select
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value as any)}
            className="select-custom"
          >
            <option value="openfreemap-liberty">🏙️ {t('map.street')}</option>
            <option value="openfreemap-bright">🎨 {t('map.bright')}</option>
            <option value="openfreemap-positron">🤍 {t('map.positron')}</option>
            <option value="osm">🗺️ {t('map.osm')}</option>
            <option value="opentopo">⛰️ {t('map.topo')}</option>
            <option value="satellite">🛰️ {t('map.satellite')}</option>
          </select>
        </div>

        {/* 3D Terrain Toggle */}
        <button
          onClick={toggle3dTerrain}
          className={`btn-toggle ${is3dTerrain ? 'active' : ''}`}
          title={t('app.terrain3dTitle')}
        >
          <Box size={16} />
          <span>{t('app.terrain3d')}</span>
        </button>

        {/* Weather Overlay Toggle */}
        <button
          onClick={toggleWeatherOverlay}
          className={`btn-toggle ${showWeatherOverlay ? 'active' : ''}`}
          title={t('app.weatherBadgesTitle')}
        >
          <CloudSun size={16} />
          <span>{t('app.weatherBadges')}</span>
        </button>

        <div className="divider-vertical" />

        {/* Language Switcher */}
        <button onClick={toggleLanguage} className="btn-secondary" title={t('app.switchLanguage')}>
          <Languages size={15} />
          <span className="uppercase font-semibold">{i18n.language}</span>
        </button>

        {/* Export GPX Button */}
        <button onClick={handleExportGpx} className="btn-primary" title={t('app.downloadGpxTitle')}>
          <Download size={15} />
          <span>{t('app.downloadGpx')}</span>
        </button>
      </div>
    </header>
  );
};
