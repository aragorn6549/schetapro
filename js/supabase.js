// ⚠️ ВНИМАНИЕ: На следующем шаге мы создадим проект в Supabase.
// Тогда замени строки ниже на свои реальные данные из настроек Supabase.
const SUPABASE_URL = 'https://exqaoxsuqhjgkdzmzhuq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cptCfdzxFGF0I9j9FXLMfg_UJSzfkPS';

// Инициализация клиента (работает через CDN, подключенный в HTML)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
