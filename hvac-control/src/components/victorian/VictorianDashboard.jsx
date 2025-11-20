import { useState } from 'react';
import VictorianZoneCard from './VictorianZoneCard';
import VictorianZoneModal from './VictorianZoneModal';
import './VictorianDashboard.css';

export default function VictorianDashboard({
  zones,
  lightOnlyZones = [],
  lights = [],
  plugs = [],
  locks = [],
  logs,
  onUpdateZone,
  onRestoreDefault,
  onToggleLight,
  onTogglePlug,
  onToggleLock,
}) {
  const [selectedZone, setSelectedZone] = useState(null);

  const floors = [
    {
      name: 'Third Storey',
      level: 3,
      hvacZones: zones.filter(z => z.floor === 3),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 3),
    },
    {
      name: 'Second Storey',
      level: 2,
      hvacZones: zones.filter(z => z.floor === 2),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 2),
    },
    {
      name: 'Ground Floor',
      level: 1,
      hvacZones: zones.filter(z => z.floor === 1),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 1),
    },
    {
      name: 'Cellar',
      level: 0,
      hvacZones: zones.filter(z => z.floor === 0),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 0),
    },
  ];

  const getZoneLights = (zone) => {
    if (!zone.lights || zone.lights.length === 0) return [];
    return zone.lights.map(lightDef => {
      const lightData = lights.find(l => l.row === lightDef.row);
      return {
        ...lightDef,
        state: lightData?.state || 'off',
        pendingChange: lightData?.pendingChange,
      };
    });
  };

  const getZonePlugs = (zone) => {
    if (!zone.plugs || zone.plugs.length === 0) return [];
    return zone.plugs.map(plugDef => {
      const plugData = plugs.find(p => p.id === plugDef.id);
      return {
        ...plugDef,
        state: plugData?.state || 'off',
        pendingChange: plugData?.pendingChange,
      };
    });
  };

  const getZoneLocks = (zone) => {
    if (!zone.locks || zone.locks.length === 0) return [];
    return zone.locks.map(lockDef => {
      const lockData = locks.find(l => l.id === lockDef.id);
      return {
        ...lockDef,
        state: lockData?.state || 'locked',
        pendingChange: lockData?.pendingChange,
      };
    });
  };

  const handleZoneClick = (zone) => {
    if (!zone.hasHvac) {
      const zoneLights = getZoneLights(zone);
      const zonePlugs = getZonePlugs(zone);
      const zoneLocks = getZoneLocks(zone);
      const totalControls = zoneLights.length + zonePlugs.length + zoneLocks.length;

      if (totalControls === 1) {
        if (zoneLights.length === 1) {
          const light = zoneLights[0];
          onToggleLight(light.row, light.name);
          return;
        } else if (zonePlugs.length === 1) {
          const plug = zonePlugs[0];
          onTogglePlug(plug.id, plug.name);
          return;
        }
      }
    }

    setSelectedZone(zone);
  };

  const handleCloseModal = () => {
    setSelectedZone(null);
  };

  return (
    <div className="victorian-dashboard">
      {floors.map(floor => {
        const hasZones = floor.hvacZones.length > 0 || floor.lightOnlyZones.length > 0;
        if (!hasZones) return null;

        return (
          <section key={floor.level} className="victorian-floor">
            <div className="victorian-floor__header">
              <h2 className="victorian-floor__title">{floor.name}</h2>
            </div>

            <div className="victorian-zone-grid">
              {floor.hvacZones.map(zone => (
                <VictorianZoneCard
                  key={zone.id}
                  zone={zone}
                  lights={getZoneLights(zone)}
                  plugs={getZonePlugs(zone)}
                  locks={getZoneLocks(zone)}
                  onClick={() => handleZoneClick(zone)}
                />
              ))}

              {floor.lightOnlyZones.map(zone => (
                <VictorianZoneCard
                  key={zone.id}
                  zone={zone}
                  lights={getZoneLights(zone)}
                  plugs={getZonePlugs(zone)}
                  locks={getZoneLocks(zone)}
                  onClick={() => handleZoneClick(zone)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selectedZone && (() => {
        const allZones = [...zones, ...lightOnlyZones];
        const liveZone = allZones.find(z => z.id === selectedZone.id) || selectedZone;

        return (
          <VictorianZoneModal
            key={liveZone.id}
            zone={liveZone}
            lights={getZoneLights(liveZone)}
            plugs={getZonePlugs(liveZone)}
            locks={getZoneLocks(liveZone)}
            allZones={zones}
            onClose={handleCloseModal}
            onUpdateZone={onUpdateZone}
            onRestoreDefault={onRestoreDefault}
            onToggleLight={onToggleLight}
            onTogglePlug={onTogglePlug}
            onToggleLock={onToggleLock}
          />
        );
      })()}
    </div>
  );
}
