import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../constants/translations';

export type Language = 'ko' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_STORAGE_KEY = 'syncgaze.language';

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'ko';
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  if (stored === 'ko' || stored === 'en') {
    return stored;
  }

  const browserLang = window.navigator.language?.toLowerCase() ?? 'ko';
  return browserLang.startsWith('en') ? 'en' : 'ko';
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.warn('Failed to persist language preference', error);
    }
  }, [language]);

  const toggleLanguage = () => setLanguage(prev => (prev === 'ko' ? 'en' : 'ko'));

  const t = (key: string, fallback?: string) => {
    const entry = translations[key];
    if (entry) {
      return entry[language];
    }
    return fallback ?? key;
  };

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
};