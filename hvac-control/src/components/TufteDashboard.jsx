import { useState } from 'react';
import RoomRow from './RoomRow';
import RoomModal from './RoomModal';
import { LOCK_CONFIG } from '../services/sheets';
import './TufteDashboard.css';

/**
 * Extract sparkline data for a specific zone from log history
 * Returns array of {value, timestamp, mode, power} for the last 24h
 */
const getSparklineData = (zoneName, logs) => {
  if (!logs || logs.length === 0) {
    return [];
  }

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const sparklineData = [];

  for (const log of logs) {
    if (log.timestamp < oneDayAgo) break; // logs are reverse chronological

    const zoneData = log.parsed?.find(z => z.name === zoneName);
    if (zoneData && zoneData.temperature) {
      sparklineData.push({
        value: zoneData.temperature,
        timestamp: log.timestamp,
        mode: zoneData.mode,
        power: zoneData.power,
      });
    }
  }

  // Reverse to get chronological order (oldest to newest)
  return sparklineData.reverse();
};

export default function TufteDashboard({ zones, lightOnlyZones = [], lights = [], plugs = [], locks = [], logs, onUpdateZone, onRestoreDefault, onToggleLight, onTogglePlug, onToggleLock }) {
  const [selectedZone, setSelectedZone] = useState(null);
  // Group by floor, separating HVAC zones from light-only zones
  const floors = [
    {
      name: '3rd Floor',
      hvacZones: zones.filter(z => z.floor === 3),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 3),
    },
    {
      name: '2nd Floor',
      hvacZones: zones.filter(z => z.floor === 2),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 2),
    },
    {
      name: '1st Floor',
      hvacZones: zones.filter(z => z.floor === 1),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 1),
    },
    {
      name: 'Basement',
      hvacZones: zones.filter(z => z.floor === 0),
      lightOnlyZones: lightOnlyZones.filter(z => z.floor === 0),
    },
  ];

  // Get light status for a zone
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

  // Get plug status for a zone
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

  // Get lock status for a zone
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

  const handleRoomClick = (zone) => {
    // For light-only zones with exactly one control (light or plug), toggle directly
    if (!zone.hasHvac) {
      const zoneLights = getZoneLights(zone);
      const zonePlugs = getZonePlugs(zone);
      const zoneLocks = getZoneLocks(zone);
      const totalControls = zoneLights.length + zonePlugs.length + zoneLocks.length;

      if (totalControls === 1) {
        // Direct toggle - don't open modal
        if (zoneLights.length === 1) {
          const light = zoneLights[0];
          onToggleLight(light.row, light.name);
          return;
        } else if (zonePlugs.length === 1) {
          const plug = zonePlugs[0];
          onTogglePlug(plug.id, plug.name);
          return;
        }
        // Note: locks are not toggled directly - they still open modal
      }
    }

    // Otherwise, open modal
    setSelectedZone(zone);
  };

  const handleCloseModal = () => {
    setSelectedZone(null);
  };

  return (
    <>
      <div className="tufte-dashboard">
        <div className="zones-grid">
          {floors.map(floor => (
            (floor.hvacZones.length > 0 || floor.lightOnlyZones.length > 0) && (
              <section key={floor.name} className="floor-group">
                <h2 className="floor-label">{floor.name}</h2>

                {/* HVAC Zones - full width rows */}
                {floor.hvacZones.map(zone => {
                  const sparklineData = getSparklineData(zone.unitName || zone.name, logs);
                  const zoneLights = getZoneLights(zone);
                  const zonePlugs = getZonePlugs(zone);
                  const zoneLocks = getZoneLocks(zone);

                  return (
                    <RoomRow
                      key={zone.id}
                      zone={zone}
                      sparklineData={sparklineData}
                      lights={zoneLights}
                      plugs={zonePlugs}
                      locks={zoneLocks}
                      onClick={() => handleRoomClick(zone)}
                    />
                  );
                })}

                {/* Light-Only Zones - grid layout */}
                {floor.lightOnlyZones.length > 0 && (
                  <div
                    className="light-only-grid"
                    data-count={floor.lightOnlyZones.length}
                  >
                    {floor.lightOnlyZones.map(zone => {
                      const zoneLights = getZoneLights(zone);
                      const zonePlugs = getZonePlugs(zone);
                      const zoneLocks = getZoneLocks(zone);

                      return (
                        <RoomRow
                          key={zone.id}
                          zone={zone}
                          sparklineData={[]}
                          lights={zoneLights}
                          plugs={zonePlugs}
                          locks={zoneLocks}
                          onClick={() => handleRoomClick(zone)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )
          ))}
        </div>
      </div>

      {/* Room Detail Modal */}
      {selectedZone && (() => {
        // Get the live zone data from the zones array
        const allZones = [...zones, ...lightOnlyZones];
        const liveZone = allZones.find(z => z.id === selectedZone.id) || selectedZone;

        return (
          <RoomModal
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
    </>
  );
}
