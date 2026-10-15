import React, { useState, useEffect } from 'react';
import { useTripStore } from '../trip/tripStore';
import { useTranslation } from 'react-i18next';
import {
  Flag,
  Navigation,
  MapPin,
  ShieldAlert,
  Copy,
  Check,
  Trash2,
  Globe,
  Sliders,
  Scissors,
  X
} from 'lucide-react';
import { createCircularPolygon, formatRadius } from '../trip/avoidAreaUtils';

export const MapContextMenu: React.FC = () => {
  const { t } = useTranslation();
  const {
    trip,
    contextMenu,
    setContextMenu,
    pendingStartPoint,
    setPendingStartPoint,
    addSpanToActiveDay,
    splitSpan,
    globalPois,
    addPoi,
    deletePoi,
    togglePoiGlobal,
    setCopyingPoiModal,
    addAvoidArea,
    updateAvoidArea,
    deleteAvoidArea,
    deleteSpanEndpoint,
    isCalculatingRoute
  } = useTripStore();

  const [copied, setCopied] = useState(false);
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [poiCoords, setPoiCoords] = useState<[number, number] | null>(null);
  const [poiName, setPoiName] = useState('');
  const [poiCategory, setPoiCategory] = useState<'fuel' | 'camp' | 'hotel' | 'viewpoint' | 'restaurant' | 'attraction' | 'personal'>('viewpoint');
  const [poiIsGlobal, setPoiIsGlobal] = useState(false);

  // Avoid Area Modal state
  const [avoidModalOpen, setAvoidModalOpen] = useState(false);
  const [editingAvoidId, setEditingAvoidId] = useState<string | null>(null);
  const [avoidCoords, setAvoidCoords] = useState<[number, number] | null>(null);
  const [avoidName, setAvoidName] = useState('');
  const [avoidRadiusKm, setAvoidRadiusKm] = useState(2);
  const [avoidIsGlobal, setAvoidIsGlobal] = useState(false);

  // Dismiss context menu when clicking outside
  useEffect(() => {
    if (!contextMenu?.visible) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.map-context-menu') || target.closest('.modal-card')) {
        return;
      }
      setContextMenu(null);
    };

    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('contextmenu', handleOutsideClick);
    }, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('contextmenu', handleOutsideClick);
    };
  }, [contextMenu?.visible, setContextMenu]);

  if (!poiModalOpen && !avoidModalOpen && (!contextMenu || !contextMenu.visible)) return null;

  const activeLngLat = contextMenu?.lngLat || poiCoords || avoidCoords || [0, 0];
  const [lng, lat] = activeLngLat;
  const x = contextMenu?.x || 0;
  const y = contextMenu?.y || 0;
  const isPoi = !!contextMenu?.poiId;
  const poiLabel = contextMenu?.poiLabel;

  // Handle Route To Here
  const handleRouteToHere = async () => {
    const toLabel = poiLabel;
    const fromPoint = pendingStartPoint || undefined;
    setContextMenu(null);
    if (pendingStartPoint) {
      setPendingStartPoint(null);
    }
    await addSpanToActiveDay(activeLngLat, toLabel, fromPoint);
  };

  // Handle Split Route Here
  const handleSplitRoute = async () => {
    if (!contextMenu?.spanId) return;
    const sId = contextMenu.spanId;
    const coords = activeLngLat;
    setContextMenu(null);
    await splitSpan(sId, coords);
  };

  // Handle Delete Stop & Merge Routes
  const handleDeleteStopAndMerge = async () => {
    if (!contextMenu?.stopInfo) return;
    const { spanId, endpoint } = contextMenu.stopInfo;
    setContextMenu(null);
    await deleteSpanEndpoint(spanId, endpoint);
  };

  // Handle Start Here (designate starting point and wait for destination)
  const handleStartHere = () => {
    setContextMenu(null);
    const startPoint = {
      id: `p-${Date.now()}-start`,
      label: poiLabel || `${t('poi.startPointLabel')} (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
      coordinates: activeLngLat
    };
    setPendingStartPoint(startPoint);
  };

  // Handle Delete POI
  const handleDeletePoi = () => {
    if (contextMenu?.poiId) {
      deletePoi(contextMenu.poiId);
      setContextMenu(null);
    }
  };

  // Open Avoid Area Modal (allows setting custom radius and name)
  const handleOpenAvoidModal = () => {
    setEditingAvoidId(null);
    setAvoidCoords(activeLngLat);
    setAvoidName(`${t('avoid.avoidAreaDefaultName')} (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
    setAvoidRadiusKm(2);
    setAvoidIsGlobal(false);
    setAvoidModalOpen(true);
    setContextMenu(null);
  };

  const handleEditAvoidArea = () => {
    if (!contextMenu?.avoidAreaId) return;
    const area = trip.avoidAreas.find((a) => a.id === contextMenu.avoidAreaId);
    if (!area) return;
    const center = area.center || activeLngLat;
    setAvoidCoords(center);
    setAvoidName(area.label);
    setAvoidRadiusKm(area.radiusKm || 2);
    setAvoidIsGlobal(!!area.isGlobal);
    setEditingAvoidId(area.id);
    setAvoidModalOpen(true);
    setContextMenu(null);
  };

  const handleDeleteAvoidArea = () => {
    if (contextMenu?.avoidAreaId) {
      deleteAvoidArea(contextMenu.avoidAreaId);
      setContextMenu(null);
    }
  };

  const handleToggleAvoidGlobal = () => {
    if (!contextMenu?.avoidAreaId) return;
    const area = trip.avoidAreas.find((a) => a.id === contextMenu.avoidAreaId);
    if (area) {
      updateAvoidArea(area.id, { isGlobal: !area.isGlobal });
      setContextMenu(null);
    }
  };

  const handleCloseAvoidModal = () => {
    setAvoidModalOpen(false);
    setEditingAvoidId(null);
    setAvoidCoords(null);
    setAvoidName('');
  };

  const handleSaveAvoidArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!avoidName.trim()) return;
    const targetCoords = avoidCoords || activeLngLat;
    const radius = avoidRadiusKm;
    const polygon = createCircularPolygon(targetCoords, radius);

    if (editingAvoidId) {
      updateAvoidArea(editingAvoidId, {
        label: avoidName.trim(),
        isGlobal: avoidIsGlobal,
        center: targetCoords,
        radiusKm: radius,
        coordinates: polygon
      });
    } else {
      addAvoidArea({
        label: avoidName.trim(),
        isGlobal: avoidIsGlobal,
        center: targetCoords,
        radiusKm: radius,
        coordinates: polygon
      });
    }
    handleCloseAvoidModal();
  };

  // Handle Copy Coords
  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setContextMenu(null);
    }, 800);
  };

  // Open POI Modal (immediately closes the context menu dropdown so it never stays on top)
  const handleOpenPoiModal = () => {
    setPoiCoords(activeLngLat);
    setPoiName(`${t('poi.pointDefaultName')} (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
    setPoiCategory('viewpoint');
    setPoiIsGlobal(false);
    setPoiModalOpen(true);
    setContextMenu(null);
  };

  const handleCategoryChange = (cat: typeof poiCategory) => {
    setPoiCategory(cat);
    if (cat === 'personal') {
      setPoiIsGlobal(true);
    }
  };

  const handleClosePoiModal = () => {
    setPoiModalOpen(false);
    setPoiCoords(null);
    setPoiName('');
    setPoiIsGlobal(false);
  };

  // Submit POI
  const handleSavePoi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poiName.trim()) return;
    const targetCoords = poiCoords || activeLngLat;
    addPoi({
      label: poiName.trim(),
      category: poiCategory,
      coordinates: targetCoords,
      isGlobal: poiIsGlobal
    });
    handleClosePoiModal();
  };

  const isCurrentPoiGlobal = !!contextMenu?.poiId && globalPois.some((p) => p.id === contextMenu.poiId);

  const isAvoidArea = !!contextMenu?.avoidAreaId;
  const avoidLabel = contextMenu?.avoidAreaLabel;
  const currentAvoid = isAvoidArea ? trip.avoidAreas.find((a) => a.id === contextMenu.avoidAreaId) : null;
  const isCurrentAvoidGlobal = !!currentAvoid?.isGlobal;

  // Calculate position accurately relative to the map wrapper
  const mapWrapper = document.querySelector('.map-wrapper');
  const maxW = mapWrapper ? mapWrapper.clientWidth : window.innerWidth;
  const maxH = mapWrapper ? mapWrapper.clientHeight : window.innerHeight;

  const menuWidth = 250;
  const menuHeight = isAvoidArea ? 260 : isPoi ? 240 : contextMenu?.stopInfo ? 260 : 220;
  const safeX = Math.max(10, Math.min(x, maxW - menuWidth - 15));
  const safeY = Math.max(10, Math.min(y, maxH - menuHeight - 15));

  const isMenuVisible = !!contextMenu?.visible && !poiModalOpen && !avoidModalOpen;

  return (
    <>
      {/* Context Menu Dropdown - only shown when POI or Avoid Area modal is not open */}
      {isMenuVisible && (
        <div
          className="map-context-menu"
          style={{ left: safeX, top: safeY }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menu-header">
            <span>
              {isAvoidArea
                ? `🛡️ ${avoidLabel || t('avoid.avoidAreaDefaultName')}`
                : isPoi
                ? `📍 ${poiLabel}`
                : contextMenu?.stopInfo
                ? `🛑 ${contextMenu.stopInfo.label}`
                : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
            </span>
            <button onClick={() => setContextMenu(null)} className="menu-close-btn" title={t('actions.close')}>
              <X size={14} />
            </button>
          </div>

          <div className="menu-items">
            {contextMenu?.stopInfo && (
              <>
                <button
                  className="menu-item subtle text-rose"
                  onClick={handleDeleteStopAndMerge}
                  disabled={isCalculatingRoute}
                  title={contextMenu.stopInfo.isIntermediate ? t('contextMenu.deleteStopAndMerge') : t('contextMenu.deleteStop')}
                >
                  <Trash2 size={16} />
                  <span>
                    {contextMenu.stopInfo.isIntermediate
                      ? t('contextMenu.deleteStopAndMerge')
                      : t('contextMenu.deleteStop')}
                  </span>
                </button>
                <div className="menu-divider" />
              </>
            )}

            {isAvoidArea ? (
              <>
                <button
                  className="menu-item"
                  onClick={handleEditAvoidArea}
                >
                  <Sliders size={16} className="text-rose" />
                  <span>{t('contextMenu.editAvoidArea')}</span>
                </button>
                <button
                  className="menu-item"
                  onClick={handleToggleAvoidGlobal}
                >
                  <Globe size={16} className={isCurrentAvoidGlobal ? 'text-amber' : 'text-rose'} />
                  <span>{isCurrentAvoidGlobal ? t('contextMenu.makeAvoidTripSpecific') : t('contextMenu.makeAvoidGlobal')}</span>
                </button>
                <button className="menu-item subtle text-rose" onClick={handleDeleteAvoidArea}>
                  <Trash2 size={16} />
                  <span>{t('contextMenu.deleteAvoidArea')}</span>
                </button>
                <div className="menu-divider" />
              </>
            ) : null}

            {contextMenu?.spanId && (
              <button
                className="menu-item primary"
                onClick={handleSplitRoute}
                disabled={isCalculatingRoute}
                title={t('contextMenu.splitRouteHere')}
              >
                <Scissors size={16} className="text-pink" />
                <span>{t('contextMenu.splitRouteHere')}</span>
              </button>
            )}

            <button
              className="menu-item primary"
              onClick={handleRouteToHere}
              disabled={isCalculatingRoute}
            >
              <Navigation size={16} className="text-sky" />
              <span>
                {pendingStartPoint
                  ? `${t('contextMenu.routeToHere')}`
                  : t('contextMenu.routeToHere')}
              </span>
            </button>

            <button
              className="menu-item"
              onClick={handleStartHere}
              disabled={isCalculatingRoute}
            >
              <Flag size={16} className="text-emerald" />
              <span>{t('contextMenu.startHere')}</span>
            </button>

            {!isAvoidArea && (
              isPoi ? (
                <>
                  <button
                    className="menu-item"
                    onClick={() => {
                      if (contextMenu?.poiId) {
                        togglePoiGlobal(contextMenu.poiId);
                        setContextMenu(null);
                      }
                    }}
                  >
                    <Globe size={16} className={isCurrentPoiGlobal ? 'text-amber' : 'text-sky'} />
                    <span>{isCurrentPoiGlobal ? t('contextMenu.makePoiTripSpecific') : t('contextMenu.makePoiGlobal')}</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      if (contextMenu?.poiId) {
                        setCopyingPoiModal({ id: contextMenu.poiId, label: poiLabel || 'POI' });
                        setContextMenu(null);
                      }
                    }}
                  >
                    <Copy size={16} className="text-emerald" />
                    <span>{t('contextMenu.copyPoiToTrip')}</span>
                  </button>

                  <button className="menu-item subtle text-rose" onClick={handleDeletePoi}>
                    <Trash2 size={16} />
                    <span>{t('contextMenu.deletePoi')}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="menu-item"
                    onClick={handleOpenPoiModal}
                  >
                    <MapPin size={16} className="text-amber" />
                    <span>{t('contextMenu.addPoiHere')}</span>
                  </button>

                  <button className="menu-item" onClick={handleOpenAvoidModal}>
                    <ShieldAlert size={16} className="text-rose" />
                    <span>{t('contextMenu.addAvoidAreaHere')}</span>
                  </button>
                </>
              )
            )}

            <div className="menu-divider" />

            <button className="menu-item subtle" onClick={handleCopyCoords}>
              {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
              <span>{copied ? t('contextMenu.copied') : t('contextMenu.copyCoords')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Add POI Modal */}
      {poiModalOpen && (
        <div className="modal-backdrop" onClick={handleClosePoiModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('contextMenu.newPoiModalTitle')}</h3>
              <button onClick={handleClosePoiModal} className="btn-icon-subtle" title={t('actions.close')}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePoi} className="modal-form">
              <div className="form-group">
                <label>{t('contextMenu.poiName')}</label>
                <input
                  type="text"
                  value={poiName}
                  onChange={(e) => setPoiName(e.target.value)}
                  placeholder={t('contextMenu.poiNamePlaceholder')}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('contextMenu.category')}</label>
                <select
                  value={poiCategory}
                  onChange={(e) => handleCategoryChange(e.target.value as any)}
                >
                  <option value="personal">{t('contextMenu.catPersonal')}</option>
                  <option value="viewpoint">{t('contextMenu.catViewpoint')}</option>
                  <option value="camp">{t('contextMenu.catCamp')}</option>
                  <option value="hotel">{t('contextMenu.catHotel')}</option>
                  <option value="restaurant">{t('contextMenu.catRestaurant')}</option>
                  <option value="fuel">{t('contextMenu.catFuel')}</option>
                  <option value="attraction">{t('contextMenu.catAttraction')}</option>
                </select>
              </div>

              <div className="form-group checkbox-group bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/60">
                <label className="checkbox-label flex items-center gap-2 cursor-pointer text-xs font-semibold text-sky">
                  <input
                    type="checkbox"
                    checked={poiIsGlobal}
                    onChange={(e) => setPoiIsGlobal(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span>{t('contextMenu.globalPoiCheckbox')}</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1 pl-5 leading-relaxed">
                  {t('contextMenu.globalPoiHelp')}
                </p>
              </div>

              <div className="form-group">
                <label>{t('contextMenu.location')}</label>
                <div className="coords-display">
                  {lat.toFixed(5)}°, {lng.toFixed(5)}°
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleClosePoiModal}
                  className="btn btn-secondary"
                >
                  {t('actions.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('actions.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Avoid Area Modal */}
      {avoidModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseAvoidModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-500/20 text-rose rounded-lg">
                  <ShieldAlert size={18} />
                </span>
                <h3 className="text-base font-semibold text-white">
                  {editingAvoidId ? t('avoid.editAvoidArea') : t('avoid.newAvoidArea')}
                </h3>
              </div>
              <button onClick={handleCloseAvoidModal} className="btn-icon-subtle" title={t('actions.close')}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAvoidArea} className="modal-form">
              <div className="form-group">
                <label>{t('avoid.areaName')}</label>
                <input
                  type="text"
                  value={avoidName}
                  onChange={(e) => setAvoidName(e.target.value)}
                  placeholder={t('avoid.areaNamePlaceholder')}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="mb-0 flex items-center gap-1.5">
                    <Sliders size={13} className="text-rose" /> {t('avoid.avoidAreaSize')}
                  </label>
                  <span className="text-xs font-bold text-rose bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {t('avoid.radius')} {formatRadius(avoidRadiusKm)} ({t('avoid.diameter')} {formatRadius(avoidRadiusKm * 2)})
                  </span>
                </div>

                <div className="radius-presets-row mb-2">
                  {[0.5, 1, 2, 3, 5, 10, 15].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`btn-preset-pill ${avoidRadiusKm === r ? 'active' : ''}`}
                      onClick={() => setAvoidRadiusKm(r)}
                    >
                      {formatRadius(r)}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="25"
                  step="0.5"
                  value={avoidRadiusKm}
                  onChange={(e) => setAvoidRadiusKm(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>500 m</span>
                  <span>5 km</span>
                  <span>10 km</span>
                  <span>25 km</span>
                </div>
              </div>

              <div className="form-group checkbox-group bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/60">
                <label className="checkbox-label flex items-center gap-2 cursor-pointer text-xs font-semibold text-rose">
                  <input
                    type="checkbox"
                    checked={avoidIsGlobal}
                    onChange={(e) => setAvoidIsGlobal(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span>{t('avoid.globalAvoidArea')}</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1 pl-5 leading-relaxed">
                  {t('avoid.globalAvoidAreaDesc')}
                </p>
              </div>

              <div className="form-group">
                <label>{t('avoid.centerLocation')}</label>
                <div className="coords-display">
                  {lat.toFixed(5)}°, {lng.toFixed(5)}°
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleCloseAvoidModal}
                  className="btn btn-secondary"
                >
                  {t('actions.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#e11d48' }}>
                  {editingAvoidId ? t('avoid.saveChanges') : t('avoid.createAvoidAreaBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
