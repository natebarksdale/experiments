import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './IOSZoneModal.css';

export default function IOSZoneModal({
  zone,
  lights,
  plugs,
  locks,
  allZones,
  onClose,
  onUpdateZone,
  onRestoreDefault,
  onToggleLight,
  onTogglePlug,
  onToggleLock,
}) {
  const { name, temperature, preferredState, defaultState, hasHvac, hasOverride } = zone;
  const { power, mode, target } = preferredState || {};

  const [localPower, setLocalPower] = useState(power || 'off');
  const [localMode, setLocalMode] = useState(mode || 'heat');
  const [localTarget, setLocalTarget] = useState(target || 68);
  const [isUpdating, setIsUpdating] = useState(false);

  const temp = temperature !== null ? Math.round(temperature) : null;

  // Check for conflicting zones
  const getConflictingZones = () => {
    if (!hasHvac || localPower === 'off') return [];

    return allZones
      .filter(z => z.id !== zone.id && z.floor === zone.floor && z.preferredState?.power === 'on')
      .filter(z => {
        const sameMode = z.preferredState?.mode === localMode;
        return !sameMode;
      });
  };

  const conflictingZones = getConflictingZones();

  const handleApply = async () => {
    setIsUpdating(true);
    try {
      const settings = {
        power: localPower,
        mode: localMode,
        target: localTarget,
      };

      if (conflictingZones.length > 0) {
        settings.conflictingZones = conflictingZones.map(z => z.id);
      }

      await onUpdateZone(zone.id, settings);
      setTimeout(onClose, 300);
    } catch (error) {
      console.error('Error updating zone:', error);
      alert('Failed to update zone. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestore = async () => {
    setIsUpdating(true);
    try {
      await onRestoreDefault(zone.id);
      setTimeout(onClose, 300);
    } catch (error) {
      console.error('Error restoring default:', error);
      alert('Failed to restore default. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges =
    localPower !== (power || 'off') ||
    localMode !== (mode || 'heat') ||
    localTarget !== (target || 68);

  return (
    <AnimatePresence>
      <motion.div
        className="ios-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="ios-modal"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="ios-modal__handle" />

          {/* Header */}
          <div className="ios-modal__header">
            <div>
              <h2 className="ios-modal__title">{name}</h2>
              {temp !== null && (
                <p className="ios-modal__subtitle">
                  Current: {temp}°
                </p>
              )}
            </div>
            <button onClick={onClose} className="ios-btn ios-btn--icon" aria-label="Close">
              <svg className="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="ios-modal__content">
            {/* HVAC Controls */}
            {hasHvac && (
              <section className="ios-modal__section">
                <h3 className="ios-modal__section-title">Climate Control</h3>

                {/* Power Toggle */}
                <div className="ios-control-group">
                  <label className="ios-toggle-row">
                    <span className="ios-toggle-row__label">Power</span>
                    <button
                      className={`ios-toggle ${localPower === 'on' ? 'ios-toggle--on' : ''}`}
                      onClick={() => setLocalPower(localPower === 'on' ? 'off' : 'on')}
                    >
                      <span className="ios-toggle__thumb" />
                    </button>
                  </label>
                </div>

                {localPower === 'on' && (
                  <>
                    {/* Mode Selector */}
                    <div className="ios-control-group">
                      <label className="ios-control-group__label">Mode</label>
                      <div className="ios-segmented">
                        <button
                          className={`ios-segmented__option ${localMode === 'heat' ? 'ios-segmented__option--active' : ''}`}
                          onClick={() => setLocalMode('heat')}
                        >
                          <svg className="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v10m0 0L8 8m4 4l4-4" />
                          </svg>
                          Heat
                        </button>
                        <button
                          className={`ios-segmented__option ${localMode === 'cool' ? 'ios-segmented__option--active' : ''}`}
                          onClick={() => setLocalMode('cool')}
                        >
                          <svg className="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22V12m0 0l-4 4m4-4l4 4" />
                          </svg>
                          Cool
                        </button>
                      </div>
                    </div>

                    {/* Temperature Stepper */}
                    <div className="ios-control-group">
                      <label className="ios-control-group__label">Target Temperature</label>
                      <div className="ios-stepper">
                        <button
                          className="ios-stepper__btn"
                          onClick={() => setLocalTarget(Math.max(60, localTarget - 1))}
                        >
                          <svg className="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                        <div className="ios-stepper__value">
                          <span className="ios-stepper__number">{localTarget}</span>
                          <span className="ios-stepper__unit">°F</span>
                        </div>
                        <button
                          className="ios-stepper__btn"
                          onClick={() => setLocalTarget(Math.min(85, localTarget + 1))}
                        >
                          <svg className="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Conflict Warning */}
                    {conflictingZones.length > 0 && (
                      <div className="ios-warning">
                        <svg className="ios-warning__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                          <p className="ios-warning__title">Conflicting Zones</p>
                          <p className="ios-warning__message">
                            {conflictingZones.map(z => z.name).join(', ')} will be turned off
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* Lights */}
            {lights.length > 0 && (
              <section className="ios-modal__section">
                <h3 className="ios-modal__section-title">Lights</h3>
                <div className="ios-accessory-grid">
                  {lights.map(light => {
                    const displayState = light.pendingChange?.state ?? light.state;
                    const isOn = displayState === 'on';

                    return (
                      <button
                        key={light.row}
                        className={`ios-accessory-btn ${isOn ? 'ios-accessory-btn--on' : ''}`}
                        onClick={() => onToggleLight(light.row, light.name)}
                      >
                        <svg className="ios-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                          <circle cx="12" cy="12" r="5"/>
                        </svg>
                        <span className="ios-accessory-btn__label">{light.name}</span>
                        {light.pendingChange && (
                          <span className="ios-accessory-btn__pending" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Plugs */}
            {plugs.length > 0 && (
              <section className="ios-modal__section">
                <h3 className="ios-modal__section-title">Outlets</h3>
                <div className="ios-accessory-grid">
                  {plugs.map(plug => {
                    const displayState = plug.pendingChange?.state ?? plug.state;
                    const isOn = displayState === 'on';

                    return (
                      <button
                        key={plug.id}
                        className={`ios-accessory-btn ${isOn ? 'ios-accessory-btn--on' : ''}`}
                        onClick={() => onTogglePlug(plug.id, plug.name)}
                      >
                        <svg className="ios-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="7" y="7" width="10" height="10" rx="2"/>
                          <path d="M9 3v4m6-4v4"/>
                        </svg>
                        <span className="ios-accessory-btn__label">{plug.name}</span>
                        {plug.pendingChange && (
                          <span className="ios-accessory-btn__pending" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Locks */}
            {locks.length > 0 && (
              <section className="ios-modal__section">
                <h3 className="ios-modal__section-title">Locks</h3>
                <div className="ios-accessory-grid">
                  {locks.map(lock => {
                    const displayState = lock.pendingChange?.state ?? lock.state;
                    const isLocked = displayState === 'locked';

                    return (
                      <button
                        key={lock.id}
                        className={`ios-accessory-btn ${!isLocked ? 'ios-accessory-btn--on' : ''}`}
                        onClick={() => onToggleLock(lock.id, lock.name)}
                      >
                        <svg className="ios-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="11" width="14" height="10" rx="2"/>
                          <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                          <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                        </svg>
                        <span className="ios-accessory-btn__label">{lock.name}</span>
                        {lock.pendingChange && (
                          <span className="ios-accessory-btn__pending" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Footer Actions */}
          {hasHvac && (
            <div className="ios-modal__footer">
              {hasOverride && defaultState && (
                <button
                  onClick={handleRestore}
                  className="ios-btn ios-btn--text"
                  disabled={isUpdating}
                >
                  Restore Default
                </button>
              )}
              <button
                onClick={handleApply}
                className="ios-btn ios-btn--primary"
                disabled={isUpdating || (!hasChanges && !hasOverride)}
              >
                {isUpdating ? (
                  <>
                    <svg className="ios-icon ios-icon--spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Applying...
                  </>
                ) : (
                  'Apply Changes'
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
