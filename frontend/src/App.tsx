import AppRouter from './AppRouter';

import { AuthProvider } from './state/authContext';
import { LanguageProvider } from './state/languageContext';

const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;