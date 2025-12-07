import './SensitivityPreviewModal.css';
import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Environment } from './Environment';
import { Crosshair } from './Crosshair';
import { usePointerLock } from '../hooks/usePointerLock';
import { useControlSettings, DEFAULT_SENSITIVITY, MIN_SENSITIVITY, MAX_SENSITIVITY } from '../state/controlSettingsContext';
import { useMouseLook } from '../hooks/useMouseLook';

interface SensitivityPreviewModalProps {
  onClose: () => void;
}

const MouseLookDriver: React.FC<{ active: boolean }> = ({ active }) => {
  const { controlSensitivity } = useControlSettings();
  useMouseLook(controlSensitivity, active);
  return null;
};

const PreviewMarkers: React.FC = () => (
  <group>
    <mesh position={[0, 1.6, -3]}>
      <sphereGeometry args={[0.35, 32, 32]} />
      <meshStandardMaterial color="#7c9bff" emissive="#7c9bff" emissiveIntensity={0.35} />
    </mesh>
    <mesh position={[-3, 2.2, -5]} rotation={[0.4, 0.2, 0]}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial color="#6ee7b7" metalness={0.15} roughness={0.4} />
    </mesh>
    <mesh position={[3, 1.4, -4]} rotation={[0.1, -0.3, 0]}>
      <torusGeometry args={[0.9, 0.15, 24, 48]} />
      <meshStandardMaterial color="#f59e0b" metalness={0.2} roughness={0.35} />
    </mesh>
  </group>
);

const describeSensitivity = (value: number) => {
  const ratio = value / DEFAULT_SENSITIVITY;
  if (ratio < 0.35) return 'Ultra low';
  if (ratio < 0.75) return 'Low';
  if (ratio < 1.2) return 'Default feel';
  if (ratio < 2) return 'Fast';
  return 'Very fast';
};

export const SensitivityPreviewModal: React.FC<SensitivityPreviewModalProps> = ({ onClose }) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(previewRef);
  const { controlSensitivity, setControlSensitivity } = useControlSettings();

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

  const ratioLabel = useMemo(
    () => `${(controlSensitivity / DEFAULT_SENSITIVITY).toFixed(2)}×`,
    [controlSensitivity]
  );
  const descriptor = useMemo(
    () => describeSensitivity(controlSensitivity),
    [controlSensitivity]
  );
  const sliderValue = useMemo(
    () => sensitivityToSliderValue(controlSensitivity),
    [controlSensitivity]
  );

  const handleStartPreview = () => {
    requestPointerLock();
  };

  const handleClose = () => {
    exitPointerLock();
    onClose();
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setControlSensitivity(sliderValueToSensitivity(Number(event.target.value)));
  };

  return (
    <div className="sensitivity-preview-overlay" role="dialog" aria-modal="true">
      <div className="sensitivity-preview-panel" ref={previewRef}>
        <div className="sensitivity-preview-header">
          <div>
            <p className="sensitivity-preview-kicker">Sensitivity tryout</p>
            <h3>Feel your mouse look in the training arena</h3>
            <p className="sensitivity-preview-description">
              Click start to lock your cursor, then move the mouse to look around. Press Esc to release.
            </p>
          </div>
          <button className="sensitivity-preview-close" onClick={handleClose}>
            Close
          </button>
        </div>

        <div className="sensitivity-preview-body">
          <div className="sensitivity-preview-slider">
            <div className="sensitivity-preview-slider__label">
              <span>Mouse look speed</span>
              <span className="sensitivity-preview-slider__value">
                {formatSensitivity(controlSensitivity)} · {ratioLabel} · {descriptor}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={sliderValue}
              onChange={handleSliderChange}
              list="previewSensitivityMarks"
              aria-label="Adjust mouse look speed for preview"
            />
            <datalist id="previewSensitivityMarks">
              <option value={0} label="Min" />
              <option value={50} label="Default" />
              <option value={100} label="Max" />
            </datalist>
            <div className="sensitivity-preview-scale">
              <span>Slower</span>
              <span>Default</span>
              <span>Faster</span>
            </div>
          </div>

          <div className="sensitivity-preview-instructions">
            <div>
              <p className="sensitivity-preview-status">
                {isLocked ? 'Pointer locked — move to test feel.' : 'Preview paused — click start to lock cursor.'}
              </p>
              <p className="sensitivity-preview-help">
                Your current setting is applied in real-time. Use Esc to pause and adjust the slider if needed.
              </p>
            </div>
            <div className="sensitivity-preview-actions">
              <button
                type="button"
                className="sensitivity-preview-primary"
                onClick={isLocked ? exitPointerLock : handleStartPreview}
              >
                {isLocked ? 'Release cursor' : 'Start preview'}
              </button>
              <button type="button" className="sensitivity-preview-secondary" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>

          <div
            className="sensitivity-preview-stage"
            onClick={!isLocked ? handleStartPreview : undefined}
          >
            <Crosshair />
            {!isLocked && (
              <div className="sensitivity-preview-overlay-card">
                <p className="sensitivity-preview-overlay-title">Click start to try your sensitivity</p>
                <p className="sensitivity-preview-overlay-sub">
                  We’ll lock the cursor so you can spin and flick just like in training.
                </p>
              </div>
            )}

            <Canvas className="sensitivity-preview-canvas" shadows>
              <PerspectiveCamera makeDefault position={[0, 1.6, -6]} fov={90} />
              <MouseLookDriver active={isLocked} />
              <ambientLight intensity={0.35} />
              <pointLight position={[3, 5, -2]} intensity={0.8} />
              <Environment />
              <PreviewMarkers />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
};
