import { useState, useEffect } from 'react';
import ModernDashboard from './ModernDashboard';
import ModernHistory from './ModernHistory';
import { fetchPanelStatus, fetchLogHistory, fetchLightStatus, fetchLockStatus, fetchPlugStatus, updateControl, toggleLight, toggleLock, triggerHvacWebhook, togglePlug, MOCK_PANEL_DATA, LIGHT_ONLY_ZONES, ZONES } from '../../services/sheets';
import { initializeAuth, signIn, signOut, isAuthenticated } from '../../services/auth';
import './ModernApp.css';

function ModernApp() {
  const [activeView, setActiveView] = useState('dashboard');
  const [zones, setZones] = useState(MOCK_PANEL_DATA);
  const [logs, setLogs] = useState([]);
  const [lights, setLights] = useState([]);
  const [plugs, setPlugs] = useState([]);
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    initializeAuth()
      .then(() => setAuthenticated(isAuthenticated()))
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [panelData, historyData, lightData, plugData, lockData] = await Promise.all([
        fetchPanelStatus(),
        fetchLogHistory(),
        fetchLightStatus(),
        fetchPlugStatus(),
        fetchLockStatus()
      ]);

      if (panelData && panelData.length > 0) {
        const updatedZones = panelData.map((newZone, index) => {
          const existingZone = zones[index];

          if (existingZone?.pendingChange) {
            const currentPower = newZone.preferredState?.power || 'off';
            const currentMode = newZone.preferredState?.mode || 'heat';

            const changeApplied =
              existingZone.pendingChange.power === currentPower &&
              existingZone.pendingChange.mode === currentMode;

            if (!changeApplied) {
              return {
                ...newZone,
                preferredState: existingZone.preferredState,
                pendingChange: existingZone.pendingChange,
              };
            }
          }

          return newZone;
        });

        setZones(updatedZones);
      }

      if (historyData) {
        setLogs(historyData);
      }

      if (lightData) {
        const updatedLights = lightData.map(newLight => {
          const existingLight = lights.find(l => l.row === newLight.row);

          if (existingLight?.pendingChange) {
            const changeApplied = existingLight.pendingChange.state === newLight.state;

            if (!changeApplied) {
              return { ...newLight, pendingChange: existingLight.pendingChange };
            }
          }

          return newLight;
        });

        setLights(updatedLights);
      }

      if (plugData) {
        const updatedPlugs = plugData.map(newPlug => {
          const existingPlug = plugs.find(p => p.id === newPlug.id);

          if (existingPlug?.pendingChange) {
            const changeApplied = existingPlug.pendingChange.state === newPlug.state;

            if (!changeApplied) {
              return { ...newPlug, pendingChange: existingPlug.pendingChange };
            }
          }

          return newPlug;
        });

        setPlugs(updatedPlugs);
      }

      if (lockData) {
        const updatedLocks = lockData.map(newLock => {
          const existingLock = locks.find(l => l.id === newLock.id);

          if (existingLock?.pendingChange) {
            const changeApplied = existingLock.pendingChange.state === newLock.state;

            if (!changeApplied) {
              return { ...newLock, pendingChange: existingLock.pendingChange };
            }
          }

          return newLock;
        });

        setLocks(updatedLocks);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'history' && logs.length === 0) {
      fetchLogHistory().then(setLogs);
    }
  }, [activeView]);

  const handleUpdateZone = async (zoneId, settings) => {
    if (!authenticated) {
      alert('Please sign in to update controls');
      throw new Error('Not authenticated');
    }

    const zoneIndex = zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) {
      throw new Error('Zone not found');
    }

    const updatedZones = [...zones];
    const pendingChange = {
      power: settings.power ?? updatedZones[zoneIndex].preferredState?.power ?? 'off',
      mode: settings.mode ?? updatedZones[zoneIndex].preferredState?.mode ?? 'heat',
      target: settings.target ?? updatedZones[zoneIndex].preferredState?.target ?? 68,
      requestedAt: new Date(),
    };

    updatedZones[zoneIndex] = {
      ...updatedZones[zoneIndex],
      preferredState: {
        ...updatedZones[zoneIndex].preferredState,
        power: pendingChange.power,
        mode: pendingChange.mode,
        target: pendingChange.target,
      },
      pendingChange,
    };

    setZones(updatedZones);

    const result = {
      sheetUpdated: false,
      webhookTriggered: false,
    };

    try {
      if (settings.conflictingZones && settings.conflictingZones.length > 0) {
        for (const conflictZoneId of settings.conflictingZones) {
          const conflictIndex = zones.findIndex(z => z.id === conflictZoneId);
          if (conflictIndex !== -1) {
            const conflictTarget = updatedZones[conflictIndex].preferredState?.target || 68;

            await updateControl(conflictIndex, 'power', 'off');
            await updateControl(conflictIndex, 'mode', settings.mode);
            await updateControl(conflictIndex, 'action', 'toggle');

            const conflictWebhookResult = await triggerHvacWebhook(
              conflictZoneId,
              'off',
              settings.mode,
              conflictTarget
            );

            if (conflictWebhookResult.success) {
              console.log(`Webhook sent to turn off ${conflictZoneId}`);
            }

            updatedZones[conflictIndex] = {
              ...updatedZones[conflictIndex],
              preferredState: {
                ...updatedZones[conflictIndex].preferredState,
                power: 'off',
                mode: settings.mode,
              },
              pendingChange: {
                power: 'off',
                mode: settings.mode,
                target: conflictTarget,
                requestedAt: new Date(),
              },
            };
          }
        }
      }

      if (settings.power !== undefined) {
        await updateControl(zoneIndex, 'power', settings.power);
      }
      if (settings.mode !== undefined) {
        await updateControl(zoneIndex, 'mode', settings.mode);
      }
      if (settings.target !== undefined) {
        await updateControl(zoneIndex, 'target', settings.target);
      }
      await updateControl(zoneIndex, 'action', 'toggle');
      result.sheetUpdated = true;

      const target = settings.target ?? updatedZones[zoneIndex].preferredState?.target ?? 68;
      const webhookResult = await triggerHvacWebhook(
        zoneId,
        pendingChange.power,
        pendingChange.mode,
        target
      );

      if (webhookResult.success) {
        result.webhookTriggered = true;
      }

      setZones(updatedZones);

      return result;
    } catch (error) {
      console.error('Error updating zone:', error);
      loadData();
      throw error;
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      setAuthenticated(true);
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Failed to sign in');
    }
  };

  const handleSignOut = () => {
    signOut();
    setAuthenticated(false);
  };

  const handleRestoreDefault = async (zoneId) => {
    if (!authenticated) {
      alert('Please sign in to update controls');
      throw new Error('Not authenticated');
    }

    const zoneIndex = zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) {
      throw new Error('Zone not found');
    }

    const zone = zones[zoneIndex];
    const defaultState = zone.defaultState;

    if (!defaultState) {
      throw new Error('No default state available');
    }

    const updatedZones = [...zones];
    updatedZones[zoneIndex] = {
      ...updatedZones[zoneIndex],
      preferredState: {
        ...updatedZones[zoneIndex].preferredState,
        power: defaultState.power,
        mode: defaultState.mode,
        target: defaultState.target,
      },
      hasOverride: false,
      pendingChange: {
        power: defaultState.power,
        mode: defaultState.mode,
        target: defaultState.target,
        requestedAt: new Date(),
      },
    };

    setZones(updatedZones);

    try {
      await updateControl(zoneIndex, 'clearOverride', false);

      await updateControl(zoneIndex, 'power', defaultState.power);
      await updateControl(zoneIndex, 'mode', defaultState.mode);
      if (defaultState.target) {
        await updateControl(zoneIndex, 'target', defaultState.target);
      }

      return { success: true };
    } catch (error) {
      console.error('Error restoring default:', error);
      loadData();
      throw error;
    }
  };

  const handleToggleLight = async (lightRow, lightName) => {
    if (!authenticated) {
      alert('Please sign in to control lights');
      return;
    }

    const lightIndex = lights.findIndex(l => l.row === lightRow);
    if (lightIndex === -1) return;

    const currentLight = lights[lightIndex];

    const displayedState = currentLight.pendingChange?.state ?? currentLight.state;
    const newState = displayedState === 'on' ? 'off' : 'on';

    const updatedLights = [...lights];
    updatedLights[lightIndex] = {
      ...currentLight,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    setLights(updatedLights);

    try {
      await toggleLight(lightRow, lightName, displayedState);
    } catch (error) {
      console.error('Error toggling light:', error);
      alert(`Failed to toggle light: ${error.message}`);
      loadData();
    }
  };

  const handleTogglePlug = async (plugId, plugName) => {
    if (!authenticated) {
      alert('Please sign in to control plugs');
      return;
    }

    const plugIndex = plugs.findIndex(p => p.id === plugId);
    if (plugIndex === -1) {
      console.error('Plug not found:', plugId);
      return;
    }

    const currentPlug = plugs[plugIndex];
    const displayedState = currentPlug.pendingChange?.state ?? currentPlug.state;
    const newState = displayedState === 'on' ? 'off' : 'on';

    const updatedPlugs = [...plugs];
    updatedPlugs[plugIndex] = {
      ...currentPlug,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    setPlugs(updatedPlugs);

    try {
      await togglePlug(plugId, displayedState);
    } catch (error) {
      console.error('Error toggling plug:', error);
      alert(`Failed to toggle plug: ${error.message}`);
      loadData();
    }
  };

  const handleToggleLock = async (lockId, lockName) => {
    if (!authenticated) {
      alert('Please sign in to control locks');
      return;
    }

    const lockIndex = locks.findIndex(l => l.id === lockId);
    if (lockIndex === -1) {
      console.error('Lock not found:', lockId);
      return;
    }

    const currentLock = locks[lockIndex];
    const displayedState = currentLock.pendingChange?.state ?? currentLock.state;
    const newState = displayedState === 'locked' ? 'unlocked' : 'locked';

    const updatedLocks = [...locks];
    updatedLocks[lockIndex] = {
      ...currentLock,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    setLocks(updatedLocks);

    try {
      await toggleLock(lockId, displayedState);
    } catch (error) {
      console.error('Error toggling lock:', error);
      alert(`Failed to toggle lock: ${error.message}`);
      loadData();
    }
  };

  return (
    <div className="modern-app">
      <header className="modern-header">
        <div className="modern-header__content">
          <h1 className="modern-header__title">Home</h1>
          <div className="modern-header__actions">
            {!authenticated ? (
              <button onClick={handleSignIn} className="modern-btn modern-btn--primary">
                Sign In
              </button>
            ) : (
              <>
                <button
                  onClick={loadData}
                  className="modern-btn modern-btn--refresh"
                  disabled={loading}
                  aria-label="Refresh"
                >
                  <svg className={`modern-icon ${loading ? 'modern-icon--spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                </button>
                <button onClick={handleSignOut} className="modern-btn modern-btn--primary">
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="modern-tabs">
        <div className="modern-tabs__inner">
          <button
            className={`modern-tab ${activeView === 'dashboard' ? 'modern-tab--active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`modern-tab ${activeView === 'history' ? 'modern-tab--active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            History
          </button>
        </div>
      </nav>

      <main className="modern-main">
        {activeView === 'dashboard' ? (
          <ModernDashboard
            zones={zones}
            lightOnlyZones={LIGHT_ONLY_ZONES}
            lights={lights}
            plugs={plugs}
            locks={locks}
            logs={logs}
            onUpdateZone={handleUpdateZone}
            onRestoreDefault={handleRestoreDefault}
            onToggleLight={handleToggleLight}
            onTogglePlug={handleTogglePlug}
            onToggleLock={handleToggleLock}
          />
        ) : (
          <ModernHistory logs={logs} />
        )}
      </main>
    </div>
  );
}

export default ModernApp;
