import { useState, useEffect } from 'react';
import App from './App';
import IOSApp from './components/ios/IOSApp';
import ModernApp from './components/modern/ModernApp';
import VictorianApp from './components/victorian/VictorianApp';

export default function Router() {
  const [design, setDesign] = useState(() => {
    // Check URL parameter first
    const params = new URLSearchParams(window.location.search);
    const urlDesign = params.get('design');
    if (urlDesign === 'ios' || urlDesign === 'tufte' || urlDesign === 'modern' || urlDesign === 'victorian') {
      return urlDesign;
    }
    // Otherwise check localStorage
    return localStorage.getItem('hvac-design') || 'tufte';
  });

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('hvac-design', design);

    // Update URL parameter without reloading
    const url = new URL(window.location);
    url.searchParams.set('design', design);
    window.history.replaceState({}, '', url);
  }, [design]);

  const cycleDesign = () => {
    setDesign(prev => {
      if (prev === 'tufte') return 'ios';
      if (prev === 'ios') return 'modern';
      if (prev === 'modern') return 'victorian';
      return 'tufte';
    });
  };

  // Floating toggle button
  const ToggleButton = () => {
    const getButtonStyle = () => {
      if (design === 'ios') {
        return {
          background: '#007AFF',
          label: '',
        };
      }
      if (design === 'modern') {
        return {
          background: '#F9C74F',
          label: '',
          border: '4px solid #1a1a1a',
          boxShadow: '4px 4px 0 #1a1a1a',
        };
      }
      if (design === 'victorian') {
        return {
          background: '#C9A961',
          label: '§',
          border: '3px double #6B5D4F',
          boxShadow: '0 4px 8px rgba(28, 22, 18, 0.3)',
        };
      }
      return {
        background: '#1a1a1a',
        label: 'T',
      };
    };

    const buttonStyle = getButtonStyle();

    return (
      <button
        onClick={cycleDesign}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: design === 'modern' ? '0' : '50%',
          border: buttonStyle.border || 'none',
          background: buttonStyle.background,
          color: design === 'modern' ? '#1a1a1a' : 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: buttonStyle.boxShadow || '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 9999,
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '900',
          fontFamily: design === 'modern' ? 'Anybody, sans-serif' : 'inherit',
        }}
        onMouseEnter={(e) => {
          if (design === 'modern') {
            e.target.style.transform = 'translate(-2px, -2px)';
            e.target.style.boxShadow = '6px 6px 0 #1a1a1a';
          } else if (design === 'victorian') {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 12px rgba(28, 22, 18, 0.4)';
          } else {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (design === 'modern') {
            e.target.style.transform = 'translate(0, 0)';
            e.target.style.boxShadow = '4px 4px 0 #1a1a1a';
          } else if (design === 'victorian') {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 8px rgba(28, 22, 18, 0.3)';
          } else {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }
        }}
        title={`Current: ${design.toUpperCase()} • Click to cycle`}
      >
        {buttonStyle.label}
      </button>
    );
  };

  const getApp = () => {
    if (design === 'ios') return <IOSApp />;
    if (design === 'modern') return <ModernApp />;
    if (design === 'victorian') return <VictorianApp />;
    return <App />;
  };

  return (
    <>
      {getApp()}
      {design !== 'tufte' && <ToggleButton />}
    </>
  );
}
