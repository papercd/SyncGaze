import './ControlSettingsPanel.css';
import { useControlSettings, DEFAULT_SENSITIVITY, MIN_SENSITIVITY, MAX_SENSITIVITY } from '../state/controlSettingsContext';
import React from 'react';

interface ControlSettingsPanelProps {
  showReset?: boolean;
  compact?: boolean;
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

const ControlSettingsPanel: React.FC<ControlSettingsPanelProps> = ({ showReset = false, compact = false }) => {
  const { controlSensitivity, setControlSensitivity, resetSettings } = useControlSettings();

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
          <h3>Control Sensitivity</h3>
          <p>Adjust how quickly your view responds to mouse movement.</p>
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
        <label htmlFor="sensitivity">Mouse look speed</label>
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
          <option value={0} label="Min" />
          <option value={50} label="Default" />
          <option value={100} label="Max" />
        </datalist>
        <div className="control-settings-scale">
          <span>Slower</span>
          <span>Default</span>
          <span>Faster</span>
        </div>
        <div className="control-settings-footnote">Default: {formatSensitivity(DEFAULT_SENSITIVITY)}</div>
      </div>

      {showReset && (
        <div className="control-settings-actions">
          <button type="button" className="control-reset" onClick={resetSettings}>
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlSettingsPanel;