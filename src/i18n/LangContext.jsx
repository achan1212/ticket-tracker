import { createContext, useContext, useMemo, useState } from 'react';
import { translations, LANGUAGES } from './translations';
import { formatCurrency as rawFormatCurrency } from '../utils/helpers';

const LangContext = createContext(null);

// App language → BCP-47 locale used by Intl.NumberFormat. Currency stays USD
// across locales — this is a US restaurant app.
const LOCALES = { en: 'en-US', zh: 'zh-CN', es: 'es-US' };

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en');
  const t = translations[lang];
  const formatCurrency = useMemo(() => {
    const locale = LOCALES[lang] || 'en-US';
    return (amount) => rawFormatCurrency(amount, locale);
  }, [lang]);
  return (
    <LangContext.Provider value={{ lang, setLang, t, LANGUAGES, formatCurrency }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
