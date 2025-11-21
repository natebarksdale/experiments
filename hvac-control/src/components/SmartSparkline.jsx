import { useEffect, useState } from 'react';
import Sparkline from './Sparkline';

/**
 * SmartSparkline - Fetches historical data from GitHub and renders sparkline
 * This is a wrapper around Sparkline that handles data fetching
 */
export default function SmartSparkline({
  deviceId,
  width = 80,
  height = 24,
  showLights = true,
  timeWindow = '24h'
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeviceHistory();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDeviceHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [deviceId, timeWindow]);

  async function fetchDeviceHistory() {
    try {
      // Fetch from relative path (works for both dev and production)
      // In production this will be at the repo root
      const response = await fetch('/experiments/data/temperature-readings.json');

      if (!response.ok) {
        // Fallback to check if we're in dev and the file is in parent dir
        const devResponse = await fetch('/data/temperature-readings.json');
        if (!devResponse.ok) {
          throw new Error('Failed to fetch temperature data');
        }
        const allData = await devResponse.json();
        processData(allData);
        return;
      }

      const allData = await response.json();
      processData(allData);
    } catch (error) {
      console.error('Error fetching sparkline data:', error);
      setLoading(false);
    }
  }

  function processData(allData) {
    const deviceData = allData.devices?.[deviceId];

    if (!deviceData || !deviceData.readings || deviceData.readings.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    // Filter readings based on time window
    const now = new Date();
    const timeWindowMs = parseTimeWindow(timeWindow);
    const cutoff = new Date(now - timeWindowMs);

    const filteredReadings = deviceData.readings.filter(reading => {
      const readingTime = new Date(reading.timestamp);
      return readingTime >= cutoff;
    });

    setData(filteredReadings);
    setLoading(false);
  }

  function parseTimeWindow(window) {
    const match = window.match(/^(\d+)([hmd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  if (loading) {
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
