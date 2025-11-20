import { useState } from 'react';
import './VictorianZoneModal.css';

export default function VictorianZoneModal({
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
    <div className="victorian-modal-backdrop" onClick={onClose}>
      <div className="victorian-modal" onClick={(e) => e.stopPropagation()}>
        <div className="victorian-modal__header">
          <div className="victorian-modal__title-block">
            <h2 className="victorian-modal__title">{name}</h2>
            {temp !== null && (
              <p className="victorian-modal__subtitle">Current: {temp}°F</p>
            )}
          </div>
          <button onClick={onClose} className="victorian-modal__close" aria-label="Close">
            <svg className="victorian-modal__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="victorian-modal__content">
          {hasHvac && (
            <section className="victorian-modal__section">
              <h3 className="victorian-modal__section-title">Climate Control</h3>

              <div
                className="victorian-power-toggle"
                onClick={() => setLocalPower(localPower === 'on' ? 'off' : 'on')}
              >
                <span className="victorian-power-toggle__label">Power</span>
                <div className={`victorian-switch ${localPower === 'on' ? 'victorian-switch--on' : ''}`}>
                  <div className="victorian-switch__thumb" />
                </div>
              </div>

              {localPower === 'on' && (
                <>
                  <div className="victorian-mode-selector">
                    <button
                      className={`victorian-mode-btn victorian-mode-btn--heat ${localMode === 'heat' ? 'victorian-mode-btn--active' : ''}`}
                      onClick={() => setLocalMode('heat')}
                    >
                      <svg className="victorian-mode-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2v10m0 0L8 8m4 4l4-4" />
                      </svg>
                      Heat
                    </button>
                    <button
                      className={`victorian-mode-btn victorian-mode-btn--cool ${localMode === 'cool' ? 'victorian-mode-btn--active' : ''}`}
                      onClick={() => setLocalMode('cool')}
                    >
                      <svg className="victorian-mode-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 22V12m0 0l-4 4m4-4l4 4" />
                      </svg>
                      Cool
                    </button>
                  </div>

                  <div className="victorian-temp-stepper">
                    <button
                      className="victorian-temp-stepper__btn"
                      onClick={() => setLocalTarget(Math.max(60, localTarget - 1))}
                    >
                      <svg className="victorian-temp-stepper__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <div className="victorian-temp-stepper__value">
                      <span className="victorian-temp-stepper__number">{localTarget}</span>
                      <span className="victorian-temp-stepper__unit">°F</span>
                    </div>
                    <button
                      className="victorian-temp-stepper__btn"
                      onClick={() => setLocalTarget(Math.min(85, localTarget + 1))}
                    >
                      <svg className="victorian-temp-stepper__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>

                  {conflictingZones.length > 0 && (
                    <div className="victorian-warning">
                      <svg className="victorian-warning__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div>
                        <p className="victorian-warning__title">Conflict Warning</p>
                        <p className="victorian-warning__message">
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
            <section className="victorian-modal__section">
              <h3 className="victorian-modal__section-title">Lights</h3>
              <div className="victorian-accessory-grid">
                {lights.map(light => {
                  const displayState = light.pendingChange?.state ?? light.state;
                  const isOn = displayState === 'on';

                  return (
                    <button
                      key={light.row}
                      className={`victorian-accessory-btn ${isOn ? 'victorian-accessory-btn--on' : ''}`}
                      onClick={() => onToggleLight(light.row, light.name)}
                    >
                      <svg className="victorian-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        <circle cx="12" cy="12" r="5"/>
                      </svg>
                      <span className="victorian-accessory-btn__label">{light.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {plugs.length > 0 && (
            <section className="victorian-modal__section">
              <h3 className="victorian-modal__section-title">Outlets</h3>
              <div className="victorian-accessory-grid">
                {plugs.map(plug => {
                  const displayState = plug.pendingChange?.state ?? plug.state;
                  const isOn = displayState === 'on';

                  return (
                    <button
                      key={plug.id}
                      className={`victorian-accessory-btn ${isOn ? 'victorian-accessory-btn--on' : ''}`}
                      onClick={() => onTogglePlug(plug.id, plug.name)}
                    >
                      <svg className="victorian-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="7" y="7" width="10" height="10" rx="2"/>
                        <path d="M9 3v4m6-4v4"/>
                      </svg>
                      <span className="victorian-accessory-btn__label">{plug.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {locks.length > 0 && (
            <section className="victorian-modal__section">
              <h3 className="victorian-modal__section-title">Locks</h3>
              <div className="victorian-accessory-grid">
                {locks.map(lock => {
                  const displayState = lock.pendingChange?.state ?? lock.state;
                  const isLocked = displayState === 'locked';

                  return (
                    <button
                      key={lock.id}
                      className={`victorian-accessory-btn ${!isLocked ? 'victorian-accessory-btn--on' : ''}`}
                      onClick={() => onToggleLock(lock.id, lock.name)}
                    >
                      <svg className="victorian-accessory-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="5" y="11" width="14" height="10" rx="2"/>
                        <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                      </svg>
                      <span className="victorian-accessory-btn__label">{lock.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {hasHvac && (
          <div className="victorian-modal__footer">
            {hasOverride && defaultState && (
              <button
                onClick={handleRestore}
                className="victorian-btn"
                disabled={isUpdating}
              >
                Restore
              </button>
            )}
            <button
              onClick={handleApply}
              className="victorian-btn victorian-btn--primary"
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
