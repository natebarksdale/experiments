import { useState, useEffect } from 'react';
import TufteDashboard from './components/TufteDashboard';
import TufteHistory from './components/TufteHistory';
import { fetchPanelStatus, fetchLogHistory, fetchLightStatus, fetchLockStatus, fetchPlugStatus, updateControl, toggleLight, toggleLock, togglePlug, MOCK_PANEL_DATA, LIGHT_ONLY_ZONES, ZONES } from './services/sheets';
import { controlThermostat, isSmartThingsAvailable } from './services/smartthings';
import { initializeAuth, signIn, signOut, isAuthenticated } from './services/auth';
import './App.css';

function App() {
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
        // Merge new data with existing zones to preserve pendingChange flags
        const updatedZones = panelData.map((newZone, index) => {
          const existingZone = zones[index];

          // Check if pending change has been applied
          if (existingZone?.pendingChange) {
            // Compare what we requested vs what the panel now shows
            const currentPower = newZone.preferredState?.power || 'off';
            const currentMode = newZone.preferredState?.mode || 'heat';

            const changeApplied =
              existingZone.pendingChange.power === currentPower &&
              existingZone.pendingChange.mode === currentMode;

            console.log('Checking pending change for', newZone.name, {
              requested: existingZone.pendingChange,
              current: { power: currentPower, mode: currentMode },
              applied: changeApplied
            });

            if (!changeApplied) {
              // Preserve pending change and our updated preferredState if not yet applied
              return {
                ...newZone,
                preferredState: existingZone.preferredState, // Keep our updated state
                pendingChange: existingZone.pendingChange,
                // Keep defaultState from fresh data
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
        // Merge with existing lights to preserve pendingChange flags
        const updatedLights = lightData.map(newLight => {
          const existingLight = lights.find(l => l.row === newLight.row);

          // Check if pending change has been applied
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
        // Merge with existing plugs to preserve pendingChange flags
        const updatedPlugs = plugData.map(newPlug => {
          const existingPlug = plugs.find(p => p.id === newPlug.id);

          // Check if pending change has been applied
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
        // Merge with existing locks to preserve pendingChange flags
        const updatedLocks = lockData.map(newLock => {
          const existingLock = locks.find(l => l.id === newLock.id);

          // Check if pending change has been applied
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

    // Update both pendingChange and preferredState
    // preferredState shows the expected state immediately in the UI
    // pendingChange tracks that we're waiting for confirmation
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

    console.log('Setting pending change for', updatedZones[zoneIndex].name, pendingChange);
    setZones(updatedZones);

    // Track status for the modal
    const result = {
      sheetUpdated: false,
      smartthingsControlled: false,
    };

    try {
      // Handle conflicting zones first - turn them off and switch their mode
      if (settings.conflictingZones && settings.conflictingZones.length > 0) {
        for (const conflictZoneId of settings.conflictingZones) {
          const conflictIndex = zones.findIndex(z => z.id === conflictZoneId);
          if (conflictIndex !== -1) {
            const conflictTarget = updatedZones[conflictIndex].preferredState?.target || 68;
            console.log(`Resolving conflict: turning off ${conflictZoneId} and switching mode to ${settings.mode}`);

            // Update Google Sheet
            await updateControl(conflictIndex, 'power', 'off');
            await updateControl(conflictIndex, 'mode', settings.mode);
            await updateControl(conflictIndex, 'action', 'toggle');

            // Control thermostat via SmartThings API for the conflicting zone
            if (isSmartThingsAvailable()) {
              const conflictControlResult = await controlThermostat(
                conflictZoneId,
                'off',
                settings.mode,
                conflictTarget
              );

              if (conflictControlResult.success) {
                console.log(`SmartThings control sent to turn off ${conflictZoneId}`, conflictControlResult);
              } else {
                console.warn(`Failed to control ${conflictZoneId} via SmartThings:`, conflictControlResult.error);
              }
            }

            // Update local state for conflicting zone
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

      // Update Google Sheet (for state tracking)
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

      // Control thermostat directly via SmartThings API for immediate response
      const target = settings.target ?? updatedZones[zoneIndex].preferredState?.target ?? 68;
      if (isSmartThingsAvailable()) {
        const controlResult = await controlThermostat(
          zoneId,
          pendingChange.power,
          pendingChange.mode,
          target
        );

        if (controlResult.success) {
          console.log('SmartThings control sent successfully', controlResult);
          result.smartthingsControlled = true;
        } else {
          console.warn('Failed to control thermostat via SmartThings:', controlResult.error);
        }
      }

      // Update zones state with all changes (including conflicts)
      setZones(updatedZones);

      // Don't reload immediately - the change takes a moment to be reflected
      // The pending indicator will show until the next regular refresh detects the change
      console.log('Control update sent via SmartThings API. Waiting for change to be reflected (check every 2min)...');

      return result;
    } catch (error) {
      console.error('Error updating zone:', error);
      // On error, reload to get current state
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

    // Update local state to default
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
      // Clear the override flag in the sheet
      await updateControl(zoneIndex, 'clearOverride', false);

      // Restore the Control sheet values from Panel defaults
      await updateControl(zoneIndex, 'power', defaultState.power);
      await updateControl(zoneIndex, 'mode', defaultState.mode);
      if (defaultState.target) {
        await updateControl(zoneIndex, 'target', defaultState.target);
      }

      console.log('Cleared override for', zone.name, '- restored to default:', defaultState);

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

    // Toggle based on displayed state (pending takes precedence over current)
    const displayedState = currentLight.pendingChange?.state ?? currentLight.state;
    const newState = displayedState === 'on' ? 'off' : 'on';

    // Set pending change
    const updatedLights = [...lights];
    updatedLights[lightIndex] = {
      ...currentLight,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    console.log(`Setting pending light change for ${lightName}: ${displayedState} -> ${newState}`);
    setLights(updatedLights);

    try {
      // Send webhook based on displayed state, not just confirmed state
      await toggleLight(lightRow, lightName, displayedState);
      console.log(`Light toggle webhook sent for ${lightName}. Waiting for confirmation...`);
    } catch (error) {
      console.error('Error toggling light:', error);
      alert(`Failed to toggle light: ${error.message}`);
      // On error, reload to get current state
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

    // Set pending change
    const updatedPlugs = [...plugs];
    updatedPlugs[plugIndex] = {
      ...currentPlug,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    console.log(`Setting pending plug change for ${plugName}: ${displayedState} -> ${newState}`);
    setPlugs(updatedPlugs);

    try {
      await togglePlug(plugId, displayedState);
      console.log(`Plug toggle webhook sent for ${plugName}. Waiting for confirmation...`);
    } catch (error) {
      console.error('Error toggling plug:', error);
      alert(`Failed to toggle plug: ${error.message}`);
      // On error, reload to get current state
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

    // Set pending change
    const updatedLocks = [...locks];
    updatedLocks[lockIndex] = {
      ...currentLock,
      pendingChange: {
        state: newState,
        requestedAt: new Date(),
      },
    };

    console.log(`Setting pending lock change for ${lockName}: ${displayedState} -> ${newState}`);
    setLocks(updatedLocks);

    try {
      await toggleLock(lockId, displayedState);
      console.log(`Lock toggle webhook sent for ${lockName}. Waiting for confirmation...`);
    } catch (error) {
      console.error('Error toggling lock:', error);
      alert(`Failed to toggle lock: ${error.message}`);
      // On error, reload to get current state
      loadData();
    }
  };

  return (
    <div className="app-tufte">
      <main className="app-main-tufte">
        {activeView === 'dashboard' ? (
          <TufteDashboard
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
          <TufteHistory logs={logs} />
        )}
      </main>

      <nav className="app-nav-tufte">
        <button
          className={activeView === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeView === 'history' ? 'active' : ''}
          onClick={() => setActiveView('history')}
        >
          History
        </button>

        <div className="nav-actions">
          {!authenticated ? (
            <button onClick={handleSignIn} className="btn-auth">
              Sign In
            </button>
          ) : (
            <button onClick={handleSignOut} className="btn-auth">
              Sign Out
            </button>
          )}
          <button onClick={loadData} className="btn-refresh" disabled={loading}>
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
