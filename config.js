// Configuracao publica do frontend. Nao use service_role aqui.
window.APP_CONFIG = {
  SUPABASE_URL: "https://slbwszjlrpwrgkgtsfnk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ljR8FTbX6eB_P_VeLck28A_By8nIq34"
};
window.APP_CONFIG.supabaseUrl = window.APP_CONFIG.SUPABASE_URL;
window.APP_CONFIG.supabaseAnonKey = window.APP_CONFIG.SUPABASE_ANON_KEY;
window.FLEET_RESERVATIONS_TABLE = "reservations";
window.FLEET_CANCELLED_STATUS = "cancelled";
window.getFleetDb = function () {
  if (!window.supabase) throw new Error("Biblioteca do Supabase nao carregada.");
  if (!window.__fleetDb) {
    window.__fleetDb = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return window.__fleetDb;
};
