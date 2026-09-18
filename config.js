window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: "https://slbwszjlrpwrgkgtsfnk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ljR8FTbX6eB_P_VeLck28A_By8nIq34",
  TABLES: Object.freeze({
    vehicles: "vehicles",
    users: "fleet_users",
    requests: "reservations",
    admins: "fleet_admins",
    records: "loan_records",
    inspections: "vehicle_inspections"
  }),
  STATUS: Object.freeze({ pending: "pending", approved: "approved", rejected: "rejected", cancelled: "cancelled", active: "active", completed: "completed" })
});
