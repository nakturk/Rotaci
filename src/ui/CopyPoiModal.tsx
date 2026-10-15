import React from 'react';
import { useTripStore } from '../trip/tripStore';
import { X, Copy, MapPin, Calendar, Route, Check } from 'lucide-react';

export const CopyPoiModal: React.FC = () => {
  const {
    copyingPoiModal,
    setCopyingPoiModal,
    savedTrips,
    trip: currentTrip,
    copyPoiToTrip,
    showToast
  } = useTripStore();

  if (!copyingPoiModal) return null;

  const handleCopy = (targetTripId: string, targetTripName: string) => {
    copyPoiToTrip(copyingPoiModal.id, targetTripId);
    showToast(`"📍 ${copyingPoiModal.label}" başarıyla "${targetTripName}" seyahatine kopyalandı.`);
    setCopyingPoiModal(null);
  };

  return (
    <div className="modal-backdrop" onClick={() => setCopyingPoiModal(null)}>
      <div className="modal-card copy-poi-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/20 text-sky rounded-lg">
              <Copy size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">Başka Seyahate Kopyala</h3>
              <p className="text-xs text-slate-400">
                <MapPin size={12} className="inline mr-1 text-amber" />
                <strong>{copyingPoiModal.label}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => setCopyingPoiModal(null)}
            className="btn-icon-subtle"
            title="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body p-4">
          <p className="text-xs text-slate-300 mb-3">
            Bu POI noktasını aktarmak istediğiniz hedef seyahati seçin:
          </p>

          <div className="copy-trips-list">
            {savedTrips.map((targetTrip) => {
              const isCurrent = targetTrip.id === currentTrip.id;
              const totalKm = targetTrip.days.reduce(
                (sum, d) => sum + d.spans.reduce((sSum, sp) => sSum + sp.distanceKm, 0),
                0
              );

              return (
                <div
                  key={targetTrip.id}
                  className={`copy-trip-item ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handleCopy(targetTrip.id, targetTrip.name || 'Seyahat')}
                >
                  <div className="copy-trip-info">
                    <div className="copy-trip-title-row">
                      <span className="copy-trip-title">{targetTrip.name || 'İsimsiz Seyahat'}</span>
                      {isCurrent && <span className="copy-trip-current-badge">Şu anki</span>}
                    </div>
                    <div className="copy-trip-meta">
                      <span>
                        <Calendar size={11} className="inline mr-1" />
                        {targetTrip.days.length} Gün
                      </span>
                      <span>
                        <Route size={11} className="inline mr-1" />
                        {totalKm.toFixed(0)} km
                      </span>
                      <span>
                        <MapPin size={11} className="inline mr-1" />
                        {targetTrip.pois.length} POI
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-primary copy-select-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(targetTrip.id, targetTrip.name || 'Seyahat');
                    }}
                  >
                    <Check size={14} className="mr-1" />
                    Kopyala
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={() => setCopyingPoiModal(null)}
            className="btn btn-secondary w-full"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};
