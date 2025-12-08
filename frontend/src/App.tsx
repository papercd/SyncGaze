import AppRouter from './AppRouter';

import { AuthProvider } from './state/authContext';
import { LanguageProvider } from './state/languageContext';
import { SoundSettingsProvider } from './state/soundSettingsContext';

const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SoundSettingsProvider>
          <AppRouter />
        </SoundSettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;