import { useState, useEffect } from 'react';
import TufteDashboard from './components/TufteDashboard';
import TufteHistory from './components/TufteHistory';
import ControlPanel from './components/ControlPanel';
import { fetchPanelStatus, fetchLogHistory, fetchLightStatus, updateControl, toggleLight, MOCK_PANEL_DATA, LIGHT_ONLY_ZONES } from './services/sheets';
import { initializeAuth, signIn, signOut, isAuthenticated } from './services/auth';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [zones, setZones] = useState(MOCK_PANEL_DATA);
  const [logs, setLogs] = useState([]);
  const [lights, setLights] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
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
      const [panelData, historyData, lightData] = await Promise.all([
        fetchPanelStatus(),
        fetchLogHistory(),
        fetchLightStatus()
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
              // Preserve pending change if not yet applied
              return { ...newZone, pendingChange: existingZone.pendingChange };
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

  const handleZoneClick = (zone) => {
    setSelectedZone(zone);
  };

  const handleUpdateZone = async (zoneId, settings) => {
    if (!authenticated) {
      alert('Please sign in to update controls');
      return;
    }

    const zoneIndex = zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) return;

    const updatedZones = [...zones];
    const pendingChange = {
      power: settings.power ?? updatedZones[zoneIndex].preferredState?.power ?? 'off',
      mode: settings.mode ?? updatedZones[zoneIndex].preferredState?.mode ?? 'heat',
      requestedAt: new Date(),
    };

    // Don't update preferredState yet - just add the pendingChange flag
    // The actual state will update when we get fresh data from the sheet
    updatedZones[zoneIndex] = {
      ...updatedZones[zoneIndex],
      pendingChange,
    };

    console.log('Setting pending change for', updatedZones[zoneIndex].name, pendingChange);
    setZones(updatedZones);

    try {
      if (settings.power !== undefined) {
        await updateControl(zoneIndex, 'power', settings.power);
      }
      if (settings.mode !== undefined) {
        await updateControl(zoneIndex, 'mode', settings.mode);
      }
      await updateControl(zoneIndex, 'action', 'toggle');

      // Don't reload immediately - the change takes time to propagate through IFTTT
      // The pending indicator will show until the next regular refresh detects the change
      console.log('Control update sent. Waiting for IFTTT to apply change (check every 2min)...');
    } catch (error) {
      console.error('Error updating zone:', error);
      alert(`Failed to update: ${error.message}`);
      // On error, reload to get current state
      loadData();
    }

    setSelectedZone(null);
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

  return (
    <div className="app-tufte">
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

      <main className="app-main-tufte">
        {activeView === 'dashboard' ? (
          <TufteDashboard
            zones={zones}
            lightOnlyZones={LIGHT_ONLY_ZONES}
            lights={lights}
            logs={logs}
            onZoneClick={handleZoneClick}
            onToggleLight={handleToggleLight}
          />
        ) : (
          <TufteHistory logs={logs} />
        )}
      </main>

      {selectedZone && (
        <ControlPanel
          zone={selectedZone}
          allZones={zones}
          lights={lights}
          onClose={() => setSelectedZone(null)}
          onUpdate={handleUpdateZone}
          onToggleLight={handleToggleLight}
        />
      )}
    </div>
  );
}

export default App;
