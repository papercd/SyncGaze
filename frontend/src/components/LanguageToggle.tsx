import './LanguageToggle.css';
import { useTranslation } from '../state/languageContext';

interface LanguageToggleProps {
  variant?: 'landing' | 'sidebar';
}

const LanguageToggle = ({ variant = 'landing' }: LanguageToggleProps) => {
  const { language, toggleLanguage, t } = useTranslation();

  return (
    <button 
      className={`language-toggle language-toggle--${variant}`} 
      type="button" 
      onClick={toggleLanguage} 
      aria-label="Toggle language"
    >
      <span>{language === 'ko' ? t('language.english', 'English') : t('language.korean', 'Korean')}</span>
      <span className="language-toggle__current">{language === 'ko' ? 'KO' : 'EN'}</span>
    </button>
  );
};

export default LanguageToggle;