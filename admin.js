"use strict";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));
const fmtDate = (value) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
  : "-";

if (!window.APP_CONFIG) {
  throw new Error("config.js não foi carregado. Verifique se o arquivo está na raiz do site.");
}

if (!window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_ANON_KEY) {
  throw new Error("A configuração do Supabase está incompleta em config.js.");
}

if (!window.supabase) {
  throw new Error("A biblioteca do Supabase não foi carregada.");
}

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
  window.setTimeout(() => element.classList.remove("show"), 3500);
}

function theme(value) {
  document.documentElement.dataset.theme = value;
  localStorage.setItem("fleetTheme", value);
  if ($("themeText")) {
    $("themeText").textContent = value === "dark" ? "Tema claro" : "Tema escuro";
  }
}

function modal(id, open = true) {
  const element = $(id);
  if (element) element.classList.toggle("hidden", !open);
}

function resetUserForm() {
  editingUserId = null;
  const form = $("userForm");
  if (!form) return;
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form.elements.active) form.elements.active.value = "true";
}

function resetVehicleForm() {
  editingVehicleId = null;
  const form = $("vehicleForm");
  if (!form) return;
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form.elements.active) form.elements.active.value = "true";
  if (form.elements.manual_status) form.elements.manual_status.value = "auto";
}

async function verify() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    showLogin();
    return;
  }

  const { data, error } = await db.rpc("is_fleet_admin");

  if (error || !data) {
    await db.auth.signOut();
    showLogin("Conta sem permissão administrativa.");
    return;
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
      db.from("fleet_users").select("*").order("full_name"),
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
  $("kVehicles").textContent = vehicles.filter((vehicle) => vehicle.active).length;
  $("kPending").textContent = reservations.filter((reservation) => reservation.status === "pending").length;
  $("kApproved").textContent = reservations.filter((reservation) => reservation.status === "approved").length;
  $("kOpen").textContent = records.filter((record) => record.status === "open").length;

  $("fleetBody").innerHTML = vehicles.map((vehicle) => `
    <tr>
      <td>${esc(vehicle.project || "-")}</td>
      <td><b>${esc(vehicle.model)}</b></td>
      <td>${esc(vehicle.plate)}</td>
      <td>${esc(vehicle.manual_status || "auto")}</td>
      <td>${vehicle.active ? "Sim" : "Não"}</td>
      <td><button type="button" class="btn small" data-edit-vehicle="${vehicle.id}">Editar</button></td>
    </tr>
  `).join("");

  $("usersBody").innerHTML = users.map((user) => `
    <tr>
      <td><b>${esc(user.full_name)}</b></td>
      <td>${esc(user.email || "-")}</td>
      <td>${esc(user.employee_number || "-")}</td>
      <td>${esc(user.department || "-")}</td>
      <td>${esc(user.job_title || "-")}</td>
      <td>${user.active ? "Sim" : "Não"}</td>
      <td><button type="button" class="btn small" data-edit-user="${user.id}">Editar</button></td>
    </tr>
  `).join("");

  $("requestsBody").innerHTML = reservations.map((reservation) => `
    <tr>
      <td><b>${esc(reservation.requester_name)}</b><br><small>${esc(reservation.requester_email || "")}</small></td>
      <td>${esc(reservation.model)} · ${esc(reservation.plate)}</td>
      <td>${fmtDate(reservation.start_date)} a ${fmtDate(reservation.end_date)}</td>
      <td><span class="badge ${esc(reservation.status)}">${esc(reservation.status)}</span></td>
      <td class="actions">
        ${reservation.status === "pending" ? `
          <button type="button" class="btn small primary" data-decision-id="${reservation.id}" data-decision-status="approved">Aprovar</button>
          <button type="button" class="btn small danger" data-decision-id="${reservation.id}" data-decision-status="rejected">Rejeitar</button>
        ` : ""}
        <button type="button" class="btn small danger" data-delete-reservation="${reservation.id}">Excluir</button>
      </td>
    </tr>
  `).join("");

  $("recordsBody").innerHTML = records.map((record) => `
    <tr>
      <td>${esc(record.requester_name)}</td>
      <td>${esc(record.model)} · ${esc(record.plate)}</td>
      <td>${fmtDate(record.withdrawal_date)}</td>
      <td>${fmtDate(record.expected_return_date)}</td>
      <td>${esc(record.status)}</td>
      <td>${Math.min(100, Number(record.inspection_count || 0) * 50)}%</td>
    </tr>
  `).join("");
}

function openVehicleEditor(id) {
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle) {
    toast("Veículo não encontrado.");
    return;
  }

  editingVehicleId = vehicle.id;
  const form = $("vehicleForm");
  form.reset();

  for (const [key, value] of Object.entries(vehicle)) {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  }

  form.elements.id.value = vehicle.id;
  form.elements.active.value = String(vehicle.active);
  if (form.elements.manual_status) form.elements.manual_status.value = vehicle.manual_status || "auto";
  $("vehicleModalTitle").textContent = "Editar veículo";
  modal("vehicleModal");
}

