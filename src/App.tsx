import React from 'react';
import { TopBar } from './ui/TopBar';
import { Sidebar } from './ui/Sidebar';
import { Inspector } from './ui/Inspector';
import { MapLibreMap } from './map/MapLibreMap';
import { ElevationWeatherPanel } from './ui/ElevationWeatherPanel';
import { CopyPoiModal } from './ui/CopyPoiModal';
import { ToastNotification } from './ui/ToastNotification';
import './i18n';

export const App: React.FC = () => {
  return (
    <div className="app-layout">
      {/* Top Application Bar */}
      <TopBar />

      {/* Main Workspace */}
      <div className="main-content">
        {/* Left: Days, Spans, POIs & Avoid Areas */}
        <Sidebar />

        {/* Center: MapLibre GL Map & Elevation/Weather Panel */}
        <main className="map-view-wrapper">
          <MapLibreMap />
          <ElevationWeatherPanel />
        </main>

        {/* Right: Selected Span / Route Options Inspector */}
        <Inspector />
      </div>

      {/* Global Modals & Notifications */}
      <CopyPoiModal />
      <ToastNotification />
    </div>
  );
};

export default App;
