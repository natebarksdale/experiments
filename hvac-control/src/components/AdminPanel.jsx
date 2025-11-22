import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './AdminPanel.css';

const LOOP_CONFIG = {
  1: {
    name: 'Front Loop',
    zones: ['Hall', 'JR+N Bed', 'NB Office', 'Den']
  },
  2: {
    name: 'Back Loop',
    zones: ['Apartment', 'JR Office', 'Kitchen', 'CE+H Bed']
  }
};

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function PriorityBadge({ priority }) {
  const colors = {
    high: '#ff4444',
    normal: '#ffa500',
    low: '#888'
  };

  return (
    <span
      className="priority-badge"
      style={{ backgroundColor: colors[priority] || colors.normal }}
    >
      {priority}
    </span>
  );
}

export default function AdminPanel({ onClose }) {
  const [controlLog, setControlLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState({ loop1: false, loop2: false });
  const [error, setError] = useState(null);

  // Load control log
  useEffect(() => {
    loadControlLog();
    const interval = setInterval(loadControlLog, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadControlLog() {
    try {
      setLoading(true);
      setError(null);

      // Fetch the control log from the data file
      const response = await fetch('/data/hvac-control-log.json');

      if (!response.ok) {
        if (response.status === 404) {
          setControlLog({ logs: [] });
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load control log: ${response.status}`);
      }

      const data = await response.json();
      setControlLog(data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading control log:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleRebalance(loopId) {
    try {
      setRebalancing(prev => ({ ...prev, [`loop${loopId}`]: true }));
      setError(null);

      // Try to call the rebalance endpoint if available
      try {
        const response = await fetch(`/api/hvac/rebalance/${loopId}`, {
          method: 'POST',
        });

        if (response.ok) {
          // API endpoint worked - reload the control log
          setTimeout(() => {
            loadControlLog();
            setRebalancing(prev => ({ ...prev, [`loop${loopId}`]: false }));
          }, 2000);
          return;
        }
      } catch (apiError) {
        // API not available, fall through to manual instructions
      }

      // Show manual instructions - rebalancing now done via HVAC webhooks
      const message = `Automatic rebalancing is not available in webhook-only mode.\n\nTo rebalance Loop ${loopId}, manually adjust the thermostats via the dashboard.`;

      alert(message);
      setRebalancing(prev => ({ ...prev, [`loop${loopId}`]: false }));

    } catch (err) {
      console.error(`Error rebalancing loop ${loopId}:`, err);
      setError(err.message);
      setRebalancing(prev => ({ ...prev, [`loop${loopId}`]: false }));
    }
  }

  const recentLogs = controlLog?.logs?.slice(0, 10) || [];
  const latestAnalysis = controlLog?.logs?.[0];

  // Determine if reset buttons should be shown
  const loop1NeedsRebalance = latestAnalysis?.analysis?.loop1?.actions?.length > 0 ||
                               latestAnalysis?.analysis?.loop1?.priority === 'high';
  const loop2NeedsRebalance = latestAnalysis?.analysis?.loop2?.actions?.length > 0 ||
                               latestAnalysis?.analysis?.loop2?.priority === 'high';

  // Helper to render loop state metrics
  function renderLoopState(loopData, loopConfig) {
    if (!loopData) return null;

    const zones = loopData.zones || [];
    const activeZones = zones.filter(z => z.active && !z.missing).length;
    const satisfiedZones = zones.filter(z => z.satisfied && !z.missing).length;
    const totalZones = loopConfig.zones.length;

    return (
      <div className="loop-state-metrics">
        <div className="state-metric">
          <span className="metric-label">Mode</span>
          <span className="metric-value mode-badge">{loopData.decision?.recommendedMode || 'unknown'}</span>
        </div>
        <div className="state-metric">
          <span className="metric-label">Active</span>
          <span className="metric-value">{activeZones}/{totalZones}</span>
        </div>
        <div className="state-metric">
          <span className="metric-label">Satisfied</span>
          <span className="metric-value">{satisfiedZones}/{totalZones}</span>
        </div>
        {loopData.decision?.maxDelta > 0 && (
          <div className="state-metric">
            <span className="metric-label">Max Δ</span>
            <span className="metric-value delta-value">{loopData.decision.maxDelta.toFixed(1)}°</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="admin-panel-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="admin-panel"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-panel__header">
          <h2>HVAC Loop Control</h2>
          <button className="admin-panel__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="admin-panel__content">
          {/* Explanation */}
          <section className="admin-section explanation-section">
            <p className="explanation-text">
              Two independent loops automatically manage heating/cooling. Each loop operates in one mode at a time,
              prioritizing zones with the largest temperature differences from their targets.
            </p>
            <div className="loop-zones-grid">
              <div className="loop-zones-card">
                <h4>Loop 1: Front</h4>
                <div className="zone-chips">
                  {LOOP_CONFIG[1].zones.map(zone => (
                    <span key={zone} className="zone-chip">{zone}</span>
                  ))}
                </div>
              </div>
              <div className="loop-zones-card">
                <h4>Loop 2: Back</h4>
                <div className="zone-chips">
                  {LOOP_CONFIG[2].zones.map(zone => (
                    <span key={zone} className="zone-chip">{zone}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Current Loop States */}
          {latestAnalysis && (
            <section className="admin-section">
              <div className="section-header-with-timestamp">
                <h3>Loop States</h3>
                <div className="status-timestamp">
                  {formatTimestamp(latestAnalysis.timestamp)}
                </div>
              </div>

              <div className="loop-states-grid">
                {/* Loop 1 */}
                <div className="loop-state-card">
                  <div className="loop-state-header">
                    <h4>Loop 1: Front</h4>
                    <PriorityBadge priority={latestAnalysis.analysis.loop1.decision?.priority || 'low'} />
                  </div>
                  {renderLoopState(latestAnalysis.analysis.loop1, LOOP_CONFIG[1])}
                  <div className="loop-state-description">
                    {latestAnalysis.analysis.loop1.decision?.reason || 'No data available'}
                  </div>
                  {loop1NeedsRebalance && (
                    <button
                      className="rebalance-button-inline"
                      onClick={() => handleRebalance(1)}
                      disabled={rebalancing.loop1}
                    >
                      {rebalancing.loop1 ? 'Rebalancing...' : 'Rebalance Loop'}
                    </button>
                  )}
                </div>

                {/* Loop 2 */}
                <div className="loop-state-card">
                  <div className="loop-state-header">
                    <h4>Loop 2: Back</h4>
                    <PriorityBadge priority={latestAnalysis.analysis.loop2.decision?.priority || 'low'} />
                  </div>
                  {renderLoopState(latestAnalysis.analysis.loop2, LOOP_CONFIG[2])}
                  <div className="loop-state-description">
                    {latestAnalysis.analysis.loop2.decision?.reason || 'No data available'}
                  </div>
                  {loop2NeedsRebalance && (
                    <button
                      className="rebalance-button-inline"
                      onClick={() => handleRebalance(2)}
                      disabled={rebalancing.loop2}
                    >
                      {rebalancing.loop2 ? 'Rebalancing...' : 'Rebalance Loop'}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Error Display */}
          {error && (
            <div className="error-message">
              Error: {error}
            </div>
          )}

          {/* Recent Actions */}
          <section className="admin-section">
            <h3>Recent Control Actions</h3>
            {loading ? (
              <div className="loading">Loading control history...</div>
            ) : recentLogs.length === 0 ? (
              <div className="no-logs">No control actions recorded yet</div>
            ) : (
              <div className="control-log">
                {recentLogs.map((log, index) => (
                  <motion.div
                    key={index}
                    className="log-entry"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="log-header">
                      <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
                      <div className="log-summary">
                        {log.actionsExecuted > 0 ? (
                          <span className="log-actions-executed">
                            {log.actionsExecuted} action(s) executed
                          </span>
                        ) : (
                          <span className="log-no-actions">No actions needed</span>
                        )}
                      </div>
                    </div>
                    <div className="log-details">
                      <div className="log-loop">
                        <strong>Loop 1:</strong> {log.analysis.loop1.mode} - {log.analysis.loop1.reason}
                      </div>
                      <div className="log-loop">
                        <strong>Loop 2:</strong> {log.analysis.loop2.mode} - {log.analysis.loop2.reason}
                      </div>
                      {log.results && log.results.length > 0 && (
                        <div className="log-actions">
                          {log.results.map((result, ridx) => (
                            <div key={ridx} className={`action-item ${result.success ? 'success' : 'failed'}`}>
                              <span className="action-zone">{result.zoneName}</span>
                              <span className="action-change">
                                {result.currentMode} → {result.newMode}
                              </span>
                              <span className="action-status">
                                {result.success ? '✓' : '✗'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="admin-panel__footer">
          <button className="button button--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
