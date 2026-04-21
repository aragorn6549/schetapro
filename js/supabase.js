// Проверяем, загрузилась ли библиотека Supabase
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase JS не загрузился. Проверьте интернет или CDN.');
} else {
    console.log('✅ Supabase JS загружен');
}


const SUPABASE_URL = 'https://exqaoxsuqhjgkdzmzhuq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cptCfdzxFGF0I9j9FXLMfg_UJSzfkPS';

// Инициализируем клиент и делаем его глобальным
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

