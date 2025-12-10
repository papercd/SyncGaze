import './ControlSettingsPanel.css';
import { useControlSettings, DEFAULT_SENSITIVITY, MIN_SENSITIVITY, MAX_SENSITIVITY } from '../state/controlSettingsContext';
import React from 'react';
import { useTranslation } from '../state/languageContext';

interface ControlSettingsPanelProps {
  showReset?: boolean;
  compact?: boolean;
  onOpenPreview?: () => void;
}

const formatSensitivity = (value: number) => value.toFixed(4);

const MIN_RATIO = MIN_SENSITIVITY / DEFAULT_SENSITIVITY;
const MAX_RATIO = MAX_SENSITIVITY / DEFAULT_SENSITIVITY;

const sensitivityToSliderValue = (sensitivity: number) => {
  const ratio = sensitivity / DEFAULT_SENSITIVITY;

  if (ratio <= 1) {
    const normalized = -Math.log(ratio) / Math.log(MIN_RATIO);
    return (normalized + 1) * 50;
  }

  const normalized = Math.log(ratio) / Math.log(MAX_RATIO);
  return (normalized + 1) * 50;
};

const sliderValueToSensitivity = (value: number) => {
  const normalized = value / 50 - 1;
  const ratio =
    normalized < 0
      ? Math.exp(-normalized * Math.log(MIN_RATIO))
      : Math.exp(normalized * Math.log(MAX_RATIO));

  return ratio * DEFAULT_SENSITIVITY;
};

const describeSensitivity = (value: number) => {
  const ratio = value / DEFAULT_SENSITIVITY;
  let descriptor: string;

  if (ratio < 0.35) {
    descriptor = 'Ultra low';
  } else if (ratio < 0.75) {
    descriptor = 'Low';
  } else if (ratio < 1.2) {
    descriptor = 'Default feel';
  } else if (ratio < 2) {
    descriptor = 'Fast';
  } else {
    descriptor = 'Very fast';
  }

  return { ratioLabel: `${ratio.toFixed(2)}×`, descriptor };
};

const ControlSettingsPanel: React.FC<ControlSettingsPanelProps> = ({
  showReset = false,
  compact = false,
  onOpenPreview
}) => {
  const { controlSensitivity, invertYAxis, setControlSensitivity, setInvertYAxis, resetSettings } = useControlSettings();
  const { t } = useTranslation();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setControlSensitivity(sliderValueToSensitivity(Number(event.target.value)));
  };

  const sensitivityLabel = formatSensitivity(controlSensitivity);
  const { ratioLabel, descriptor } = describeSensitivity(controlSensitivity);
  const sliderValue = sensitivityToSliderValue(controlSensitivity);

  return (
    <div className={`control-settings-panel ${compact ? 'control-settings-panel--compact' : ''}`}>
      <div className="control-settings-header">
        <div>
          <h3>{t('settings.controls.title', 'Control sensitivity')}</h3>
          <p>{t('settings.controls.panel.desc', 'Adjust how quickly your view responds to mouse movement.')}</p>
        </div>
        <span
          className="control-settings-value"
          aria-label={`Current sensitivity ${sensitivityLabel} which is ${ratioLabel} of the default`}
        >
          <span className="control-settings-value-primary">{sensitivityLabel}</span>
          <span className="control-settings-value-subtext">{ratioLabel} • {descriptor}</span>
        </span>
      </div>

      <div className="control-settings-slider">
        <label htmlFor="sensitivity">{t('settings.controls.slider.label', 'Mouse look speed')}</label>
        <input
          id="sensitivity"
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={sliderValue}
          onChange={handleChange}
          list="sensitivityMarks"
          aria-valuetext={`${ratioLabel} of default sensitivity`}
        />
        <datalist id="sensitivityMarks">
          <option value={0} label={t('settings.controls.slider.min', 'Min')} />
          <option value={50} label={t('settings.controls.slider.default', 'Default')} />
          <option value={100} label={t('settings.controls.slider.max', 'Max')} />
        </datalist>
        <div className="control-settings-scale">
          <span>{t('settings.controls.scale.slower', 'Slower')}</span>
          <span>{t('settings.controls.scale.default', 'Default')}</span>
          <span>{t('settings.controls.scale.faster', 'Faster')}</span>
        </div>
        <div className="control-settings-footnote">
          {t('settings.controls.defaultLabel', 'Default')}: {formatSensitivity(DEFAULT_SENSITIVITY)}
        </div>
      </div>

      <div className="control-settings-toggle">
        <div>
          <h4>{t('settings.controls.invert.title', 'Invert Y-Axis')}</h4>
          <p>{t('settings.controls.invert.desc', 'Flip vertical look so pushing the mouse forward aims downward.')}</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={invertYAxis}
            onChange={(event) => setInvertYAxis(event.target.checked)}
            aria-label={t('settings.controls.invert.aria', 'Invert Y axis')}
          />
          <span className="slider" />
        </label>
      </div>

      {(showReset || onOpenPreview) && (
        <div className="control-settings-actions">
          {onOpenPreview && (
            <button type="button" className="control-test" onClick={onOpenPreview}>
              {t('settings.controls.preview', 'Test in training arena')}
            </button>
          )}
          {showReset && (
            <button type="button" className="control-reset" onClick={resetSettings}>
              {t('settings.controls.reset', 'Reset to default')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ControlSettingsPanel;
