import './TufteHistory.css';

const ZONE_ABBREV = {
  'Basement': 'BB',
  'Main kitchen': '1K',
  'JRs office': '2J',
  'Kids Bedroom': '2K',
  'Front hall': '1H',
  'Denn': '2D',
  'Primary Bedroom': '3B',
  'NBs Office': '3N',
};

// Display order for columns
const ZONE_ORDER = [
  'Basement',
  'Main kitchen',
  'JRs office',
  'Kids Bedroom',
  'Front hall',
  'Denn',
  'Primary Bedroom',
  'NBs Office'
];

// Helper to normalize zone names (handle apostrophe variations)
const normalizeZoneName = (name) => {
  // Remove all apostrophe variants: ' (straight), ' (right single quote), ` (grave), ʼ (modifier letter)
  return name.replace(/[''\u2019\u0027`ʼ]/g, "");
};

export default function TufteHistory({ logs }) {
  const formatTime = (timestamp) => {
    const month = timestamp.getMonth() + 1;
    const day = timestamp.getDate();
    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}\n${hours}:${minutes}`;
  };

  // Debug: log the first entry's zone names
  if (logs.length > 0 && logs[0].parsed) {
    console.log('First log zone names:', logs[0].parsed.map(z => `"${z.name}"`));
    console.log('Looking for NBs Office, normalized to:', normalizeZoneName('NBs Office'));
    console.log('Available normalized names:', logs[0].parsed.map(z => `"${normalizeZoneName(z.name)}"`));
  }

  return (
    <div className="tufte-history">
      <header className="history-header">
        <h1>System History</h1>
        <p className="history-subtitle">Past 7 days · Temperatures in °F</p>
      </header>

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th className="col-time">Time</th>
              {ZONE_ORDER.map((name, i) => (
                <th key={i} className="col-zone" title={name}>
                  {ZONE_ABBREV[normalizeZoneName(name)] || name.substring(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, logIndex) => (
              <tr key={logIndex}>
                <td className="cell-time">{formatTime(log.timestamp)}</td>
                {ZONE_ORDER.map((zoneName, zoneIndex) => {
                  const normalizedZoneName = normalizeZoneName(zoneName);
                  const zone = log.parsed?.find(z => {
                    const normalizedLogName = normalizeZoneName(z.name);
                    return normalizedLogName === normalizedZoneName;
                  });

                  if (!zone) {
                    if (logIndex === 0 && zoneName.includes('NB')) {
                      console.log('NB zone not found. Looking for:', normalizedZoneName, 'Available:', log.parsed?.map(z => `${z.name} -> ${normalizeZoneName(z.name)}`));
                    }
                    return <td key={zoneIndex} className="cell-temp">—</td>;
                  }

                  const isOn = zone.power === 'on';
                  const isHeat = zone.mode === 'heat';
                  const className = `cell-temp ${
                    isOn
                      ? (isHeat ? 'state-heat-on' : 'state-cool-on')
                      : (isHeat ? 'state-heat-off' : 'state-cool-off')
                  }`;

                  return (
                    <td
                      key={zoneIndex}
                      className={className}
                      title={`${zone.name}: ${zone.temperature}° (${isOn ? 'On' : 'Off'} - ${isHeat ? 'Heat' : 'Cool'})`}
                    >
                      {zone.temperature || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="history-empty">
            <p>No log entries available</p>
          </div>
        )}
      </div>

      <footer className="history-footer">
        <div className="footnote">
          <span className="state-heat-on">█</span> Heat On
          <span style={{marginLeft: 'var(--s-4)'}}><span className="state-cool-on">█</span> Cool On</span>
          <span style={{marginLeft: 'var(--s-4)'}}><span className="state-heat-off">□</span> Heat Off</span>
          <span style={{marginLeft: 'var(--s-4)'}}><span className="state-cool-off">□</span> Cool Off</span>
        </div>
      </footer>
    </div>
  );
}
