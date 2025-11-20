import './ModernZoneCard.css';

export default function ModernZoneCard({ zone, lights, plugs, locks, onClick }) {
  const { name, temperature, preferredState, hasHvac, hasOverride, pendingChange } = zone;
  const { power, mode, target } = preferredState || {};

  const temp = temperature !== null ? Math.round(temperature) : '—';
  const hasPending = !!pendingChange;

  const lightsOn = lights.filter(l => {
    const displayState = l.pendingChange?.state ?? l.state;
    return displayState === 'on';
  }).length;

  const plugsOn = plugs.filter(p => {
    const displayState = p.pendingChange?.state ?? p.state;
    return displayState === 'on';
  }).length;

  const locksUnlocked = locks.filter(l => {
    const displayState = l.pendingChange?.state ?? l.state;
    return displayState === 'unlocked';
  }).length;

  const getAccentColor = () => {
    if (!hasHvac) {
      if (lightsOn > 0 || plugsOn > 0) return 'var(--modern-light)';
      return null;
    }

    if (!power || power === 'off') return null;
    return mode === 'heat' ? 'var(--modern-heat)' : 'var(--modern-cool)';
  };

  const accentColor = getAccentColor();
  const delta = target && temperature ? Math.round(temperature - target) : null;

  return (
    <div
      className={`modern-card ${hasPending ? 'modern-card--pending' : ''}`}
      style={{ '--card-accent': accentColor || 'var(--modern-gray-light)' }}
      onClick={onClick}
    >
      <div className="modern-card__content">
        <div className="modern-card__header">
          <h3 className="modern-card__name">{name}</h3>
          {hasOverride && (
            <span className="modern-card__badge">Override</span>
          )}
        </div>

        {hasHvac && (
          <div className="modern-card__hvac">
            <div className="modern-card__temp-display">
              <span className="modern-card__temp">{temp}</span>
              <span className="modern-card__temp-unit">°</span>
            </div>

            {power === 'on' && (
              <div className="modern-card__status">
                <div className={`modern-status-badge modern-status-badge--${mode}`}>
                  <span className="modern-status-badge__icon">
                    {mode === 'heat' ? '▲' : '▼'}
                  </span>
                  <span>
                    {mode === 'heat' ? 'HEAT' : 'COOL'} → {target}°
                  </span>
                </div>

                {delta !== null && (
                  <span className="modern-card__delta">
                    {delta > 0 ? `+${delta}°` : `${delta}°`}
                  </span>
                )}
              </div>
            )}

            {power === 'off' && (
              <div className="modern-card__status">
                <div className="modern-status-badge modern-status-badge--off">
                  <span className="modern-status-badge__icon">○</span>
                  <span>OFF</span>
                </div>
              </div>
            )}
          </div>
        )}

        {(lights.length > 0 || plugs.length > 0 || locks.length > 0) && (
          <div className="modern-card__accessories">
            {lights.length > 0 && (
              <div className="modern-accessory">
                <svg className="modern-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                  <circle cx="12" cy="12" r="5"/>
                </svg>
                <span className="modern-accessory__count">{lightsOn}/{lights.length}</span>
              </div>
            )}

            {plugs.length > 0 && (
              <div className="modern-accessory">
                <svg className="modern-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="7" y="7" width="10" height="10" rx="2"/>
                  <path d="M9 3v4m6-4v4"/>
                </svg>
                <span className="modern-accessory__count">{plugsOn}/{plugs.length}</span>
              </div>
            )}

            {locks.length > 0 && (
              <div className="modern-accessory">
                <svg className="modern-accessory__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="5" y="11" width="14" height="10" rx="2"/>
                  <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
                <span className="modern-accessory__count">
                  {locks.length - locksUnlocked}/{locks.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
