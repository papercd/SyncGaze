// src/components/SoundSettingsPanel.tsx
import { useSoundSettings } from '../state/soundSettingsContext';
import './SoundSettingsPanel.css';

interface SoundSettingsPanelProps {
  showReset?: boolean;
  compact?: boolean;
}

const SoundSettingsPanel: React.FC<SoundSettingsPanelProps> = ({ 
  showReset = false,
  compact = false 
}) => {
  const {
    masterVolume,
    sfxVolume,
    muted,
    setMasterVolume,
    setSfxVolume,
    setMuted,
    resetToDefaults,
  } = useSoundSettings();

  const formatVolume = (value: number) => Math.round(value * 100);

  return (
    <div className={`sound-settings-panel ${compact ? 'sound-settings-panel--compact' : ''}`}>
      {/* Header with Mute Status */}
      <div className="sound-settings-header">
        <div>
          <h3>Sound settings</h3>
          <p>Adjust volume levels for gunfire and other sound effects.</p>
        </div>
        <span
          className="sound-settings-value"
          aria-label={`Sound ${muted ? 'muted' : 'enabled'}`}
        >
          <span className="sound-settings-value-primary">{muted ? '🔇 Muted' : '🔊 On'}</span>
        </span>
      </div>

      {/* Master Volume Slider */}
      <div className="sound-settings-slider">
        <label htmlFor="master-volume">
          Master volume
          <span className="sound-volume-indicator">{formatVolume(masterVolume)}%</span>
        </label>
        <input
          id="master-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={formatVolume(masterVolume)}
          onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
          disabled={muted}
          aria-valuetext={`${formatVolume(masterVolume)}% volume`}
        />
        <div className="sound-settings-scale">
          <span>Silent</span>
          <span>Default</span>
          <span>Loud</span>
        </div>
      </div>

      {/* SFX Volume Slider */}
      <div className="sound-settings-slider">
        <label htmlFor="sfx-volume">
          Sound effects
          <span className="sound-volume-indicator">{formatVolume(sfxVolume)}%</span>
        </label>
        <input
          id="sfx-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={formatVolume(sfxVolume)}
          onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
          disabled={muted}
          aria-valuetext={`${formatVolume(sfxVolume)}% effects volume`}
        />
        <div className="sound-settings-scale">
          <span>Quiet</span>
          <span>Default</span>
          <span>Loud</span>
        </div>
      </div>

      {/* Mute Toggle */}
      <div className="sound-settings-toggle">
        <div>
          <h4>Mute all sounds</h4>
          <p>Temporarily disable all audio output during training.</p>
        </div>
        <label className="switch" htmlFor="mute-toggle">
          <input
            id="mute-toggle"
            type="checkbox"
            checked={muted}
            onChange={(e) => setMuted(e.target.checked)}
            aria-label="Mute all sounds"
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* Actions */}
      {showReset && (
        <div className="sound-settings-actions">
          <button
            type="button"
            className="sound-reset"
            onClick={resetToDefaults}
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
};

export default SoundSettingsPanel;