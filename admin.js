"use strict";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const digits = (value) => String(value || "").replace(/\D/g, "");
const formatCpf = (value) => digits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

if (!window.APP_CONFIG) throw new Error("config.js não foi carregado.");
if (!window.supabase) throw new Error("Supabase não foi carregado.");

const db = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
let vehicles = [], users = [], reservations = [], records = [];
let editingUserId = null, editingVehicleId = null, savingUser = false;

function toast(message, error = false) {
  const el = $("toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.style.borderColor = error ? "var(--red)" : "var(--green)";
  el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); el.style.removeProperty("border-color"); }, 4000);
}
function modal(id, open = true) { $(id)?.classList.toggle("hidden", !open); }
function theme(value) {
  document.documentElement.dataset.theme = value;
  localStorage.setItem("fleetTheme", value);
  if ($("themeText")) $("themeText").textContent = value === "dark" ? "Tema claro" : "Tema escuro";
}
function resetUserForm() {
  editingUserId = null;
  const form = $("userForm");
  form?.reset();
  if (form?.elements.id) form.elements.id.value = "";
  if (form?.elements.active) form.elements.active.value = "true";
}
function resetVehicleForm() {
  editingVehicleId = null;
  const form = $("vehicleForm");
  form?.reset();
  if (form?.elements.id) form.elements.id.value = "";
  if (form?.elements.active) form.elements.active.value = "true";
  if (form?.elements.manual_status) form.elements.manual_status.value = "auto";
}

async function verify() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return showLogin();
  const { data, error } = await db.rpc("is_fleet_admin");
  if (error || !data) {
    await db.auth.signOut();
    return showLogin("Conta sem permissão administrativa.");
  }
  $("loginView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
  await load();
}
function showLogin(message) {
  $("loginView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
  if (message) toast(message, true);
}

async function load() {
  try {
    const [v, u, r, l] = await Promise.all([
      db.from("vehicles").select("*").order("model"),
      db.from("fleet_users").select("id,full_name,email,employee_number,department,job_title,cpf,cnh,active,created_at,updated_at").order("full_name"),
      db.from("reservations_admin").select("*").order("created_at", { ascending: false }),
      db.from("loan_records_view").select("*").order("withdrawal_date", { ascending: false })
    ]);
    for (const result of [v,u,r,l]) if (result.error) throw result.error;
    vehicles = v.data || []; users = u.data || []; reservations = r.data || []; records = l.data || [];
    render();
  } catch (error) { console.error(error); toast(error.message || "Erro ao carregar painel.", true); }
}

function render() {
  $("kVehicles").textContent = vehicles.filter(v => v.active).length;
  $("kPending").textContent = reservations.filter(r => r.status === "pending").length;
  $("kApproved").textContent = reservations.filter(r => r.status === "approved").length;
  $("kOpen").textContent = records.filter(r => r.status === "open").length;
  $("fleetBody").innerHTML = vehicles.map(v => `<tr><td>${esc(v.project||"-")}</td><td><b>${esc(v.model)}</b></td><td>${esc(v.plate)}</td><td>${esc(v.manual_status||"auto")}</td><td>${v.active?"Sim":"Não"}</td><td><button type="button" class="btn small" data-edit-vehicle="${v.id}">Editar</button></td></tr>`).join("");
  $("usersBody").innerHTML = users.map(u => `<tr><td><b>${esc(u.full_name)}</b></td><td>${esc(u.email||"-")}</td><td>${esc(u.employee_number||"-")}</td><td>${esc(u.department||"-")}</td><td>${esc(u.job_title||"-")}</td><td>${esc(u.cpf||"-")}</td><td>${esc(u.cnh||"-")}</td><td>${u.active?"Sim":"Não"}</td><td><button type="button" class="btn small" data-edit-user="${u.id}">Editar</button></td></tr>`).join("");
  $("requestsBody").innerHTML = reservations.map(r => `<tr><td><b>${esc(r.requester_name)}</b><br><small>${esc(r.requester_email||"")}</small></td><td>${esc(r.model)} · ${esc(r.plate)}</td><td>${fmtDate(r.start_date)} a ${fmtDate(r.end_date)}</td><td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td><td class="actions">${r.status==="pending"?`<button type="button" class="btn small primary" data-decision-id="${r.id}" data-status="approved">Aprovar</button><button type="button" class="btn small danger" data-decision-id="${r.id}" data-status="rejected">Rejeitar</button>`:""}<button type="button" class="btn small danger" data-delete-id="${r.id}">Excluir</button></td></tr>`).join("");
  $("recordsBody").innerHTML = records.map(r => `<tr><td>${esc(r.requester_name)}</td><td>${esc(r.model)} · ${esc(r.plate)}</td><td>${fmtDate(r.withdrawal_date)}</td><td>${fmtDate(r.expected_return_date)}</td><td>${esc(r.status)}</td><td>${Math.min(100,Number(r.inspection_count||0)*50)}%</td></tr>`).join("");
}

function editUser(id) {
  const u = users.find(item => item.id === id);
  if (!u) return toast("Usuário não encontrado.", true);
  editingUserId = id;
  const f = $("userForm"); f.reset();
  for (const key of ["full_name","email","employee_number","department","job_title","cpf","cnh"]) f.elements[key].value = u[key] || "";
  f.elements.id.value = id; f.elements.active.value = String(u.active);
  $("userModalTitle").textContent = "Editar usuário"; modal("userModal");
}
function editVehicle(id) {
  const v = vehicles.find(item => item.id === id);
  if (!v) return toast("Veículo não encontrado.", true);
  editingVehicleId = id; const f = $("vehicleForm"); f.reset();
  Object.entries(v).forEach(([key,value]) => { if (f.elements[key]) f.elements[key].value = value ?? ""; });
  f.elements.id.value = id; f.elements.active.value = String(v.active); f.elements.manual_status.value = v.manual_status || "auto";
  $("vehicleModalTitle").textContent = "Editar veículo"; modal("vehicleModal");
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const { error } = await db.auth.signInWithPassword(Object.fromEntries(new FormData(event.currentTarget)));
  if (error) return toast(error.message, true); verify();
});
$("logout").addEventListener("click", async () => { await db.auth.signOut(); showLogin(); });
$("newUser").addEventListener("click", () => { resetUserForm(); $("userModalTitle").textContent="Novo usuário"; modal("userModal"); });
$("newVehicle").addEventListener("click", () => { resetVehicleForm(); $("vehicleModalTitle").textContent="Novo veículo"; modal("vehicleModal"); });
$("userForm").elements.cpf.addEventListener("input", event => event.target.value = formatCpf(event.target.value));

