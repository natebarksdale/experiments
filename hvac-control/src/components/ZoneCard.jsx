import { motion } from 'framer-motion';
import './ZoneCard.css';

export default function ZoneCard({ zone, onClick }) {
  const { name, temperature, minutesSinceUpdate, preferredState } = zone;
  const { power, mode, target } = preferredState || {};

  const isActive = power === 'on';
  const isStale = minutesSinceUpdate && minutesSinceUpdate > 30;

  // Determine color theme based on mode
  const getThemeClass = () => {
    if (!isActive) return 'zone-card--off';
    return mode === 'heat' ? 'zone-card--heat' : 'zone-card--cool';
  };

  // Temperature difference from target
  const tempDiff = target && temperature ? temperature - target : 0;

  return (
    <motion.div
      className={`zone-card ${getThemeClass()}`}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect when active */}
      {isActive && (
        <motion.div
          className="zone-card__glow"
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      <div className="zone-card__header">
        <h3 className="zone-card__name">{name}</h3>
        <div className="zone-card__status-badge">
          {isActive ? (
            <span className="mono">{mode}</span>
          ) : (
            <span className="mono">off</span>
          )}
        </div>
      </div>

      <div className="zone-card__temp-display">
        <motion.div
          className="zone-card__temp-value"
          key={temperature}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {temperature !== null ? (
            <>
              <span className="temp-number">{Math.round(temperature)}</span>
              <span className="temp-unit">°</span>
            </>
          ) : (
            <span className="temp-na">—</span>
          )}
        </motion.div>

        {target && isActive && (
          <div className="zone-card__target">
            <span className="mono">
              target: {target}°
            </span>
            {Math.abs(tempDiff) > 1 && (
              <span className={`temp-diff ${tempDiff > 0 ? 'temp-diff--above' : 'temp-diff--below'}`}>
                {tempDiff > 0 ? '+' : ''}{Math.round(tempDiff)}°
              </span>
            )}
          </div>
        )}
      </div>

      <div className="zone-card__footer">
        {minutesSinceUpdate !== null && (
          <span className={`zone-card__update-time mono ${isStale ? 'stale' : ''}`}>
            {isStale && '⚠ '}
            {minutesSinceUpdate}m ago
          </span>
        )}
        {isActive && (
          <div className="zone-card__indicator">
            <motion.div
              className="indicator-dot"
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
