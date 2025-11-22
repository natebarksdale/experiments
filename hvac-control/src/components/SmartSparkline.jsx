import { useEffect, useState } from 'react';
import Sparkline from './Sparkline';
import { extractZoneTemperatureHistory } from '../services/sheets';

/**
 * SmartSparkline - Renders sparkline from Google Sheets log history
 * Uses webhook-only architecture (no SmartThings API)
 */
export default function SmartSparkline({
  zoneName,
  logHistory = [],
  width = 80,
  height = 24,
  showLights = true,
  timeWindow = '24h'
}) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!zoneName || !logHistory || logHistory.length === 0) {
      setData([]);
      return;
    }

    // Extract temperature history for this zone
    const hoursBack = parseTimeWindow(timeWindow);
    const zoneData = extractZoneTemperatureHistory(zoneName, logHistory, hoursBack);
    setData(zoneData);
  }, [zoneName, logHistory, timeWindow]);

  function parseTimeWindow(window) {
    const match = window.match(/^(\d+)([hmd])$/);
    if (!match) return 24; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value;
      case 'd': return value * 24;
      case 'm': return value / 60;
      default: return 24;
    }
  }

  // Show loading indicator if no data available
  if (!zoneName || logHistory.length === 0) {
    return (
      <div style={{
        width,
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle'
      }}>
        <div style={{ fontSize: '8px', color: '#999', fontFamily: 'IBM Plex Mono' }}>
          ···
        </div>
      </div>
    );
  }

  return <Sparkline data={data} width={width} height={height} showLights={showLights} />;
}
