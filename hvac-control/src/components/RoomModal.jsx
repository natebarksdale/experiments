import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LOCK_CONFIG } from '../services/sheets';
import { LockedIcon, UnlockedIcon } from './LockIcon';
import './RoomModal.css';

/**
 * RoomModal - Detailed room control interface
 * Opens as a modal overlay for comprehensive room management
 */
export default function RoomModal({ zone, lights, plugs = [], locks = [], allZones, logs = [], onClose, onUpdateZone, onRestoreDefault, onToggleLight, onTogglePlug, onToggleLock }) {
  const { name, temperature, preferredState, defaultState, hasHvac, pendingChange, hasOverride, loop } = zone;
  const { power: currentPower, mode: currentMode, target: currentTarget } = preferredState || {};
  const { power: defaultPower, mode: defaultMode, target: defaultTarget } = defaultState || {};

  // Proposed state (initialized to current state)
  const [proposedPower, setProposedPower] = useState(currentPower || 'off');
  const [proposedMode, setProposedMode] = useState(currentMode || 'heat');
  const [proposedTarget, setProposedTarget] = useState(currentTarget || 68);

  // Request status tracking
  const [requestStatus, setRequestStatus] = useState(null);
  const [, forceUpdate] = useState(0);

  // Check if proposed state differs from current
  const hasChanges = proposedPower !== currentPower ||
    (proposedPower === 'on' && (proposedMode !== currentMode || proposedTarget !== currentTarget));

  // Check if proposed/current state differs from default
  const isDifferentFromDefault = defaultState && (
    proposedPower !== defaultPower ||
    (proposedPower === 'on' && (proposedMode !== defaultMode || proposedTarget !== defaultTarget))
  );

  const handleRestoreDefault = async () => {
    setProposedPower(defaultPower || 'off');
    setProposedMode(defaultMode || 'heat');
    setProposedTarget(defaultTarget || 68);
  };

  // Check for loop conflicts
  const getLoopConflicts = () => {
    if (!loop || !allZones || proposedPower !== 'on') return [];

    return allZones.filter(z => {
      if (z.loop !== loop || z.id === zone.id) return false;

      // Check the effective state (pending takes precedence)
      const effectivePower = z.pendingChange?.power ?? z.preferredState?.power ?? 'off';
      const effectiveMode = z.pendingChange?.mode ?? z.preferredState?.mode ?? 'heat';

      // Conflict if zone is on with different mode
      return effectivePower === 'on' && effectiveMode !== proposedMode;
    });
  };

  const loopConflicts = getLoopConflicts();

  // Get current loop state info
  const getLoopState = () => {
    if (!loop || !allZones) return null;

    const loopZones = allZones.filter(z => z.loop === loop);
    const activeZones = loopZones.filter(z => {
      const effectivePower = z.pendingChange?.power ?? z.preferredState?.power ?? 'off';
      return effectivePower === 'on';
    });

    if (activeZones.length === 0) return null;

    // Determine the active mode (should all be the same if properly balanced)
    const modes = activeZones.map(z => z.pendingChange?.mode ?? z.preferredState?.mode);
    const primaryMode = modes[0];

    return {
      loopNumber: loop,
      mode: primaryMode,
      activeZones: activeZones.map(z => z.name)
    };
  };

  const loopState = getLoopState();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Update timer every second when there's a pending change or active request
  useEffect(() => {
    if (!pendingChange && !requestStatus) return;

    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingChange, requestStatus]);

  // Reset proposed state when current state changes
  useEffect(() => {
    setProposedPower(currentPower || 'off');
    setProposedMode(currentMode || 'heat');
    setProposedTarget(currentTarget || 68);
  }, [currentPower, currentMode, currentTarget]);

  const handleSubmit = async () => {
    if (!hasHvac || !hasChanges) return;

    setRequestStatus({
      sending: true,
      error: null,
    });

    try {
      // Call the update function with conflict info
      await onUpdateZone(zone.id, {
        power: proposedPower,
        mode: proposedMode,
        target: proposedTarget,
        conflictingZones: loopConflicts.map(z => z.id),
      });

      // Show brief confirmation then close
      setRequestStatus({
        sending: false,
        success: true,
        error: null,
      });

      // Close modal after brief delay to show confirmation
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      setRequestStatus({
        sending: false,
        success: false,
        error: error.message,
      });
    }
  };

  const handleRestoreAndSubmit = async () => {
    setRequestStatus({
      sending: true,
      error: null,
    });

    try {
      // Call restore default which clears the override
      await onRestoreDefault(zone.id);

      // Show brief confirmation then close
      setRequestStatus({
        sending: false,
        success: true,
        error: null,
      });

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      setRequestStatus({
        sending: false,
        success: false,
        error: error.message,
      });
    }
  };

  const handleTempChange = (delta) => {
    setProposedTarget(prev => Math.max(60, Math.min(85, prev + delta)));
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  };

  const temp = temperature !== null ? Math.round(temperature) : '—';

  return (
    <AnimatePresence>
      <motion.div
        className="room-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="room-modal"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="room-modal__header">
            <h2 className="room-modal__title">{name}</h2>
            <button
              className="room-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Loop State Info */}
          {loopState && (
            <div className="room-modal__loop-info">
              <div className="loop-info-badge">
                <span className="loop-info-badge__label">Loop {loopState.loopNumber}</span>
                <span className={`loop-info-badge__mode loop-info-badge__mode--${loopState.mode}`}>
                  {loopState.mode === 'heat' ? '▲ Heating' : '▼ Cooling'}
                </span>
              </div>
              <div className="loop-info-zones">
                {loopState.activeZones.join(', ')} {loopState.activeZones.length === 1 ? 'is' : 'are'} on
              </div>
            </div>
          )}

          {/* Light Controls */}
          {lights.length > 0 && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Lighting</h3>

              <div className="room-modal__lights-grid">
                {lights.map((light) => {
                  const displayState = light.pendingChange?.state ?? light.state;
                  const isOn = displayState === 'on';
                  const isPending = !!light.pendingChange;

                  return (
                    <motion.button
                      key={light.row}
                      className={`light-control-btn ${isOn ? 'light-control-btn--on' : ''} ${isPending ? 'light-control-btn--pending' : ''}`}
                      onClick={() => onToggleLight(light.row, light.name)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isPending && (
                        <motion.div
                          className="light-control-btn__pending"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      <div className="light-control-btn__icon">
                        {isOn ? '💡' : '○'}
                      </div>
                      <div className="light-control-btn__name">
                        {light.name}
                      </div>
                      <div className="light-control-btn__state">
                        {isOn ? 'On' : 'Off'}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Plug Controls */}
          {plugs.length > 0 && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Plugs</h3>

              <div className="room-modal__lights-grid">
                {plugs.map((plug) => {
                  const displayState = plug.pendingChange?.state ?? plug.state;
                  const isOn = displayState === 'on';
                  const isPending = !!plug.pendingChange;

                  return (
                    <motion.button
                      key={plug.id}
                      className={`plug-control-btn ${isOn ? 'plug-control-btn--on' : ''} ${isPending ? 'plug-control-btn--pending' : ''}`}
                      onClick={() => onTogglePlug(plug.id, plug.name)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isPending && (
                        <motion.div
                          className="plug-control-btn__pending"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      <div className="plug-control-btn__icon">
                        {isOn ? '🔌' : '○'}
                      </div>
                      <div className="plug-control-btn__name">
                        {plug.name}
                      </div>
                      <div className="plug-control-btn__state">
                        {isOn ? 'On' : 'Off'}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Lock Controls */}
          {locks.length > 0 && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Locks</h3>

              <div className="room-modal__lights-grid">
                {locks.map((lock) => {
                  const displayState = lock.pendingChange?.state ?? lock.state;
                  const isUnlocked = displayState === 'unlocked';
                  const isPending = !!lock.pendingChange;
                  const lockConfig = LOCK_CONFIG[lock.id];
                  const isCloseOnly = lockConfig?.closeOnly;

                  // For close-only locks, disable if already closed
                  const isDisabled = isCloseOnly && !isUnlocked;

                  return (
                    <motion.button
                      key={lock.id}
                      className={`lock-control-btn ${isUnlocked ? 'lock-control-btn--unlocked' : ''} ${isPending ? 'lock-control-btn--pending' : ''} ${isDisabled ? 'lock-control-btn--disabled' : ''}`}
                      onClick={() => onToggleLock(lock.id, lock.name)}
                      disabled={isDisabled}
                      whileHover={!isDisabled ? { scale: 1.02 } : {}}
                      whileTap={!isDisabled ? { scale: 0.98 } : {}}
                    >
                      {isPending && (
                        <motion.div
                          className="lock-control-btn__pending"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      <div className="lock-control-btn__icon">
                        {isUnlocked ? <UnlockedIcon size={24} /> : <LockedIcon size={24} />}
                      </div>
                      <div className="lock-control-btn__name">
                        {lock.name}
                      </div>
                      <div className="lock-control-btn__state">
                        {isCloseOnly ? (
                          isUnlocked ? 'Open' : 'Closed'
                        ) : (
                          isUnlocked ? 'Unlocked' : 'Locked'
                        )}
                      </div>
                      {isCloseOnly && (
                        <div className="lock-control-btn__action">
                          {isUnlocked ? 'Close' : 'Close-Only'}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {/* HVAC Controls */}
          {hasHvac && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Current State</h3>

              <div className="room-modal__current-state">
                <div className="current-state__temps">
                  <div className="climate-current">
                    <span className="climate-label">Current</span>
                    <div className="climate-temp">
                      <span className="climate-temp__value">{temp}</span>
                      <span className="climate-temp__unit">°</span>
                    </div>
                  </div>

                  {currentTarget && (
                    <div className="climate-target">
                      <span className="climate-label">Target</span>
                      <div className="climate-temp">
                        <span className="climate-temp__value">{currentTarget}</span>
                        <span className="climate-temp__unit">°</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="current-state__mode">
                  <span className="climate-label">Status</span>
                  <div className="current-state__status">
                    {currentPower === 'on' ? (
                      <span className={`status-badge status-badge--${currentMode}`}>
                        {currentMode === 'heat' ? '▲ Heating' : '▼ Cooling'}
                      </span>
                    ) : (
                      <span className="status-badge status-badge--off">○ Off</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Proposed Changes */}
          {hasHvac && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Adjust Settings</h3>

              <div className="room-modal__proposed">
                {/* Power/Mode Selection */}
                <div className="proposed__controls">
                  <button
                    className={`hvac-control-btn hvac-control-btn--off ${proposedPower === 'off' ? 'active' : ''}`}
                    onClick={() => setProposedPower('off')}
                  >
                    <span className="hvac-control-btn__icon">○</span>
                    <span className="hvac-control-btn__label">Off</span>
                  </button>

                  <button
                    className={`hvac-control-btn hvac-control-btn--heat ${proposedPower === 'on' && proposedMode === 'heat' ? 'active' : ''}`}
                    onClick={() => { setProposedPower('on'); setProposedMode('heat'); }}
                  >
                    <span className="hvac-control-btn__icon">▲</span>
                    <span className="hvac-control-btn__label">Heat</span>
                  </button>

                  <button
                    className={`hvac-control-btn hvac-control-btn--cool ${proposedPower === 'on' && proposedMode === 'cool' ? 'active' : ''}`}
                    onClick={() => { setProposedPower('on'); setProposedMode('cool'); }}
                  >
                    <span className="hvac-control-btn__icon">▼</span>
                    <span className="hvac-control-btn__label">Cool</span>
                  </button>
                </div>

                {/* Temperature Adjustment */}
                <div className={`proposed__temp ${proposedPower === 'off' ? 'proposed__temp--disabled' : ''}`}>
                  <span className="climate-label">Target Temp</span>
                  <div className="temp-adjuster">
                    <button
                      className="temp-adjuster__btn"
                      onClick={() => handleTempChange(-1)}
                      disabled={proposedPower === 'off'}
                    >
                      −
                    </button>
                    <span className="temp-adjuster__value">{proposedTarget}°</span>
                    <button
                      className="temp-adjuster__btn"
                      onClick={() => handleTempChange(1)}
                      disabled={proposedPower === 'off'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Loop conflict warning */}
                {loopConflicts.length > 0 && (
                  <div className="loop-conflict-warning">
                    <div className="loop-conflict-warning__icon">⚠</div>
                    <div className="loop-conflict-warning__content">
                      <div className="loop-conflict-warning__title">Loop Conflict</div>
                      <div className="loop-conflict-warning__message">
                        {loopConflicts.map(z => z.name).join(', ')} {loopConflicts.length === 1 ? 'is' : 'are'} currently running in {loopConflicts[0]?.preferredState?.mode || 'different'} mode.
                        Applying this change will turn {loopConflicts.length === 1 ? 'it' : 'them'} off.
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  className={`proposed__submit ${hasChanges ? 'proposed__submit--active' : ''} ${requestStatus?.success ? 'proposed__submit--success' : ''}`}
                  onClick={handleSubmit}
                  disabled={!hasChanges || requestStatus?.sending || requestStatus?.success}
                >
                  {requestStatus?.sending ? 'Sending...' :
                   requestStatus?.success ? '✓ Sent' :
                   hasChanges ? (loopConflicts.length > 0 ? 'Apply & Resolve Conflicts' : 'Apply Changes') : 'No Changes'}
                </button>

                {/* Error message */}
                {requestStatus?.error && (
                  <div className="proposed__error">
                    Error: {requestStatus.error}
                  </div>
                )}

                {/* Default state info with restore button */}
                {isDifferentFromDefault && defaultState && (
                  <div className="default-state-box">
                    <div className="default-state-box__info">
                      <span className="default-state-box__label">Default:</span>
                      <span className="default-state-box__value">
                        {defaultPower === 'on'
                          ? `${defaultMode}, ${defaultTarget}°`
                          : 'Off'
                        }
                      </span>
                    </div>
                    <button
                      className="default-state-box__restore"
                      onClick={handleRestoreAndSubmit}
                      disabled={requestStatus?.sending || requestStatus?.success}
                    >
                      {requestStatus?.sending ? '...' : 'Restore'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Empty state for rooms with no controls */}
          {!hasHvac && lights.length === 0 && plugs.length === 0 && locks.length === 0 && (
            <div className="room-modal__empty">
              <p>No controls available for this room</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
