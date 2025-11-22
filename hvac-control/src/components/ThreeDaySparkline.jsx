import { useEffect, useState } from 'react';
import './ThreeDaySparkline.css';

/**
 * ThreeDaySparkline - Shows 3 days of temperature history with high/low temps
 * Includes both room temperature and outside temperature traces
 */
export default function ThreeDaySparkline({ deviceId, width = 200, height = 60 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeviceHistory();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDeviceHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [deviceId]);

  async function fetchDeviceHistory() {
    try {
      // Fetch from relative path
      const response = await fetch('/experiments/data/temperature-readings.json');

      if (!response.ok) {
        // Fallback to dev path
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
      console.error('Error fetching 3-day sparkline data:', error);
      setLoading(false);
    }
  }

  function processData(allData) {
    const deviceData = allData.devices?.[deviceId];
    const outsideData = allData.weather; // Assuming weather data is stored here

    if (!deviceData || !deviceData.readings || deviceData.readings.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    // Filter readings for last 3 days
    const now = new Date();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

    const filteredReadings = deviceData.readings.filter(reading => {
      const readingTime = new Date(reading.timestamp);
      return readingTime >= threeDaysAgo;
    });

    if (filteredReadings.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    // Calculate high/low for room temp
    const roomTemps = filteredReadings.map(r => r.value ?? r.temperature?.value).filter(v => v != null);
    const roomHigh = Math.max(...roomTemps);
    const roomLow = Math.min(...roomTemps);

    // Process outside temperature data if available
    let outsideReadings = [];
    let outsideHigh = null;
    let outsideLow = null;

    if (outsideData && outsideData.readings) {
      outsideReadings = outsideData.readings.filter(reading => {
        const readingTime = new Date(reading.timestamp);
        return readingTime >= threeDaysAgo;
      });

      if (outsideReadings.length > 0) {
        const outsideTemps = outsideReadings.map(r => r.temperature).filter(v => v != null);
        outsideHigh = Math.max(...outsideTemps);
        outsideLow = Math.min(...outsideTemps);
      }
    }

    setData({
      roomReadings: filteredReadings,
      outsideReadings,
      roomHigh,
      roomLow,
      outsideHigh,
      outsideLow,
      timeRange: threeDaysAgo
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="three-day-sparkline three-day-sparkline--loading" style={{ width, height }}>
        <div className="three-day-sparkline__loading-text">···</div>
      </div>
    );
  }

  if (!data || data.roomReadings.length === 0) {
    return (
      <div className="three-day-sparkline three-day-sparkline--empty" style={{ width, height }}>
        <div className="three-day-sparkline__empty-text">No data</div>
      </div>
    );
  }

  return (
    <div className="three-day-sparkline" style={{ width }}>
      <div className="three-day-sparkline__header">
        <span className="three-day-sparkline__label">Last 3 Days</span>
        <div className="three-day-sparkline__stats">
          <span className="three-day-sparkline__stat three-day-sparkline__stat--high">
            High: {Math.round(data.roomHigh)}°
          </span>
          <span className="three-day-sparkline__stat three-day-sparkline__stat--low">
            Low: {Math.round(data.roomLow)}°
          </span>
        </div>
      </div>
      <SparklineChart
        roomReadings={data.roomReadings}
        outsideReadings={data.outsideReadings}
        timeRange={data.timeRange}
        width={width}
        height={height}
      />
    </div>
  );
}

/**
 * SparklineChart - Renders the actual SVG chart
 */
function SparklineChart({ roomReadings, outsideReadings, timeRange, width, height }) {
  const padding = 8;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;

  // Combine all values to determine y-axis scale
  const allValues = [];

  roomReadings.forEach(r => {
    const val = r.value ?? r.temperature?.value;
    if (val != null) allValues.push(val);
  });

  outsideReadings.forEach(r => {
    if (r.temperature != null) allValues.push(r.temperature);
  });

  if (allValues.length === 0) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const now = new Date();
  const timeRangeMs = 3 * 24 * 60 * 60 * 1000; // 3 days

  // Generate room temperature path
  const roomSegments = [];
  for (let i = 0; i < roomReadings.length - 1; i++) {
    const d1 = roomReadings[i];
    const d2 = roomReadings[i + 1];

    const t1 = new Date(d1.timestamp);
    const t2 = new Date(d2.timestamp);

    const v1 = d1.value ?? d1.temperature?.value;
    const v2 = d2.value ?? d2.temperature?.value;

    if (v1 == null || v2 == null) continue;

    const x1 = padding + ((t1 - timeRange) / timeRangeMs) * plotWidth;
    const y1 = padding + plotHeight - ((v1 - min) / range) * plotHeight;
    const x2 = padding + ((t2 - timeRange) / timeRangeMs) * plotWidth;
    const y2 = padding + plotHeight - ((v2 - min) / range) * plotHeight;

    const color = d1.mode === 'heat' ? '#ef4444' : '#3b82f6';
    const isActive = d1.power === 'on' || d1.operatingState === 'heating' || d1.operatingState === 'cooling';
    const strokeWidth = isActive ? 2 : 1;

    roomSegments.push({ x1, y1, x2, y2, color, strokeWidth });
  }

  // Generate outside temperature path
  const outsideSegments = [];
  for (let i = 0; i < outsideReadings.length - 1; i++) {
    const d1 = outsideReadings[i];
    const d2 = outsideReadings[i + 1];

    const t1 = new Date(d1.timestamp);
    const t2 = new Date(d2.timestamp);

    const v1 = d1.temperature;
    const v2 = d2.temperature;

    if (v1 == null || v2 == null) continue;

    const x1 = padding + ((t1 - timeRange) / timeRangeMs) * plotWidth;
    const y1 = padding + plotHeight - ((v1 - min) / range) * plotHeight;
    const x2 = padding + ((t2 - timeRange) / timeRangeMs) * plotWidth;
    const y2 = padding + plotHeight - ((v2 - min) / range) * plotHeight;

    outsideSegments.push({ x1, y1, x2, y2 });
  }

  return (
    <svg width={width} height={height} className="three-day-sparkline__chart">
      {/* Outside temperature line (background, lighter) */}
      {outsideSegments.map((seg, i) => (
        <line
          key={`outside-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.5}
        />
      ))}

      {/* Room temperature line (foreground) */}
      {roomSegments.map((seg, i) => (
        <line
          key={`room-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={seg.color}
          strokeWidth={seg.strokeWidth}
          strokeLinecap="round"
        />
      ))}

      {/* Legend dots */}
      <g className="three-day-sparkline__legend">
        <circle cx={width - 50} cy={10} r={3} fill="#94a3b8" opacity={0.5} />
        <text x={width - 42} y={13} fontSize={8} fill="var(--gray-600)">Outside</text>
      </g>
    </svg>
  );
}
