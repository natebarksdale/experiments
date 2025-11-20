// Tufte-style sparkline with variable thickness and color based on mode/power
// Always represents 24 hours of time, even with sparse data
export default function Sparkline({ data, width = 60, height = 20 }) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} />;
  }

  // Handle single data point - position it at the right edge (most recent)
  if (data.length === 1) {
    const d = data[0];
    const color = d.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';
    return (
      <svg width={width} height={height}>
        <circle cx={width - 3} cy={height / 2} r="2" fill={color} />
      </svg>
    );
  }

  const values = data.map(d => typeof d === 'number' ? d : d.value);
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

  // Generate path segments with variable thickness, positioned by timestamp
  const segments = [];

  for (let i = 0; i < data.length - 1; i++) {
    const d1 = data[i];
    const d2 = data[i + 1];

    const t1 = new Date(d1.timestamp);
    const t2 = new Date(d2.timestamp);

    // Position based on time within the 24-hour window
    const x1 = padding + ((t1 - twentyFourHoursAgo) / timeRange) * plotWidth;
    const y1 = padding + plotHeight - ((d1.value - min) / range) * plotHeight;
    const x2 = padding + ((t2 - twentyFourHoursAgo) / timeRange) * plotWidth;
    const y2 = padding + plotHeight - ((d2.value - min) / range) * plotHeight;

    // Color based on mode (heat = red, cool = blue)
    const color = d1.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';

    // Thickness based on power (on = thicker, off = thinner)
    const strokeWidth = d1.power === 'on' ? 2.5 : 1;

    segments.push({
      x1, y1, x2, y2,
      color,
      strokeWidth,
    });
  }

  // Last point for emphasis - positioned by its timestamp
  const lastPoint = data[data.length - 1];
  const lastT = new Date(lastPoint.timestamp);
  const lastX = padding + ((lastT - twentyFourHoursAgo) / timeRange) * plotWidth;
  const lastY = padding + plotHeight - ((lastPoint.value - min) / range) * plotHeight;
  const lastColor = lastPoint.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';

  return (
    <svg
      width={width}
      height={height}
      className="sparkline"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
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
      <circle
        cx={lastX}
        cy={lastY}
        r="2"
        fill={lastColor}
      />
    </svg>
  );
}
