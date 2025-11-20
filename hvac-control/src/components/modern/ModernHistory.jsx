import { useMemo } from 'react';
import './ModernHistory.css';

export default function ModernHistory({ logs }) {
  const groupedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const groups = {};

    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase();

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(log);
    });

    return Object.entries(groups).map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    }));
  }, [logs]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  };

  const getEventIcon = (log) => {
    if (log.type === 'hvac') {
      if (log.change.includes('off')) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
        );
      }
      if (log.change.includes('heat')) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2v10m0 0L8 8m4 4l4-4"/>
          </svg>
        );
      }
      if (log.change.includes('cool')) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 22V12m0 0l-4 4m4-4l4 4"/>
          </svg>
        );
      }
    }

    if (log.type === 'light') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          <circle cx="12" cy="12" r="5"/>
        </svg>
      );
    }

    if (log.type === 'plug') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="7" y="7" width="10" height="10" rx="2"/>
          <path d="M9 3v4m6-4v4"/>
        </svg>
      );
    }

    if (log.type === 'lock') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="5" y="11" width="14" height="10" rx="2"/>
          <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
          <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    );
  };

  const getEventColor = (log) => {
    if (log.type === 'hvac') {
      if (log.change.includes('heat')) return 'var(--modern-heat)';
      if (log.change.includes('cool')) return 'var(--modern-cool)';
      if (log.change.includes('off')) return 'var(--modern-gray)';
    }
    if (log.type === 'light') return 'var(--modern-light)';
    if (log.type === 'plug') return 'var(--modern-plug)';
    if (log.type === 'lock') return 'var(--modern-lock)';
    return 'var(--modern-gray)';
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="modern-history-empty">
        <svg className="modern-history-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p className="modern-history-empty__text">No Activity</p>
      </div>
    );
  }

  return (
    <div className="modern-history">
      {groupedLogs.map((group) => (
        <section key={group.date} className="modern-history-group">
          <div className="modern-history-group__header">
            <h2 className="modern-history-group__date">{group.date}</h2>
            <div className="modern-history-group__accent"></div>
            <div className="modern-history-group__line"></div>
          </div>

          <div className="modern-history-list">
            {group.entries.map((log, entryIndex) => (
              <div
                key={`${log.timestamp}-${entryIndex}`}
                className="modern-history-item"
                style={{ '--item-color': getEventColor(log) }}
              >
                <div className="modern-history-item__icon-wrapper">
                  <div className="modern-history-item__icon">
                    {getEventIcon(log)}
                  </div>
                </div>

                <div className="modern-history-item__content">
                  <div className="modern-history-item__header">
                    <span className="modern-history-item__zone">{log.zone}</span>
                    <span className="modern-history-item__time">{formatTime(log.timestamp)}</span>
                  </div>
                  <p className="modern-history-item__change">{log.change}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
