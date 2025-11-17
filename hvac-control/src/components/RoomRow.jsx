import { motion } from 'framer-motion';
import Sparkline from './Sparkline';
import './RoomRow.css';

/**
 * RoomRow - A single room's status display
 * Uses radial gradients to encode light status information
 */
export default function RoomRow({ zone, sparklineData, lights, onClick }) {
  const { name, temperature, minutesSinceUpdate, preferredState, hasHvac } = zone;
  const { power, mode, target } = preferredState || {};

  const temp = temperature !== null ? Math.round(temperature) : '—';
  const delta = target && temperature ? temperature - target : null;
  const hasPendingChange = !!zone.pendingChange;

  // Calculate light status for gradient background
  const totalLights = lights.length;
  const lightsOn = lights.filter(l => {
    const displayState = l.pendingChange?.state ?? l.state;
    return displayState === 'on';
  }).length;

  // Generate radial gradient based on light status (dark mode)
  const getLightGradient = () => {
    if (totalLights === 0) return 'transparent';

    const ratio = lightsOn / totalLights;

    if (ratio === 0) {
      // All lights off - dark surface
      return 'linear-gradient(135deg, #1a1a1a 0%, #141414 100%)';
    } else if (ratio === 1) {
      // All lights on - dramatic warm amber glow
      return 'radial-gradient(ellipse 150% 100% at top left, #8b6914 0%, #6b4f0f 25%, #4a3510 55%, #2d2110 80%, #1a1612 100%)';
    } else {
      // Partial - dramatic graduated glow
      const glowIntensity = ratio * 100;
      const brightness = 20 + (glowIntensity * 0.45); // Range from 20% to 65%
      const saturation = 50 + (glowIntensity * 0.35); // Range from 50% to 85%
      return `radial-gradient(ellipse 150% 100% at top left,
        hsl(38, ${saturation}%, ${brightness}%) 0%,
        hsl(38, ${saturation * 0.85}%, ${brightness * 0.65}%) 25%,
        hsl(38, ${saturation * 0.6}%, ${brightness * 0.45}%) 55%,
        hsl(38, ${saturation * 0.35}%, ${brightness * 0.3}%) 80%,
        #1a1612 100%)`;
    }
  };

  const getStateColor = () => {
    if (!power || power === 'off') return 'var(--gray-500)';
    return mode === 'heat' ? 'var(--heat)' : 'var(--cool)';
  };

  const getStateSymbol = () => {
    if (!power || power === 'off') return '○';
    return mode === 'heat' ? '▲' : '▼';
  };

  const getOpacity = () => {
    if (minutesSinceUpdate === null) return 1;
    if (minutesSinceUpdate < 10) return 1;
    if (minutesSinceUpdate < 60) return 0.85;
    if (minutesSinceUpdate < 180) return 0.7;
    return 0.6; // Minimum opacity increased for better legibility
  };

  return (
    <motion.div
      className={`room-row ${!hasHvac ? 'room-row--light-only' : ''} ${hasPendingChange ? 'room-row--pending' : ''}`}
      style={{
        background: getLightGradient(),
        opacity: getOpacity(),
      }}
      onClick={onClick}
      whileHover={{ scale: 1.005, y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Pending change indicator */}
      {hasPendingChange && (
        <motion.div
          className="room-row__pending-indicator"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="room-row__content">
        {/* HVAC Status Section */}
        {hasHvac && (
          <div className="room-row__hvac">
            <div className="room-row__state" style={{ color: getStateColor() }}>
              {getStateSymbol()}
            </div>

            <h3 className="room-row__name">{name}</h3>

            <div className="room-row__sparkline">
              <Sparkline data={sparklineData} width={80} height={24} />
            </div>

            <div className="room-row__temp">
              <span className="temp-value">{temp}</span>
              {target && (
                <span className="temp-target">{target}</span>
              )}
            </div>

            {/* Light status indicators - part of grid */}
            {totalLights > 0 && (
              <div className="room-row__lights">
                <div className="light-status-indicator__dots">
                  {lights.map((light, idx) => {
                    const displayState = light.pendingChange?.state ?? light.state;
                    const isOn = displayState === 'on';
                    return (
                      <motion.div
                        key={idx}
                        className={`light-dot ${isOn ? 'light-dot--on' : ''}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Name-only for light-only zones */}
        {!hasHvac && (
          <div className="room-row__name-only">
            <h3 className="room-row__name">{name}</h3>

            {/* Light status indicators for light-only zones */}
            {totalLights > 0 && (
              <div className="room-row__lights">
                <div className="light-status-indicator__dots">
                  {lights.map((light, idx) => {
                    const displayState = light.pendingChange?.state ?? light.state;
                    const isOn = displayState === 'on';
                    return (
                      <motion.div
                        key={idx}
                        className={`light-dot ${isOn ? 'light-dot--on' : ''}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
