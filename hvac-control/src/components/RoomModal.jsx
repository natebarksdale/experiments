import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import './RoomModal.css';

/**
 * RoomModal - Detailed room control interface
 * Opens as a modal overlay for comprehensive room management
 */
export default function RoomModal({ zone, lights, onClose, onUpdateZone, onToggleLight }) {
  const { name, temperature, preferredState, hasHvac, pendingChange } = zone;
  const { power, mode, target } = preferredState || {};
  const [, forceUpdate] = useState(0);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Update timer every second when there's a pending change
  useEffect(() => {
    if (!pendingChange) return;

    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingChange]);

  const handlePowerMode = (newPower, newMode) => {
    if (!hasHvac) return;
    onUpdateZone(zone.id, { power: newPower, mode: newMode });
  };

  const temp = temperature !== null ? Math.round(temperature) : '—';

  // Format time elapsed since request
  const getTimeSinceRequest = () => {
    if (!pendingChange?.requestedAt) return null;
    const now = new Date();
    const requested = new Date(pendingChange.requestedAt);
    const seconds = Math.floor((now - requested) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

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

          {/* HVAC Controls */}
          {hasHvac && (
            <section className="room-modal__section">
              <h3 className="room-modal__section-title">Climate</h3>

              {/* Pending Change Banner */}
              {pendingChange && (
                <motion.div
                  className="pending-banner"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="pending-banner__icon">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      ⟳
                    </motion.div>
                  </div>
                  <div className="pending-banner__content">
                    <div className="pending-banner__title">Update Pending</div>
                    <div className="pending-banner__details">
                      Requested: {pendingChange.power === 'on' ? 'On' : 'Off'}
                      {pendingChange.power === 'on' && ` · ${pendingChange.mode === 'heat' ? 'Heat' : 'Cool'}`}
                      {' · '}{getTimeSinceRequest()}
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="room-modal__climate-display">
                <div className="climate-current">
                  <span className="climate-label">Current</span>
                  <div className="climate-temp">
                    <span className="climate-temp__value">{temp}</span>
                    <span className="climate-temp__unit">°</span>
                  </div>
                </div>

                {target && (
                  <div className="climate-target">
                    <span className="climate-label">Target</span>
                    <div className="climate-temp">
                      <span className="climate-temp__value">{target}</span>
                      <span className="climate-temp__unit">°</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="room-modal__hvac-controls">
                <button
                  className={`hvac-control-btn hvac-control-btn--off ${power === 'off' ? 'active' : ''}`}
                  onClick={() => handlePowerMode('off', mode)}
                >
                  <span className="hvac-control-btn__icon">○</span>
                  <span className="hvac-control-btn__label">Off</span>
                </button>

                <button
                  className={`hvac-control-btn hvac-control-btn--heat ${power === 'on' && mode === 'heat' ? 'active' : ''}`}
                  onClick={() => handlePowerMode('on', 'heat')}
                >
                  <span className="hvac-control-btn__icon">▲</span>
                  <span className="hvac-control-btn__label">Heat</span>
                </button>

                <button
                  className={`hvac-control-btn hvac-control-btn--cool ${power === 'on' && mode === 'cool' ? 'active' : ''}`}
                  onClick={() => handlePowerMode('on', 'cool')}
                >
                  <span className="hvac-control-btn__icon">▼</span>
                  <span className="hvac-control-btn__label">Cool</span>
                </button>
              </div>
            </section>
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

          {/* Empty state for rooms with no controls */}
          {!hasHvac && lights.length === 0 && (
            <div className="room-modal__empty">
              <p>No controls available for this room</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
