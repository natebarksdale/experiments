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

      // Show manual instructions
      const message = `To manually rebalance Loop ${loopId}, run this command on the server:\n\ncd smartthings-poller\nnode rebalance-loop.js ${loopId}\n\nOr to rebalance all loops:\n\nnode rebalance-loop.js`;

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
          <section className="admin-section">
            <h3>How It Works</h3>
            <div className="explanation">
              <p>
                The HVAC system has two independent loops. Each loop can only operate in one mode at a time
                (heating or cooling). The control logic automatically monitors all zones and makes adjustments
                to ensure:
              </p>
              <ul>
                <li>Units don't heat or cool beyond their target temperatures</li>
                <li>All units on a loop are aligned with the loop's mode</li>
                <li>When zones have conflicting needs, we prioritize based on temperature deltas</li>
                <li>Zones with large temperature differences get higher priority</li>
              </ul>
              <div className="loop-info">
                <div className="loop-card">
                  <h4>Loop 1: Front</h4>
                  <ul>
                    {LOOP_CONFIG[1].zones.map(zone => (
                      <li key={zone}>{zone}</li>
                    ))}
                  </ul>
                </div>
                <div className="loop-card">
                  <h4>Loop 2: Back</h4>
                  <ul>
                    {LOOP_CONFIG[2].zones.map(zone => (
                      <li key={zone}>{zone}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Current Status */}
          {latestAnalysis && (
            <section className="admin-section">
              <h3>Current Status</h3>
              <div className="status-timestamp">
                Last analyzed: {formatTimestamp(latestAnalysis.timestamp)}
              </div>
              <div className="loop-status">
                <div className="loop-status-card">
                  <h4>Loop 1: Front</h4>
                  <div className="loop-mode">
                    Mode: <strong>{latestAnalysis.analysis.loop1.mode}</strong>
                  </div>
                  <div className="loop-reason">
                    {latestAnalysis.analysis.loop1.reason}
                  </div>
                  <PriorityBadge priority={latestAnalysis.analysis.loop1.priority} />
                </div>
                <div className="loop-status-card">
                  <h4>Loop 2: Back</h4>
                  <div className="loop-mode">
                    Mode: <strong>{latestAnalysis.analysis.loop2.mode}</strong>
                  </div>
                  <div className="loop-reason">
                    {latestAnalysis.analysis.loop2.reason}
                  </div>
                  <PriorityBadge priority={latestAnalysis.analysis.loop2.priority} />
                </div>
              </div>
              {latestAnalysis.actionsExecuted > 0 && (
                <div className="actions-summary">
                  Executed {latestAnalysis.actionsExecuted} of {latestAnalysis.actionsPlanned} planned action(s)
                </div>
              )}
            </section>
          )}

          {/* Manual Rebalance */}
          <section className="admin-section">
            <h3>Manual Rebalance</h3>
            <p className="section-description">
              Trigger an immediate rebalance of a loop based on current conditions.
              This will analyze the loop and make any necessary adjustments.
            </p>
            <div className="rebalance-buttons">
              <button
                className="rebalance-button"
                onClick={() => handleRebalance(1)}
                disabled={rebalancing.loop1}
              >
                {rebalancing.loop1 ? 'Rebalancing...' : 'Rebalance Loop 1 (Front)'}
              </button>
              <button
                className="rebalance-button"
                onClick={() => handleRebalance(2)}
                disabled={rebalancing.loop2}
              >
                {rebalancing.loop2 ? 'Rebalancing...' : 'Rebalance Loop 2 (Back)'}
              </button>
            </div>
          </section>

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
