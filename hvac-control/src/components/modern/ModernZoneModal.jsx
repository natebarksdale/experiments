import { useState } from 'react';
import './ModernZoneModal.css';

export default function ModernZoneModal({
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
  const { name, temperature, preferredState, defaultState, hasHvac, hasOverride, loop } = zone;
  const { power, mode, target } = preferredState || {};

  const [localPower, setLocalPower] = useState(power || 'off');
  const [localMode, setLocalMode] = useState(mode || 'heat');
  const [localTarget, setLocalTarget] = useState(target || 68);
  const [isUpdating, setIsUpdating] = useState(false);

  const temp = temperature !== null ? Math.round(temperature) : null;

  // Get current loop state info
  const getLoopState = () => {
    if (!loop || !allZones) return null;

    const loopZones = allZones.filter(z => z.loop === loop);
    const activeZones = loopZones.filter(z => {
      const effectivePower = z.pendingChange?.power ?? z.preferredState?.power ?? 'off';
      return effectivePower === 'on';
    });

    if (activeZones.length === 0) return null;

    // Determine the active mode
    const modes = activeZones.map(z => z.pendingChange?.mode ?? z.preferredState?.mode);
    const primaryMode = modes[0];

    return {
      loopNumber: loop,
      mode: primaryMode,
      activeZones: activeZones.map(z => z.name)
    };
  };

  const loopState = getLoopState();

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
    <div className="modern-modal-backdrop" onClick={onClose}>
      <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modern-modal__header">
          <div className="modern-modal__title-block">
            <h2 className="modern-modal__title">{name}</h2>
            {temp !== null && (
              <p className="modern-modal__subtitle">Current: {temp}°F</p>
            )}
          </div>
          <button onClick={onClose} className="modern-modal__close" aria-label="Close">
            <svg className="modern-modal__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loopState && (
          <div className="modern-loop-info">
            <div className="modern-loop-info__badge">
              <span className="modern-loop-info__label">Loop {loopState.loopNumber}</span>
              <span className={`modern-loop-info__mode modern-loop-info__mode--${loopState.mode}`}>
                {loopState.mode === 'heat' ? 'Heating' : 'Cooling'}
              </span>
            </div>
            <p className="modern-loop-info__zones">
              {loopState.activeZones.join(', ')} {loopState.activeZones.length === 1 ? 'is' : 'are'} on
            </p>
          </div>
        )}

        <div className="modern-modal__content">
          {hasHvac && (
            <section className="modern-modal__section">
              <h3 className="modern-modal__section-title">Climate Control</h3>

              <div
                className="modern-power-toggle"
                onClick={() => setLocalPower(localPower === 'on' ? 'off' : 'on')}
              >
                <span className="modern-power-toggle__label">Power</span>
                <div className={`modern-switch ${localPower === 'on' ? 'modern-switch--on' : ''}`}>
                  <div className="modern-switch__thumb" />
                </div>
              </div>

              {localPower === 'on' && (
                <>
                  <div className="modern-mode-selector">
                    <button
                      className={`modern-mode-btn modern-mode-btn--heat ${localMode === 'heat' ? 'modern-mode-btn--active' : ''}`}
                      onClick={() => setLocalMode('heat')}
                    >
                      <svg className="modern-mode-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2v10m0 0L8 8m4 4l4-4" />
                      </svg>
                      Heat
                    </button>
                    <button
                      className={`modern-mode-btn modern-mode-btn--cool ${localMode === 'cool' ? 'modern-mode-btn--active' : ''}`}
                      onClick={() => setLocalMode('cool')}
                    >
                      <svg className="modern-mode-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 22V12m0 0l-4 4m4-4l4 4" />
                      </svg>
                      Cool
                    </button>
                  </div>

                  <div className="modern-temp-stepper">
                    <button
                      className="modern-temp-stepper__btn"
                      onClick={() => setLocalTarget(Math.max(60, localTarget - 1))}
                    >
                      <svg className="modern-temp-stepper__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <div className="modern-temp-stepper__value">
                      <span className="modern-temp-stepper__number">{localTarget}</span>
                      <span className="modern-temp-stepper__unit">°F</span>
                    </div>
                    <button
                      className="modern-temp-stepper__btn"
                      onClick={() => setLocalTarget(Math.min(85, localTarget + 1))}
                    >
                      <svg className="modern-temp-stepper__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>

                  {conflictingZones.length > 0 && (
                    <div className="modern-warning">
                      <svg className="modern-warning__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div>
                        <p className="modern-warning__title">Conflict Warning</p>
                        <p className="modern-warning__message">
                          {conflictingZones.map(z => z.name).join(', ')} will be turned off
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {lights.length > 0 && (
            <section className="modern-modal__section">
              <h3 className="modern-modal__section-title">Lights</h3>
              <div className="modern-accessory-grid">
                {lights.map(light => {
                  const displayState = light.pendingChange?.state ?? light.state;
                  const isOn = displayState === 'on';

                  return (
                    <button
                      key={light.row}
                      className={`modern-accessory-btn ${isOn ? 'modern-accessory-btn--on' : ''}`}
                      onClick={() => onToggleLight(light.row, light.name)}
                    >
                      <svg className="modern-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        <circle cx="12" cy="12" r="5"/>
                      </svg>
                      <span className="modern-accessory-btn__label">{light.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {plugs.length > 0 && (
            <section className="modern-modal__section">
              <h3 className="modern-modal__section-title">Outlets</h3>
              <div className="modern-accessory-grid">
                {plugs.map(plug => {
                  const displayState = plug.pendingChange?.state ?? plug.state;
                  const isOn = displayState === 'on';

                  return (
                    <button
                      key={plug.id}
                      className={`modern-accessory-btn ${isOn ? 'modern-accessory-btn--on' : ''}`}
                      onClick={() => onTogglePlug(plug.id, plug.name)}
                    >
                      <svg className="modern-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="7" y="7" width="10" height="10" rx="2"/>
                        <path d="M9 3v4m6-4v4"/>
                      </svg>
                      <span className="modern-accessory-btn__label">{plug.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {locks.length > 0 && (
            <section className="modern-modal__section">
              <h3 className="modern-modal__section-title">Locks</h3>
              <div className="modern-accessory-grid">
                {locks.map(lock => {
                  const displayState = lock.pendingChange?.state ?? lock.state;
                  const isLocked = displayState === 'locked';

                  return (
                    <button
                      key={lock.id}
                      className={`modern-accessory-btn ${!isLocked ? 'modern-accessory-btn--on' : ''}`}
                      onClick={() => onToggleLock(lock.id, lock.name)}
                    >
                      <svg className="modern-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="5" y="11" width="14" height="10" rx="2"/>
                        <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                      </svg>
                      <span className="modern-accessory-btn__label">{lock.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {hasHvac && (
          <div className="modern-modal__footer">
            {hasOverride && defaultState && (
              <button
                onClick={handleRestore}
                className="modern-btn"
                disabled={isUpdating}
              >
                Restore
              </button>
            )}
            <button
              onClick={handleApply}
              className="modern-btn modern-btn--primary"
              disabled={isUpdating || (!hasChanges && !hasOverride)}
            >
              {isUpdating ? 'Applying...' : 'Apply'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
