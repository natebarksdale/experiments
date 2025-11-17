import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ControlPanel.css';

const formatTimeSince = (timestamp) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  return `${diffHr} hours ago`;
};

export default function ControlPanel({ zone, allZones, lights, onClose, onUpdate, onToggleLight }) {
  const [power, setPower] = useState(zone.preferredState?.power || 'off');
  const [mode, setMode] = useState(zone.preferredState?.mode || 'heat');
  const [hasChanges, setHasChanges] = useState(false);

  // Check for loop conflicts
  const getLoopConflict = () => {
    if (!zone.loop || !allZones) return null;

    // Find other zones in the same loop
    const loopZones = allZones.filter(z =>
      z.loop === zone.loop &&
      z.id !== zone.id
    );

    if (loopZones.length === 0) return null;

    // Check each zone's effective state (pending change takes precedence over current state)
    const conflictingZones = loopZones.filter(z => {
      // Determine what this zone's effective state will be
      const effectivePower = z.pendingChange?.power ?? z.preferredState?.power ?? 'off';
      const effectiveMode = z.pendingChange?.mode ?? z.preferredState?.mode ?? 'heat';

      // Only consider it a conflict if the zone is/will be on and has a different mode
      return effectivePower === 'on' && effectiveMode !== mode;
    });

    if (conflictingZones.length === 0) return null;

    // Get the mode of the first conflicting zone
    const firstConflict = conflictingZones[0];
    const conflictMode = firstConflict.pendingChange?.mode ?? firstConflict.preferredState?.mode ?? 'heat';

    return {
      zones: conflictingZones,
      currentMode: conflictMode,
    };
  };

  const loopConflict = power === 'on' ? getLoopConflict() : null;

  // Get lights for this zone
  const zoneLights = zone.lights?.map(lightDef => {
    const lightData = lights?.find(l => l.row === lightDef.row);
    return {
      ...lightDef,
      state: lightData?.state || 'off',
      pendingChange: lightData?.pendingChange,
    };
  }) || [];

  const handlePowerToggle = () => {
    setPower(prev => prev === 'on' ? 'off' : 'on');
    setHasChanges(true);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(zone.id, { power, mode });
    }
    setHasChanges(false);
  };

  const handleCancel = () => {
    setPower(zone.preferredState?.power || 'off');
    setMode(zone.preferredState?.mode || 'heat');
    setHasChanges(false);
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="control-panel-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCancel}
      >
        <motion.div
          className="control-panel"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="control-panel__header">
            <h2>{zone.name}</h2>
            <button className="control-panel__close" onClick={handleCancel}>
              ✕
            </button>
          </div>

          <div className="control-panel__content">
            {/* Pending change notice */}
            {zone.pendingChange && (
              <div className="control-panel__pending">
                <span className="pending-icon">⏳</span>
                <div className="pending-details">
                  <div className="pending-title">Change Pending</div>
                  <div className="pending-info">
                    Requested {formatTimeSince(zone.pendingChange.requestedAt)}
                  </div>
                  <div className="pending-request">
                    {zone.pendingChange.power} / {zone.pendingChange.mode}
                  </div>
                </div>
              </div>
            )}

            {/* Current status - only show for HVAC zones */}
            {zone.hasHvac && (
              <div className="control-panel__status">
                <div className="status-item">
                  <span className="status-label">Current Temp</span>
                  <span className="status-value">
                    {zone.temperature !== null ? `${Math.round(zone.temperature)}°` : '—'}
                  </span>
                </div>
                {zone.preferredState?.target && (
                  <div className="status-item">
                    <span className="status-label">Target</span>
                    <span className="status-value">
                      {zone.preferredState.target}°
                    </span>
                  </div>
                )}
                <div className="status-item">
                  <span className="status-label">Current State</span>
                  <span className="status-value status-value--compact">
                    {zone.preferredState?.power || 'off'} / {zone.preferredState?.mode || 'heat'}
                  </span>
                </div>
              </div>
            )}

            {/* Loop conflict warning */}
            {loopConflict && (
              <div className="control-panel__warning">
                <span className="warning-icon">⚠</span>
                <div className="warning-details">
                  <div className="warning-title">Loop Conflict</div>
                  <div className="warning-info">
                    {loopConflict.zones.map(z => z.name).join(', ')} {loopConflict.zones.length === 1 ? 'is' : 'are'} running in {loopConflict.currentMode} mode on this loop
                  </div>
                </div>
              </div>
            )}

            {/* HVAC controls - only show for HVAC zones */}
            {zone.hasHvac && (
              <>
                {/* Power control */}
                <div className="control-panel__section">
                  <label className="control-label">Power</label>
                  <button
                    className={`power-toggle ${power === 'on' ? 'power-toggle--on' : ''}`}
                    onClick={handlePowerToggle}
                  >
                    <motion.div
                      className="power-toggle__slider"
                      layout
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                    <span className="power-toggle__label mono">
                      {power === 'on' ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {/* Mode control */}
                <div className="control-panel__section">
                  <label className="control-label">Mode</label>
                  <div className="mode-selector">
                    <button
                      className={`mode-button ${mode === 'heat' ? 'mode-button--active mode-button--heat' : ''}`}
                      onClick={() => handleModeChange('heat')}
                      disabled={power === 'off'}
                    >
                      <span className="mode-icon">▲</span>
                      <span>Heat</span>
                    </button>
                    <button
                      className={`mode-button ${mode === 'cool' ? 'mode-button--active mode-button--cool' : ''}`}
                      onClick={() => handleModeChange('cool')}
                      disabled={power === 'off'}
                    >
                      <span className="mode-icon">▼</span>
                      <span>Cool</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Light controls */}
            {zoneLights.length > 0 && (
              <div className="control-panel__section">
                <label className="control-label">Lights</label>
                <div className="light-controls">
                  {zoneLights.map((light) => {
                    const isPending = !!light.pendingChange;
                    const displayState = isPending ? light.pendingChange.state : light.state;
                    const isOn = displayState === 'on';

                    return (
                      <button
                        key={light.row}
                        className={`light-button ${isOn ? 'light-button--on' : ''} ${isPending ? 'light-button--pending' : ''}`}
                        onClick={() => onToggleLight?.(light.row, light.name)}
                      >
                        <span className="light-icon">{isOn ? '💡' : '○'}</span>
                        <span className="light-name">{light.name}</span>
                        <span className="light-state">{displayState}</span>
                        {isPending && (
                          <span className="light-pending-indicator">⏳</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info notice */}
            <div className="control-panel__notice">
              <p>
                Changes will update the control sheet.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="control-panel__actions">
            <button
              className="button button--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Apply Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
