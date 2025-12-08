import './SettingsPage.css';
import { useState } from 'react';
import ControlSettingsPanel from '../components/ControlSettingsPanel';
import { useTranslation } from '../state/languageContext';
import { SensitivityPreviewModal } from '../components/SensitivityPreviewModal';
import CrosshairSettingsPanel from '../components/CrosshairSettingsPanel';
import WeaponSettingsPanel from '../components/WeaponSettingsPanel';
import SoundSettingsPanel from '../components/SoundSettingsPanel';
const SettingsPage = () => {
  const { t } = useTranslation();
  const [showSensitivityPreview, setShowSensitivityPreview] = useState(false);

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="settings-header__content">
          <div>
            <h1>{t('settings.header.title', 'Training Settings')}</h1>
            <p className="settings-subtitle">
              {t('settings.header.subtitle', 'Tune your controls to feel comfortable before jumping back in.')}
            </p>
          </div>
         
        </div>
      </header>

      <main className="settings-main">
        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">Controls</p>
              <h2>{t('settings.controls.title', 'Control sensitivity')}</h2>
              <p className="settings-description">
                {t(
                  'settings.controls.desc',
                  'Use the slider to change how responsive mouse look feels inside training. Adjust while paused or here on the settings page anytime.',
                )}
              </p>
            </div>
          </div>
          <ControlSettingsPanel
            showReset
            onOpenPreview={() => setShowSensitivityPreview(true)}
          />
        </section>

              {/* 🔊 Sound Settings 섹션 추가 */}
        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">{t('settings.sound.kicker', 'Audio')}</p>
              <h2>{t('settings.sound.title', 'Sound settings')}</h2>
              <p className="settings-description">
                {t('settings.sound.desc', 'Adjust volume levels for gunfire and other sound effects during training.')}
              </p>
            </div>
          </div>
          <SoundSettingsPanel showReset />
        </section>

        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">HUD</p>
              <h2>{t('settings.crosshair.title', 'Crosshair')}</h2>
              <p className="settings-description">
                {t(
                  'settings.crosshair.desc',
                  'Pick your preferred color and tune the lines so the crosshair matches your FPS habits.',
                )}
              </p>
            </div>
          </div>
          <CrosshairSettingsPanel />
        </section>

        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">Equipment</p>
              <h2>{t('settings.weapon.title', 'Weapon')}</h2>
              <p className="settings-description">
                {t(
                  'settings.weapon.desc',
                  'Pick the style you like to swap weapon animation and model.',
                )}
              </p>
            </div>
          </div>
          <WeaponSettingsPanel />
        </section>
      </main>
      {showSensitivityPreview && (
        <SensitivityPreviewModal onClose={() => setShowSensitivityPreview(false)} />
      )}
    </div>
  );
};

export default SettingsPage;
