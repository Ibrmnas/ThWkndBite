(function () {
  const STORE_KEY = 'wb_lang';

  // Function to get the dictionary (translations)
  function getDict() { 
    return window.I18N_DICT || { en: {}, it: {} }; 
  }

  // Function to retrieve the translation for a given key and language
  function t(lang, key) {
    const dict = getDict();
    return (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || '';
  }

  // Function to apply translations to the page
  function apply(lang) {
    // Apply translations to all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(lang, key);
      if (val) el.textContent = val;
    });

    // Apply translations to all placeholders with data-i18n-ph
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      const val = t(lang, key);
      if (val) el.setAttribute('placeholder', val);
    });

    // Change language in HTML tag and toggle active states on language buttons
    document.documentElement.lang = lang;
    document.getElementById('btn-en')?.classList.toggle('active', lang === 'en');
    document.getElementById('btn-it')?.classList.toggle('active', lang === 'it');

    // Trigger event for other scripts to listen to (e.g., update item names in the grid)
    window.dispatchEvent(new CustomEvent('wb:lang', { detail: { lang } }));
  }

  // Function to set the language (and save it in localStorage)
  function setLang(lang) {
    lang = (lang === 'it') ? 'it' : 'en';  // Default to 'en' if invalid
    localStorage.setItem(STORE_KEY, lang);
    window.__i18n = { lang, t: (key) => t(lang, key), set: setLang };
    apply(lang);
  }

  // Get saved language from localStorage or use browser language (default to 'en')
  const saved = localStorage.getItem(STORE_KEY);
  const initial = saved || ((navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en');
  window.__i18n = { lang: initial, t: (key) => t(initial, key), set: setLang };

  // Add event listeners to language buttons
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-en')?.addEventListener('click', () => setLang('en'));
    document.getElementById('btn-it')?.addEventListener('click', () => setLang('it'));
    apply(initial);  // Apply the initial language when the page loads
  });
})();
