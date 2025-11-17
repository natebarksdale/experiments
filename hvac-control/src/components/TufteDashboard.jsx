import Sparkline from './Sparkline';
import './TufteDashboard.css';

/**
 * Extract sparkline data for a specific zone from log history
 * Returns array of {value, timestamp, mode, power} for the last 24h
 */
const getSparklineData = (zoneName, logs) => {
  if (!logs || logs.length === 0) {
    console.log(`No logs available for ${zoneName}`);
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

export default function TufteDashboard({ zones, lightOnlyZones = [], lights = [], logs, onZoneClick, onToggleLight }) {
  // Combine HVAC zones with light-only zones
  const allZones = [...zones, ...lightOnlyZones];

  // Group by floor
  const floors = [
    { name: '3rd Floor', zones: allZones.filter(z => z.floor === 3) },
    { name: '2nd Floor', zones: allZones.filter(z => z.floor === 2) },
    { name: '1st Floor', zones: allZones.filter(z => z.floor === 1) },
    { name: 'Basement', zones: allZones.filter(z => z.floor === 0) },
  ];

  const getStateColor = (zone) => {
    if (!zone.preferredState || zone.preferredState.power === 'off') return 'var(--gray-500)';
    return zone.preferredState.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';
  };

  const getStateSymbol = (zone) => {
    if (!zone.preferredState || zone.preferredState.power === 'off') return '○';
    return zone.preferredState.mode === 'heat' ? '▲' : '▼';
  };

  const getRowOpacity = (minutesSinceUpdate) => {
    if (minutesSinceUpdate === null) return 1;
    // Gradually increase background gray based on staleness
    // 0-10 min: no change, 10-60 min: slight gray, 60+ min: more gray
    if (minutesSinceUpdate < 10) return 1;
    if (minutesSinceUpdate < 60) return 0.7;
    if (minutesSinceUpdate < 180) return 0.5;
    return 0.3;
  };

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

  return (
    <div className="tufte-dashboard">
      <header className="dashboard-header">
        <h1>Climate Control</h1>
      </header>

      <div className="zones-grid">
        {floors.map(floor => (
          floor.zones.length > 0 && (
            <section key={floor.name} className="floor-group">
              <h2 className="floor-label">{floor.name}</h2>

              {floor.zones.map(zone => {
                const temp = zone.temperature !== null ? Math.round(zone.temperature) : '—';
                const target = zone.preferredState?.target || null;
                const delta = target && zone.temperature ? zone.temperature - target : null;
                // Use unitName from panel which matches log data format
                const sparklineData = zone.hasHvac ? getSparklineData(zone.unitName || zone.name, logs) : [];
                const opacity = getRowOpacity(zone.minutesSinceUpdate);

                // Check if there's a pending change
                const hasPendingChange = !!zone.pendingChange;

                // Get lights for this zone
                const zoneLights = getZoneLights(zone);

                if (hasPendingChange) {
                  console.log(`${zone.name} has pending change:`, {
                    pendingPower: zone.pendingChange.power,
                    pendingMode: zone.pendingChange.mode,
                    currentPower: zone.preferredState?.power,
                    currentMode: zone.preferredState?.mode
                  });
                }

                return (
                  <div key={zone.id} className="zone-group">
                    {/* Main zone row - HVAC or name only */}
                    {zone.hasHvac ? (
                      <div
                        className={`zone-row ${hasPendingChange ? 'zone-row--pending' : ''}`}
                        onClick={() => onZoneClick(zone)}
                        role="button"
                        tabIndex={0}
                        style={{ opacity }}
                      >
                        <div className="zone-state" style={{ color: getStateColor(zone) }}>
                          {getStateSymbol(zone)}
                        </div>

                        <div className="zone-name">{zone.name}</div>

                        <div className="zone-trend">
                          <Sparkline
                            data={sparklineData}
                            width={70}
                            height={20}
                          />
                        </div>

                        <div className="zone-temp">
                          <span className="temp-current">{temp}°</span>
                          {target && (
                            <span className="temp-target">→{target}°</span>
                          )}
                        </div>

                        {delta !== null && (
                          <div className={`zone-delta ${delta > 0 ? 'above' : delta < 0 ? 'below' : 'at'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="zone-row zone-row--lights-only">
                        <div className="zone-name">{zone.name}</div>
                      </div>
                    )}

                    {/* Lights row - shown if zone has lights */}
                    {zoneLights.length > 0 && (
                      <div className="zone-lights-row">
                        {zoneLights.map(light => {
                          const isPending = !!light.pendingChange;
                          const displayState = isPending ? light.pendingChange.state : light.state;
                          const isOn = displayState === 'on';

                          return (
                            <button
                              key={light.row}
                              className={`light-button-dash ${isOn ? 'light-button-dash--on' : ''} ${isPending ? 'light-button-dash--pending' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLight?.(light.row, light.name);
                              }}
                              title={`${light.name}: ${displayState}${isPending ? ' (pending)' : ''}`}
                            >
                              <span className="light-button-dash__icon">{isOn ? '💡' : '○'}</span>
                              <span className="light-button-dash__name">{light.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )
        ))}
      </div>
    </div>
  );
}
