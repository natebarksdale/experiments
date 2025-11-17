import { motion } from 'framer-motion';
import './HistoryView.css';

// Zone abbreviations for compact header
const ZONE_ABBREV = {
  'Basement': 'B',
  'JRs Office': 'JR',
  'Main kitchen': 'MK',
  'Kids Bedroom': 'KB',
  'Front hall': 'FH',
  'Primary Bedroom': 'PB',
  'NBs Office': 'NB',
  'Denn': 'D',
};

export default function HistoryView({ logs }) {
  const formatTime = (timestamp) => {
    const month = timestamp.getMonth() + 1;
    const day = timestamp.getDate();
    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // Get zone names in order from first log entry
  const zoneNames = logs[0]?.parsed?.map(z => z.name) || [];

  return (
    <div className="history-view">
      <div className="history-view__header">
        <h2>System History</h2>
        <p className="history-view__subtitle mono">
          Temperature log across all zones
        </p>
      </div>

      <div className="history-table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th className="date-col">Date</th>
              {zoneNames.map((name, i) => (
                <th key={i} className="zone-col" title={name}>
                  {ZONE_ABBREV[name] || name.substring(0, 2).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, logIndex) => (
              <motion.tr
                key={logIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: logIndex * 0.02 }}
              >
                <td className="date-cell mono">
                  {formatTime(log.timestamp)}
                </td>
                {log.parsed?.map((zone, zoneIndex) => {
                  const isOn = zone.power === 'on';
                  const isHeat = zone.mode === 'heat';
                  const cellClass = `temp-cell ${
                    isOn
                      ? (isHeat ? 'temp-cell--heat-on' : 'temp-cell--cool-on')
                      : (isHeat ? 'temp-cell--heat-off' : 'temp-cell--cool-off')
                  }`;

                  return (
                    <td
                      key={zoneIndex}
                      className={cellClass}
                      title={`${zone.name}: ${zone.temperature}° (${zone.power === 'on' ? 'On' : 'Off'} - ${zone.mode})`}
                    >
                      {zone.temperature || '—'}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="history-view__empty">
            <p className="mono">No history entries available</p>
          </div>
        )}
      </div>
    </div>
  );
}
