"use strict";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const onlyDigits = (value) => String(value || "").replace(/\D/g, "");
const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

if (!window.APP_CONFIG) throw new Error("config.js não foi carregado.");
if (!window.supabase) throw new Error("A biblioteca do Supabase não foi carregada.");

const db = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

let vehicles = [];
let users = [];
let reservations = [];
let records = [];
let editingUserId = null;
let editingVehicleId = null;

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3500);
}

function theme(value) {
  document.documentElement.dataset.theme = value;
  localStorage.setItem("fleetTheme", value);
  if ($("themeText")) $("themeText").textContent = value === "dark" ? "Tema claro" : "Tema escuro";
}

function modal(id, open = true) {
  $(id)?.classList.toggle("hidden", !open);
}

function resetUserForm() {
  editingUserId = null;
  const form = $("userForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.active.value = "true";
}

function resetVehicleForm() {
  editingVehicleId = null;
  const form = $("vehicleForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.active.value = "true";
  form.elements.manual_status.value = "auto";
}

async function verify() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return showLogin();

  const { data, error } = await db.rpc("is_fleet_admin");
  if (error || !data) {
    await db.auth.signOut();
    return showLogin("Conta sem permissão administrativa.");
  }

  showAdmin();
  await load();
}

function showLogin(message) {
  $("loginView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
  if (message) toast(message);
}

function showAdmin() {
  $("loginView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
}

async function load() {
  try {
    const [vehicleResult, userResult, reservationResult, recordResult] = await Promise.all([
      db.from("vehicles").select("*").order("model"),
      db.from("fleet_users").select("id,full_name,email,employee_number,department,job_title,cpf,cnh,active,created_at,updated_at").order("full_name"),
      db.from("reservations_admin").select("*").order("created_at", { ascending: false }),
      db.from("loan_records_view").select("*").order("withdrawal_date", { ascending: false })
    ]);

    for (const result of [vehicleResult, userResult, reservationResult, recordResult]) {
      if (result.error) throw result.error;
    }

    vehicles = vehicleResult.data || [];
    users = userResult.data || [];
    reservations = reservationResult.data || [];
    records = recordResult.data || [];
    render();
  } catch (error) {
    console.error("Erro ao carregar painel:", error);
    toast(error.message || "Não foi possível carregar o painel.");
  }
}

function render() {
  $("kVehicles").textContent = vehicles.filter((item) => item.active).length;
  $("kPending").textContent = reservations.filter((item) => item.status === "pending").length;
  $("kApproved").textContent = reservations.filter((item) => item.status === "approved").length;
  $("kOpen").textContent = records.filter((item) => item.status === "open").length;

  $("fleetBody").innerHTML = vehicles.map((vehicle) => `
    <tr><td>${esc(vehicle.project || "-")}</td><td><b>${esc(vehicle.model)}</b></td><td>${esc(vehicle.plate)}</td><td>${esc(vehicle.manual_status || "auto")}</td><td>${vehicle.active ? "Sim" : "Não"}</td><td><button type="button" class="btn small" data-edit-vehicle="${vehicle.id}">Editar</button></td></tr>
  `).join("");

  $("usersBody").innerHTML = users.map((user) => `
    <tr>
      <td><b>${esc(user.full_name)}</b></td>
      <td>${esc(user.email || "-")}</td>
      <td>${esc(user.employee_number || "-")}</td>
      <td>${esc(user.department || "-")}</td>
      <td>${esc(user.job_title || "-")}</td>
      <td>${esc(user.cpf || "-")}</td>
      <td>${esc(user.cnh || "-")}</td>
      <td>${user.active ? "Sim" : "Não"}</td>
      <td><button type="button" class="btn small" data-edit-user="${user.id}">Editar</button></td>
    </tr>
  `).join("");

  $("requestsBody").innerHTML = reservations.map((reservation) => `
    <tr><td><b>${esc(reservation.requester_name)}</b><br><small>${esc(reservation.requester_email || "")}</small></td><td>${esc(reservation.model)} · ${esc(reservation.plate)}</td><td>${fmtDate(reservation.start_date)} a ${fmtDate(reservation.end_date)}</td><td><span class="badge ${esc(reservation.status)}">${esc(reservation.status)}</span></td><td class="actions">${reservation.status === "pending" ? `<button type="button" class="btn small primary" data-decision-id="${reservation.id}" data-decision-status="approved">Aprovar</button><button type="button" class="btn small danger" data-decision-id="${reservation.id}" data-decision-status="rejected">Rejeitar</button>` : ""}<button type="button" class="btn small danger" data-delete-reservation="${reservation.id}">Excluir</button></td></tr>
  `).join("");

  $("recordsBody").innerHTML = records.map((record) => `
    <tr><td>${esc(record.requester_name)}</td><td>${esc(record.model)} · ${esc(record.plate)}</td><td>${fmtDate(record.withdrawal_date)}</td><td>${fmtDate(record.expected_return_date)}</td><td>${esc(record.status)}</td><td>${Math.min(100, Number(record.inspection_count || 0) * 50)}%</td></tr>
  `).join("");
}

function openUserEditor(id) {
  const user = users.find((item) => item.id === id);
  if (!user) return toast("Usuário não encontrado.");

  editingUserId = user.id;
  const form = $("userForm");
  form.reset();
  form.elements.id.value = user.id;
  form.elements.full_name.value = user.full_name || "";
  form.elements.email.value = user.email || "";
  form.elements.employee_number.value = user.employee_number || "";
  form.elements.department.value = user.department || "";
  form.elements.job_title.value = user.job_title || "";
  form.elements.cpf.value = user.cpf || "";
  form.elements.cnh.value = user.cnh || "";
  form.elements.active.value = String(user.active);
  $("userModalTitle").textContent = "Editar usuário";
  modal("userModal");
}

function openVehicleEditor(id) {
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle) return toast("Veículo não encontrado.");
  editingVehicleId = vehicle.id;
  const form = $("vehicleForm");
  form.reset();
  for (const [key, value] of Object.entries(vehicle)) if (form.elements[key]) form.elements[key].value = value ?? "";
  form.elements.id.value = vehicle.id;
  form.elements.active.value = String(vehicle.active);
  form.elements.manual_status.value = vehicle.manual_status || "auto";
  $("vehicleModalTitle").textContent = "Editar veículo";
  modal("vehicleModal");
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error } = await db.auth.signInWithPassword(Object.fromEntries(new FormData(event.currentTarget)));
  if (error) return toast(error.message);
  await verify();
});

