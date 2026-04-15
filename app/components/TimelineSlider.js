'use client';

import { useState, useEffect, useRef } from 'react';

export default function TimelineSlider({ minYear, maxYear, value, onChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        if (value >= maxYear) {
          setIsPlaying(false);
          return;
        }
        onChange(value + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, value, maxYear, onChange]);

  if (!minYear || !maxYear || !value) return null;

  const handlePlay = () => {
    if (value >= maxYear) {
      onChange(minYear); // Reset to start if at end
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStartOver = () => {
    setIsPlaying(false);
    onChange(minYear); // Go back to the beginning
  };

  const handleReset = () => {
    setIsPlaying(false);
    onChange(maxYear); // Show all farms
  };

  const handleSliderChange = (event) => {
    setIsPlaying(false); // Pause animation when user manually drags
    onChange(Number.parseInt(event.target.value, 10));
  };

  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.85)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    gap: '6px'
  };

  const playButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 20px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.5)',
    borderRadius: '6px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s ease',
    gap: '8px'
  };

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: '18px',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(12, 12, 12, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      color: '#ffffff',
      zIndex: 5,
      width: 'min(640px, 90%)',
      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '8px',
        fontSize: '12px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        <span>{minYear}</span>
        <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
          Farms Started Through {value}
        </span>
        <span>{maxYear}</span>
      </div>
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={value}
        onChange={handleSliderChange}
        style={{
          width: '100%',
          accentColor: '#f59e0b'
        }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '10px'
      }}>
        <button
          onClick={handleStartOver}
          style={buttonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Start Over
        </button>
        {isPlaying ? (
          <button
            onClick={handlePause}
            style={playButtonStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            style={playButtonStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Play
          </button>
        )}
        <button
          onClick={handleReset}
          style={buttonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19,3 5,12 19,21" />
            <rect x="3" y="4" width="3" height="16" />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
}