$("userForm").addEventListener("submit", async event => {
  event.preventDefault(); event.stopPropagation();
  if (savingUser) return;
  const f = event.currentTarget, button = f.querySelector('button[type="submit"]');
  const payload = {
    full_name: f.elements.full_name.value.trim(), email: f.elements.email.value.trim() || null,
    employee_number: f.elements.employee_number.value.trim() || null, department: f.elements.department.value.trim() || null,
    job_title: f.elements.job_title.value.trim() || null, cpf: formatCpf(f.elements.cpf.value), cnh: f.elements.cnh.value.trim(),
    active: f.elements.active.value === "true", updated_at: new Date().toISOString()
  };
  if (!payload.full_name) return toast("Informe o nome.", true);
  if (digits(payload.cpf).length !== 11) return toast("Informe um CPF com 11 dígitos.", true);
  if (!payload.cnh) return toast("Informe a CNH.", true);
  savingUser=true; button.disabled=true; button.textContent="Salvando...";
  try {
    const result = editingUserId
      ? await db.from("fleet_users").update(payload).eq("id",editingUserId).select("id,cpf,cnh").single()
      : await db.from("fleet_users").insert({...payload,created_at:new Date().toISOString()}).select("id,cpf,cnh").single();
    if (result.error) throw result.error;
    if (!result.data?.cpf || !result.data?.cnh) throw new Error("CPF e CNH não foram confirmados pelo banco.");
    toast(editingUserId ? "Usuário atualizado com CPF e CNH." : "Usuário cadastrado com CPF e CNH.");
    resetUserForm(); modal("userModal",false); await load();
  } catch (error) {
    console.error(error);
    const message = error.code === "23505" ? "CPF ou matrícula já cadastrados." : error.code === "42501" ? "Sem permissão para salvar. Verifique RLS e fleet_admins." : error.message;
    toast(message,true);
  } finally { savingUser=false; button.disabled=false; button.textContent="Salvar"; }
});

$("vehicleForm").addEventListener("submit", async event => {
  event.preventDefault(); const f=event.currentTarget, payload=Object.fromEntries(new FormData(f)); delete payload.id; payload.active=payload.active==="true";
  Object.keys(payload).forEach(k=>{if(payload[k]==="")payload[k]=null});
  const result=editingVehicleId?await db.from("vehicles").update(payload).eq("id",editingVehicleId):await db.from("vehicles").insert(payload);
  if(result.error)return toast(result.error.message,true); resetVehicleForm();modal("vehicleModal",false);toast("Veículo salvo.");load();
});

document.addEventListener("click", async event => {
  const close=event.target.closest("[data-close]"); if(close){if(close.dataset.close==="userModal")resetUserForm();if(close.dataset.close==="vehicleModal")resetVehicleForm();return modal(close.dataset.close,false);}
  const eu=event.target.closest("[data-edit-user]"); if(eu)return editUser(eu.dataset.editUser);
  const ev=event.target.closest("[data-edit-vehicle]"); if(ev)return editVehicle(ev.dataset.editVehicle);
  const decision=event.target.closest("[data-decision-id]"); if(decision){const {error}=await db.rpc("set_reservation_status",{p_reservation_id:decision.dataset.decisionId,p_status:decision.dataset.status});if(error)return toast(error.message,true);toast("Solicitação atualizada.");return load();}
  const del=event.target.closest("[data-delete-id]"); if(del&&confirm("Excluir esta reserva e o empréstimo vinculado?")){const {error}=await db.rpc("admin_delete_reservation",{p_reservation_id:del.dataset.deleteId});if(error)return toast(error.message,true);toast("Reserva excluída.");load();}
});

document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(i=>i.classList.toggle("active",i===button));["fleet","users","requests","records"].forEach(tab=>$(`${tab}Tab`).classList.toggle("hidden",tab!==button.dataset.tab));}));
$("themeToggle").addEventListener("click",()=>theme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
theme(localStorage.getItem("fleetTheme")||"dark"); verify();
