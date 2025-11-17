// Tufte-style sparkline with variable thickness and color based on mode/power
export default function Sparkline({ data, width = 60, height = 20 }) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} />;
  }

  // Handle single data point
  if (data.length === 1) {
    const d = data[0];
    const color = d.mode === 'heat' ? 'var(--heat)' : 'var(--cool)';
    return (
      <svg width={width} height={height}>
        <circle cx={width / 2} cy={height / 2} r="2" fill={color} />
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

  // Generate path segments with variable thickness
  const segments = [];

  for (let i = 0; i < data.length - 1; i++) {
    const d1 = data[i];
    const d2 = data[i + 1];

    const x1 = padding + (i / (data.length - 1)) * plotWidth;
    const y1 = padding + plotHeight - ((d1.value - min) / range) * plotHeight;
    const x2 = padding + ((i + 1) / (data.length - 1)) * plotWidth;
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

  // Last point for emphasis
  const lastPoint = data[data.length - 1];
  const lastX = padding + plotWidth;
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
