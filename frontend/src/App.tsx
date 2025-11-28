import AppRouter from './AppRouter';
import LanguageToggle from './components/LanguageToggle';
import { AuthProvider } from './state/authContext';
import { LanguageProvider } from './state/languageContext';

const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LanguageToggle />
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;