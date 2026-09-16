// Configuracao publica do frontend
// Nao coloque service_role, senhas ou segredos neste arquivo.
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: "https://slbwszjlrpwrgkgtsfnk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ljR8FTbX6eB_P_VeLck28A_By8nIq34"
});

// Compatibilidade com scripts que leem nomes em camelCase.
window.APP_CONFIG.supabaseUrl = window.APP_CONFIG.SUPABASE_URL;
window.APP_CONFIG.supabaseAnonKey = window.APP_CONFIG.SUPABASE_ANON_KEY;

// Preencha com o nome EXATO da tabela ja existente que armazena as solicitacoes.
// Enquanto estiver vazio, o fallback de cancelamento nao fara alteracoes no banco.
window.FLEET_RESERVATIONS_TABLE = "reservations";

// Mantenha o valor exato aceito atualmente pela coluna status.
window.FLEET_CANCELLED_STATUS = "cancelled";
