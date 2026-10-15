import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en }
};

// Auto detect system language or default to TR
const systemLang = navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: systemLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
