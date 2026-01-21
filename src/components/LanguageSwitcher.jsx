import React from 'react';
import { getCurrentLocale, setLocale, t } from '../utils/locale';

const LanguageSwitcher = () => {
  const currentLocale = getCurrentLocale();

  const handleLanguageChange = (locale) => {
    setLocale(locale);
  };

  return (
    <div className="language-switcher">
      <select 
        value={currentLocale} 
        onChange={(e) => handleLanguageChange(e.target.value)}
        aria-label="Select language"
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;