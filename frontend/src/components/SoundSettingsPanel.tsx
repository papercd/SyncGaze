// src/components/SoundSettingsPanel.tsx
import { useSoundSettings } from '../state/soundSettingsContext';
import { useTranslation } from '../state/languageContext';
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
  const { t } = useTranslation();

  const formatVolume = (value: number) => Math.round(value * 100);
  const formatAria = (key: string, value: number) =>
    t(key, '{value}%').replace('{value}', `${formatVolume(value)}`);

  return (
    <div className={`sound-settings-panel ${compact ? 'sound-settings-panel--compact' : ''}`}>
      {/* Header with Mute Status */}
      <div className="sound-settings-header">
        <div>
          <h3>{t('settings.sound.header.title', 'Sound settings')}</h3>
          <p>{t('settings.sound.header.desc', 'Adjust volume levels for gunfire and other sound effects.')}</p>
        </div>
        <span
          className="sound-settings-value"
          aria-label={t('settings.sound.aria.status', 'Sound {state}').replace(
            '{state}',
            muted ? t('settings.sound.status.muted', 'muted') : t('settings.sound.status.on', 'on'),
          )}
        >
          <span className="sound-settings-value-primary">
            {muted ? t('settings.sound.status.muted', '🔇 Muted') : t('settings.sound.status.on', '🔊 On')}
          </span>
        </span>
      </div>

      {/* Master Volume Slider */}
      <div className="sound-settings-slider">
        <label htmlFor="master-volume">
          {t('settings.sound.master', 'Master volume')}
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
          aria-valuetext={formatAria('settings.sound.aria.masterValue', masterVolume)}
        />
        <div className="sound-settings-scale">
          <span>{t('settings.sound.scale.silent', 'Silent')}</span>
          <span>{t('settings.sound.scale.default', 'Default')}</span>
          <span>{t('settings.sound.scale.loud', 'Loud')}</span>
        </div>
      </div>

      {/* SFX Volume Slider */}
      <div className="sound-settings-slider">
        <label htmlFor="sfx-volume">
          {t('settings.sound.effects', 'Sound effects')}
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
          aria-valuetext={formatAria('settings.sound.aria.effectsValue', sfxVolume)}
        />
        <div className="sound-settings-scale">
          <span>{t('settings.sound.scale.quiet', 'Quiet')}</span>
          <span>{t('settings.sound.scale.default', 'Default')}</span>
          <span>{t('settings.sound.scale.loud', 'Loud')}</span>
        </div>
      </div>

      {/* Mute Toggle */}
      <div className="sound-settings-toggle">
        <div>
          <h4>{t('settings.sound.mute.title', 'Mute all sounds')}</h4>
          <p>{t('settings.sound.mute.desc', 'Temporarily disable all audio output during training.')}</p>
        </div>
        <label className="switch" htmlFor="mute-toggle">
          <input
            id="mute-toggle"
            type="checkbox"
            checked={muted}
            onChange={(e) => setMuted(e.target.checked)}
            aria-label={t('settings.sound.mute.title', 'Mute all sounds')}
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
            {t('settings.sound.reset', 'Reset to default')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SoundSettingsPanel;
