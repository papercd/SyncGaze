import './LanguageToggle.css';
import { useTranslation } from '../state/languageContext';

const LanguageToggle = () => {
  const { language, toggleLanguage, t } = useTranslation();

  return (
    <button className="language-toggle" type="button" onClick={toggleLanguage} aria-label="Toggle language">
      <span>{language === 'ko' ? t('language.english', 'English') : t('language.korean', 'Korean')}</span>
      <span className="language-toggle__current">{language === 'ko' ? 'KO' : 'EN'}</span>
    </button>
  );
};

export default LanguageToggle;