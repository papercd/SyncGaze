import './WeaponSettingsPanel.css';
import React from 'react';
import { useWeaponSettings, WEAPON_OPTIONS } from '../state/weaponSettingsContext';
import { useTranslation } from '../state/languageContext';

const WeaponSettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { selectedWeaponId, setSelectedWeaponId, resetWeapon } = useWeaponSettings();

  return (
    <div className="weapon-settings">
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
