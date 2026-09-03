"use strict";

/* Carregar depois de admin.js. Adiciona CPF e CNH ao cadastro de usuarios. */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const client = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  const byId = (id) => document.getElementById(id);
  const trim = (value) => String(value || "").trim();

  function toast(message) {
    const element = byId("toast");
    if (!element) return window.alert(message);
    element.textContent = message;
    element.classList.add("show");
    window.setTimeout(() => element.classList.remove("show"), 3500);
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function injectFields() {
    const form = byId("userForm");
    const grid = form?.querySelector(".form-grid");
    if (!grid || form.elements.cpf) return;

    const activeLabel = form.elements.active?.closest("label");
    const cpfLabel = document.createElement("label");
    cpfLabel.innerHTML = 'CPF *<input name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" required placeholder="000.000.000-00">';

    const cnhLabel = document.createElement("label");
    cnhLabel.innerHTML = 'CNH *<input name="cnh" inputmode="numeric" autocomplete="off" maxlength="20" required placeholder="Número da CNH">';

    grid.insertBefore(cpfLabel, activeLabel || null);
    grid.insertBefore(cnhLabel, activeLabel || null);

    form.elements.cpf.addEventListener("input", (event) => {
      event.target.value = formatCpf(event.target.value);
    });
  }

  async function fillIdentity(userId) {
    if (!userId) return;
    const form = byId("userForm");
    const { data, error } = await client
      .from("fleet_users")
      .select("cpf,cnh")
      .eq("id", userId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (form.elements.cpf) form.elements.cpf.value = data.cpf || "";
    if (form.elements.cnh) form.elements.cnh.value = data.cnh || "";
  }

  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-user]");
    if (edit) window.setTimeout(() => fillIdentity(edit.dataset.editUser), 0);

    const fresh = event.target.closest("#newUser");
    if (fresh) window.setTimeout(() => {
      const form = byId("userForm");
      if (form?.elements.cpf) form.elements.cpf.value = "";
      if (form?.elements.cnh) form.elements.cnh.value = "";
    }, 0);
  });

  document.addEventListener("submit", async (event) => {
    if (event.target?.id !== "userForm") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const form = event.target;
    const button = form.querySelector('button[type="submit"], button:not([type])');
    const id = trim(form.elements.id?.value);
    const payload = {
      full_name: trim(form.elements.full_name.value),
      email: trim(form.elements.email.value) || null,
      employee_number: trim(form.elements.employee_number.value) || null,
      department: trim(form.elements.department.value) || null,
      job_title: trim(form.elements.job_title.value) || null,
      cpf: trim(form.elements.cpf.value),
      cnh: trim(form.elements.cnh.value),
      active: form.elements.active.value === "true",
      updated_at: new Date().toISOString()
    };

    if (!payload.full_name || !payload.cpf || !payload.cnh) {
      toast("Preencha nome, CPF e CNH.");
      return;
    }

    if (onlyDigits(payload.cpf).length !== 11) {
      toast("Informe um CPF com 11 dígitos.");
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    try {
      const result = id
        ? await client.from("fleet_users").update(payload).eq("id", id).select("id").single()
        : await client.from("fleet_users").insert({ ...payload, created_at: new Date().toISOString() }).select("id").single();

      if (result.error) throw result.error;
      toast(id ? "Usuário atualizado com CPF e CNH." : "Usuário adicionado com CPF e CNH.");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.error(error);
      toast(error.code === "23505" ? "CPF ou matrícula já cadastrados." : error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Salvar";
      }
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFields, { once: true });
  } else {
    injectFields();
  }
})();
