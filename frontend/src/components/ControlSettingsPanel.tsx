import './ControlSettingsPanel.css';
import { useControlSettings } from '../state/controlSettingsContext';
import React from 'react';

interface ControlSettingsPanelProps {
  showReset?: boolean;
  compact?: boolean;
}

const formatSensitivity = (value: number) => value.toFixed(4);

const ControlSettingsPanel: React.FC<ControlSettingsPanelProps> = ({ showReset = false, compact = false }) => {
  const { controlSensitivity, setControlSensitivity, resetSettings } = useControlSettings();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setControlSensitivity(Number(event.target.value));
  };

  const sensitivityLabel = formatSensitivity(controlSensitivity);

  return (
    <div className={`control-settings-panel ${compact ? 'control-settings-panel--compact' : ''}`}>
      <div className="control-settings-header">
        <div>
          <h3>Control Sensitivity</h3>
          <p>Adjust how quickly your view responds to mouse movement.</p>
        </div>
        <span className="control-settings-value">{sensitivityLabel}</span>
      </div>

      <div className="control-settings-slider">
        <label htmlFor="sensitivity">Mouse look speed</label>
        <input
          id="sensitivity"
          type="range"
          min={0.0005}
          max={0.01}
          step={0.0005}
          value={controlSensitivity}
          onChange={handleChange}
        />
        <div className="control-settings-scale">
          <span>Slower</span>
          <span>Faster</span>
        </div>
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