$("logout").addEventListener("click", async () => { await db.auth.signOut(); showLogin(); });
$("newUser").addEventListener("click", () => { resetUserForm(); $("userModalTitle").textContent = "Novo usuário"; modal("userModal"); });
$("newVehicle").addEventListener("click", () => { resetVehicleForm(); $("vehicleModalTitle").textContent = "Novo veículo"; modal("vehicleModal"); });

$("userForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const cpf = formatCpf(form.elements.cpf.value);
  const cnh = String(form.elements.cnh.value || "").trim();

  if (onlyDigits(cpf).length !== 11) return toast("Informe um CPF com 11 dígitos.");
  if (!cnh) return toast("Informe a CNH.");

  const payload = {
    full_name: form.elements.full_name.value.trim(),
    email: form.elements.email.value.trim() || null,
    employee_number: form.elements.employee_number.value.trim() || null,
    department: form.elements.department.value.trim() || null,
    job_title: form.elements.job_title.value.trim() || null,
    cpf,
    cnh,
    active: form.elements.active.value === "true",
    updated_at: new Date().toISOString()
  };

  button.disabled = true;
  button.textContent = "Salvando...";
  try {
    const result = editingUserId
      ? await db.from("fleet_users").update(payload).eq("id", editingUserId).select("id,cpf,cnh").single()
      : await db.from("fleet_users").insert({ ...payload, created_at: new Date().toISOString() }).select("id,cpf,cnh").single();

    if (result.error) throw result.error;
    if (!result.data?.cpf || !result.data?.cnh) throw new Error("CPF e CNH não foram gravados. Verifique as colunas e permissões.");

    const wasEditing = Boolean(editingUserId);
    resetUserForm();
    modal("userModal", false);
    toast(wasEditing ? "Usuário, CPF e CNH atualizados." : "Usuário, CPF e CNH cadastrados.");
    await load();
  } catch (error) {
    console.error(error);
    toast(error.code === "23505" ? "CPF ou matrícula já cadastrados." : error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar";
  }
});

$("vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  delete payload.id;
  payload.active = payload.active === "true";
  Object.keys(payload).forEach((key) => { if (payload[key] === "") payload[key] = null; });
  const result = editingVehicleId ? await db.from("vehicles").update(payload).eq("id", editingVehicleId) : await db.from("vehicles").insert(payload);
  if (result.error) return toast(result.error.message);
  resetVehicleForm(); modal("vehicleModal", false); toast("Veículo salvo."); await load();
});

document.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    if (close.dataset.close === "userModal") resetUserForm();
    if (close.dataset.close === "vehicleModal") resetVehicleForm();
    return modal(close.dataset.close, false);
  }
  const editUser = event.target.closest("[data-edit-user]");
  if (editUser) return openUserEditor(editUser.dataset.editUser);
  const editVehicle = event.target.closest("[data-edit-vehicle]");
  if (editVehicle) return openVehicleEditor(editVehicle.dataset.editVehicle);
  const decision = event.target.closest("[data-decision-id]");
  if (decision) {
    const { error } = await db.rpc("set_reservation_status", { p_reservation_id: decision.dataset.decisionId, p_status: decision.dataset.decisionStatus });
    if (error) return toast(error.message);
    toast("Solicitação atualizada."); return load();
  }
  const remove = event.target.closest("[data-delete-reservation]");
  if (remove && confirm("Excluir esta reserva e o empréstimo vinculado?")) {
    const { error } = await db.rpc("admin_delete_reservation", { p_reservation_id: remove.dataset.deleteReservation });
    if (error) return toast(error.message);
    toast("Reserva excluída."); return load();
  }
});

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
  ["fleet", "users", "requests", "records"].forEach((tab) => $(`${tab}Tab`).classList.toggle("hidden", tab !== button.dataset.tab));
}));

$("userForm").elements.cpf.addEventListener("input", (event) => { event.target.value = formatCpf(event.target.value); });
$("themeToggle").addEventListener("click", () => theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
theme(localStorage.getItem("fleetTheme") || "dark");
verify();
