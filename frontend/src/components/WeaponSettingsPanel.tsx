import './WeaponSettingsPanel.css';
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useWeaponSettings, WEAPON_OPTIONS } from '../state/weaponSettingsContext';
import { useTranslation } from '../state/languageContext';

const WeaponPreviewModel: React.FC<{ modelPath: string; scaleMultiplier?: number; yOffset?: number }> = ({
  modelPath,
  scaleMultiplier = 1,
  yOffset = 0
}) => {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!group.current) return;
    // Center and scale the model so any GLB fits the preview
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxSize = Math.max(size.x, size.y, size.z);
    const targetSize = 1.5 * scaleMultiplier;
    const scale = maxSize > 0 ? targetSize / maxSize : 1;

    const yLift = size.y * 0.2 * scale + yOffset;

    group.current.scale.setScalar(scale);
    group.current.position.set(
      -center.x * scale,
      -center.y * scale + yLift,
      -center.z * scale
    );
  }, [clonedScene]);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <group ref={group} position={[0, -0.15, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
};

const WeaponSettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { selectedWeaponId, setSelectedWeaponId, resetWeapon } = useWeaponSettings();
  const currentOption = WEAPON_OPTIONS.find(option => option.id === selectedWeaponId) ?? WEAPON_OPTIONS[0];

  return (
    <div className="weapon-settings">
      <div className="weapon-settings__preview">
        <div className="weapon-settings__preview-info">
          <div>
            <p className="weapon-settings__kicker">{t('settings.weapon.preview', 'Preview')}</p>
            <h4>{t(currentOption.labelKey, currentOption.id)}</h4>
            <p className="weapon-settings__preview-desc">{t(currentOption.descriptionKey, '')}</p>
          </div>
          <span className="weapon-settings__path">{currentOption.modelPath}</span>
        </div>
        <div className="weapon-settings__canvas" key={currentOption.id}>
          <Canvas camera={{ position: [0.6, 0.4, 1.4], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 4]} intensity={0.8} />
            <Suspense fallback={null}>
              <WeaponPreviewModel
                modelPath={currentOption.modelPath}
                scaleMultiplier={currentOption.previewScale}
                yOffset={currentOption.previewYOffset}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>

      <div className="weapon-settings__list" role="radiogroup" aria-label={t('settings.weapon.title', 'Weapon')}>
        {WEAPON_OPTIONS.map(option => (
          <label
            key={option.id}
            className={`weapon-card ${selectedWeaponId === option.id ? 'weapon-card--active' : ''}`}
          >
            <input
              type="radio"
              name="weapon"
              value={option.id}
              checked={selectedWeaponId === option.id}
              onChange={() => setSelectedWeaponId(option.id)}
            />
            <div className="weapon-card__header">
              <span className="weapon-card__title">{t(option.labelKey, option.id)}</span>
              {selectedWeaponId === option.id && <span className="weapon-card__badge">{t('common.selected', 'Selected')}</span>}
            </div>
            <p className="weapon-card__desc">{t(option.descriptionKey, '')}</p>
            <span className="weapon-card__path">{option.modelPath}</span>
          </label>
        ))}
      </div>
      <div className="weapon-settings__actions">
        <button type="button" className="weapon-settings__reset" onClick={resetWeapon}>
          {t('settings.weapon.reset', 'Reset to default')}
        </button>
      </div>
    </div>
  );
};

export default WeaponSettingsPanel;
