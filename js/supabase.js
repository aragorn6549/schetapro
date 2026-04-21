// ⚠️ ВНИМАНИЕ: На следующем шаге мы создадим проект в Supabase.
// Тогда замени строки ниже на свои реальные данные из настроек Supabase.
const SUPABASE_URL = 'ВСТАВЬ_СВОЙ_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'ВСТАВЬ_СВОЙ_SUPABASE_ANON_KEY';

// Инициализация клиента (работает через CDN, подключенный в HTML)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);