import en from '../locales/en';
import zh from '../locales/zh';

// 国际化资源映射
const locales = {
  'en': en,
  'zh': zh,
};

// 获取当前语言环境
export const getCurrentLocale = () => {
  // 优先使用 localStorage 存储的语言设置
  const savedLocale = localStorage.getItem('locale');
  if (savedLocale && locales[savedLocale]) {
    return savedLocale;
  }
  
  // 其次使用浏览器语言检测
  const browserLang = navigator.language || navigator.languages[0];
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  
  // 默认使用英文
  return 'en';
};

// 设置语言环境
export const setLocale = (locale) => {
  if (locales[locale]) {
    localStorage.setItem('locale', locale);
    window.location.reload(); // 刷新页面以应用新语言
  } else {
    console.warn(`Locale ${locale} is not supported`);
  }
};

// 获取翻译文本
export const t = (key, fallback) => {
  const currentLocale = getCurrentLocale();
  const localeData = locales[currentLocale];
  
  // 支持嵌套键值访问
  const keys = key.split('.');
  let value = localeData;
  
  for (let i = 0; i < keys.length; i++) {
    if (value && typeof value === 'object') {
      value = value[keys[i]];
    } else {
      break;
    }
  }
  
  return value !== undefined ? value : (fallback || key);
};

// 获取所有支持的语言
export const getSupportedLocales = () => {
  return Object.keys(locales);
};