function openUserEditor(id) {
  const user = users.find((item) => item.id === id);
  if (!user) {
    toast("Usuário não encontrado.");
    return;
  }

  editingUserId = user.id;
  const form = $("userForm");
  form.reset();
  form.elements.id.value = user.id;
  form.elements.full_name.value = user.full_name || "";
  form.elements.email.value = user.email || "";
  form.elements.employee_number.value = user.employee_number || "";
  form.elements.department.value = user.department || "";
  form.elements.job_title.value = user.job_title || "";
  form.elements.active.value = String(user.active);
  $("userModalTitle").textContent = "Editar usuário";
  modal("userModal");
}

async function decide(id, status) {
  const { error } = await db.rpc("set_reservation_status", {
    p_reservation_id: id,
    p_status: status
  });

  if (error) {
    toast(error.message);
    return;
  }

  toast("Solicitação atualizada.");
  await load();
}

async function deleteReservation(id) {
  if (!window.confirm("Excluir esta reserva e o empréstimo vinculado?")) return;

  const { error } = await db.rpc("admin_delete_reservation", {
    p_reservation_id: id
  });

  if (error) {
    toast(error.message);
    return;
  }

  toast("Reserva excluída.");
  await load();
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  const { error } = await db.auth.signInWithPassword(payload);

  if (error) {
    toast(error.message);
    return;
  }

  await verify();
});

$("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin();
});

$("newVehicle").addEventListener("click", () => {
  resetVehicleForm();
  $("vehicleModalTitle").textContent = "Novo veículo";
  modal("vehicleModal");
});

$("newUser").addEventListener("click", () => {
  resetUserForm();
  $("userModalTitle").textContent = "Novo usuário";
  modal("userModal");
});

$("vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  delete payload.id;
  payload.active = payload.active === "true";

  for (const key of Object.keys(payload)) {
    if (payload[key] === "") payload[key] = null;
  }

  const result = editingVehicleId
    ? await db.from("vehicles").update(payload).eq("id", editingVehicleId).select("id").single()
    : await db.from("vehicles").insert(payload).select("id").single();

  if (result.error) {
    toast(result.error.message);
    return;
  }

  const wasEditing = Boolean(editingVehicleId);
  resetVehicleForm();
  modal("vehicleModal", false);
  toast(wasEditing ? "Veículo atualizado com sucesso." : "Novo veículo adicionado com sucesso.");
  await load();
});

$("userForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"], button:not([type])');
  const payload = {
    full_name: form.elements.full_name.value.trim(),
    email: form.elements.email.value.trim() || null,
    employee_number: form.elements.employee_number.value.trim() || null,
    department: form.elements.department.value.trim() || null,
    job_title: form.elements.job_title.value.trim() || null,
    active: form.elements.active.value === "true",
    updated_at: new Date().toISOString()
  };

  if (!payload.full_name) {
    toast("Informe o nome completo.");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Salvando...";
  }

  try {
    let result;

    if (editingUserId) {
      result = await db
        .from("fleet_users")
        .update(payload)
        .eq("id", editingUserId)
        .select("id")
        .single();
    } else {
      result = await db
        .from("fleet_users")
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select("id")
        .single();
    }

    if (result.error) throw result.error;

    const wasEditing = Boolean(editingUserId);
    resetUserForm();
    modal("userModal", false);
    toast(wasEditing ? "Usuário atualizado com sucesso." : "Novo usuário adicionado com sucesso.");
    await load();
  } catch (error) {
    console.error("Erro ao salvar usuário:", error);

    if (error.code === "23505") {
      toast("Já existe um usuário com essa matrícula.");
    } else {
      toast(error.message || "Não foi possível salvar o usuário.");
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Salvar";
    }
  }
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    const modalId = closeButton.dataset.close;
    if (modalId === "userModal") resetUserForm();
    if (modalId === "vehicleModal") resetVehicleForm();
    modal(modalId, false);
    return;
  }

  const editUserButton = event.target.closest("[data-edit-user]");
  if (editUserButton) {
    openUserEditor(editUserButton.dataset.editUser);
    return;
  }

  const editVehicleButton = event.target.closest("[data-edit-vehicle]");
  if (editVehicleButton) {
    openVehicleEditor(editVehicleButton.dataset.editVehicle);
    return;
  }

  const decisionButton = event.target.closest("[data-decision-id]");
  if (decisionButton) {
    decide(decisionButton.dataset.decisionId, decisionButton.dataset.decisionStatus);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-reservation]");
  if (deleteButton) deleteReservation(deleteButton.dataset.deleteReservation);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
    ["fleet", "users", "requests", "records"].forEach((tab) => {
      $(`${tab}Tab`).classList.toggle("hidden", tab !== button.dataset.tab);
    });
  });
});

$("themeToggle").addEventListener("click", () => {
  theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

theme(localStorage.getItem("fleetTheme") || "dark");
verify();
