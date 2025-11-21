// Tufte-style sparkline with variable thickness and color based on mode/power
// Always represents 24 hours of time, even with sparse data
// Shows light activity as background shading
export default function Sparkline({ data, width = 60, height = 20, showLights = false }) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} />;
  }

  // Handle single data point - position it at the right edge (most recent)
  if (data.length === 1) {
    const d = data[0];
    const color = d.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';
    return (
      <svg width={width} height={height}>
        {/* Light background if lights were on */}
        {showLights && d.lights?.anyOn && (
          <rect x={width - 6} y={0} width={6} height={height} fill="rgba(255, 200, 100, 0.15)" />
        )}
        <circle cx={width - 3} cy={height / 2} r="2" fill={color} />
      </svg>
    );
  }

  const values = data.map(d => {
    if (typeof d === 'number') return d;
    return d.value ?? d.temperature?.value;
  }).filter(v => v != null);

  if (values.length === 0) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Add padding to prevent clipping
  const padding = 3;
  const plotWidth = width - 2 * padding;
  const plotHeight = height - 2 * padding;

  // Calculate time range - always 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const timeRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Identify light regions for background shading
  const lightRegions = [];
  if (showLights) {
    let regionStart = null;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const lightsOn = d.lights?.anyOn;
      const t = new Date(d.timestamp);
      const x = padding + ((t - twentyFourHoursAgo) / timeRange) * plotWidth;

      if (lightsOn && regionStart === null) {
        regionStart = x;
      } else if (!lightsOn && regionStart !== null) {
        lightRegions.push({ start: regionStart, end: x });
        regionStart = null;
      }
    }

    // Close final region if lights still on
    if (regionStart !== null) {
      lightRegions.push({ start: regionStart, end: width - padding });
    }
  }

  // Generate path segments with variable thickness, positioned by timestamp
  const segments = [];

  for (let i = 0; i < data.length - 1; i++) {
    const d1 = data[i];
    const d2 = data[i + 1];

    const t1 = new Date(d1.timestamp);
    const t2 = new Date(d2.timestamp);

    // Get value - support both old format (d.value) and new format (d.temperature.value)
    const v1 = d1.value ?? d1.temperature?.value;
    const v2 = d2.value ?? d2.temperature?.value;

    if (v1 == null || v2 == null) continue;

    // Position based on time within the 24-hour window
    const x1 = padding + ((t1 - twentyFourHoursAgo) / timeRange) * plotWidth;
    const y1 = padding + plotHeight - ((v1 - min) / range) * plotHeight;
    const x2 = padding + ((t2 - twentyFourHoursAgo) / timeRange) * plotWidth;
    const y2 = padding + plotHeight - ((v2 - min) / range) * plotHeight;

    // Color based on mode (heat = red, cool = blue)
    const color = d1.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';

    // Thickness based on power/operating state
    // Support both old format (d1.power) and new format (d1.operatingState)
    const isActive = d1.power === 'on' || d1.operatingState === 'heating' || d1.operatingState === 'cooling';
    const strokeWidth = isActive ? 2.5 : 1;

    segments.push({
      x1, y1, x2, y2,
      color,
      strokeWidth,
    });
  }

  // Last point for emphasis - positioned by its timestamp
  const lastPoint = data[data.length - 1];
  const lastT = new Date(lastPoint.timestamp);
  const lastValue = lastPoint.value ?? lastPoint.temperature?.value;
  const lastX = padding + ((lastT - twentyFourHoursAgo) / timeRange) * plotWidth;
  const lastY = lastValue != null ? padding + plotHeight - ((lastValue - min) / range) * plotHeight : height / 2;
  const lastColor = lastPoint.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';

  return (
    <svg
      width={width}
      height={height}
      className="sparkline"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Light activity regions (background) */}
      {lightRegions.map((region, i) => (
        <rect
          key={`light-${i}`}
          x={region.start}
          y={0}
          width={region.end - region.start}
          height={height}
          fill="rgba(255, 200, 100, 0.15)"
        />
      ))}

      {/* Temperature line segments */}
      {segments.map((seg, i) => (
        <line
          key={i}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={seg.color}
          strokeWidth={seg.strokeWidth}
          strokeLinecap="round"
        />
      ))}

      {/* Last point emphasis */}
      {lastValue != null && (
        <circle
          cx={lastX}
          cy={lastY}
          r="2"
          fill={lastColor}
        />
      )}
    </svg>
  );
}
