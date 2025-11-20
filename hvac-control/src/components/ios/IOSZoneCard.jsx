import { motion } from 'framer-motion';
import { LOCK_CONFIG } from '../../services/sheets';
import './IOSZoneCard.css';

export default function IOSZoneCard({ zone, lights, plugs, locks, onClick }) {
  const { name, temperature, preferredState, hasHvac, hasOverride, pendingChange } = zone;
  const { power, mode, target } = preferredState || {};

  const temp = temperature !== null ? Math.round(temperature) : '—';
  const hasPending = !!pendingChange;

  // Calculate light/plug/lock counts
  const lightsOn = lights.filter(l => {
    const displayState = l.pendingChange?.state ?? l.state;
    return displayState === 'on';
  }).length;

  const plugsOn = plugs.filter(p => {
    const displayState = p.pendingChange?.state ?? p.state;
    return displayState === 'on';
  }).length;

  const locksUnlocked = locks.filter(l => {
    const displayState = l.pendingChange?.state ?? l.state;
    return displayState === 'unlocked';
  }).length;

  // Determine card accent color based on mode/state
  const getAccentColor = () => {
    if (!hasHvac) {
      if (lightsOn > 0 || plugsOn > 0) return 'var(--ios-yellow)';
      return null;
    }

    if (!power || power === 'off') return null;
    return mode === 'heat' ? 'var(--ios-orange)' : 'var(--ios-teal)';
  };

  const accentColor = getAccentColor();

  // Determine temperature delta and trend
  const delta = target && temperature ? Math.round(temperature - target) : null;

  return (
    <motion.div
      className={`ios-card ${hasPending ? 'ios-card--pending' : ''} ${hasOverride ? 'ios-card--override' : ''}`}
      style={{
        '--card-accent': accentColor || 'transparent',
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
    >
      {/* Pending Indicator */}
      {hasPending && (
        <motion.div
          className="ios-card__pending"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Card Header */}
      <div className="ios-card__header">
        <h3 className="ios-card__name">{name}</h3>
        {hasOverride && (
          <span className="ios-card__badge">Override</span>
        )}
      </div>

      {/* HVAC Display */}
      {hasHvac && (
        <div className="ios-card__hvac">
          <div className="ios-card__temp">
            <span className="ios-card__temp-value">{temp}</span>
            <span className="ios-card__temp-unit">°</span>
          </div>

          {power === 'on' && (
            <div className="ios-card__status">
              <div className={`ios-status-pill ios-status-pill--${mode}`}>
                <span className="ios-status-pill__icon">
                  {mode === 'heat' ? '▲' : '▼'}
                </span>
                <span className="ios-status-pill__text">
                  {mode === 'heat' ? 'Heating' : 'Cooling'} to {target}°
                </span>
              </div>

              {delta !== null && (
                <span className="ios-card__delta">
                  {delta > 0 ? `+${delta}°` : `${delta}°`}
                </span>
              )}
            </div>
          )}

          {power === 'off' && (
            <div className="ios-card__status">
              <div className="ios-status-pill ios-status-pill--off">
                <span className="ios-status-pill__icon">○</span>
                <span className="ios-status-pill__text">Off</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessories */}
      {(lights.length > 0 || plugs.length > 0 || locks.length > 0) && (
        <div className="ios-card__accessories">
          {/* Lights */}
          {lights.length > 0 && (
            <div className="ios-accessory">
              <svg className="ios-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                <circle cx="12" cy="12" r="5"/>
              </svg>
              <span className="ios-accessory__count">{lightsOn}/{lights.length}</span>
            </div>
          )}

          {/* Plugs */}
          {plugs.length > 0 && (
            <div className="ios-accessory">
              <svg className="ios-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="7" width="10" height="10" rx="2"/>
                <path d="M9 3v4m6-4v4"/>
              </svg>
              <span className="ios-accessory__count">{plugsOn}/{plugs.length}</span>
            </div>
          )}

          {/* Locks */}
          {locks.length > 0 && (
            <div className="ios-accessory">
              <svg className="ios-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
              </svg>
              <span className="ios-accessory__count">
                {locks.length - locksUnlocked}/{locks.length}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
