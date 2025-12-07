import './SettingsPage.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ControlSettingsPanel from '../components/ControlSettingsPanel';
import { useTranslation } from '../state/languageContext';
import { SensitivityPreviewModal } from '../components/SensitivityPreviewModal';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSensitivityPreview, setShowSensitivityPreview] = useState(false);

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="settings-header__content">
          <div>
        
            <h1>Training Settings</h1>
            <p className="settings-subtitle">Tune your controls to feel comfortable before jumping back in.</p>
          </div>
         
        </div>
      </header>

      <main className="settings-main">
        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">Controls</p>
              <h2>Control sensitivity</h2>
              <p className="settings-description">
                Use the slider to change how responsive mouse look feels inside training. Adjust while paused or here on
                the settings page anytime.
              </p>
            </div>
          </div>
          <ControlSettingsPanel
            showReset
            onOpenPreview={() => setShowSensitivityPreview(true)}
          />
        </section>
      </main>
      {showSensitivityPreview && (
        <SensitivityPreviewModal onClose={() => setShowSensitivityPreview(false)} />
      )}
    </div>
  );
};

export default SettingsPage;
