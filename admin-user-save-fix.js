"use strict";

/* Fleet Management - correcao definitiva do salvamento de CPF e CNH.
 * Carregar DEPOIS de admin.js no painel.html.
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) {
    console.error("Cadastro: APP_CONFIG ou Supabase nao carregado.");
    return;
  }

  const client = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );
  let saving = false;

  const trim = (value) => String(value || "").trim();
  const digits = (value) => String(value || "").replace(/\D/g, "");

  function formatCpf(value) {
    const number = digits(value).slice(0, 11);
    return number
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function notify(message, isError = false) {
    const toast = document.getElementById("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    toast.style.borderColor = isError ? "var(--red)" : "var(--green)";
    window.setTimeout(() => {
      toast.classList.remove("show");
      toast.style.removeProperty("border-color");
    }, 4500);
  }

  async function saveUser(event) {
    if (event.target?.id !== "userForm") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (saving) return;

    const form = event.target;
    const button = form.querySelector('button[type="submit"], button:not([type])');
    const userId = trim(form.elements.id?.value);
    const cpf = formatCpf(form.elements.cpf?.value);
    const cnh = trim(form.elements.cnh?.value);

    if (!trim(form.elements.full_name?.value)) return notify("Informe o nome completo.", true);
    if (digits(cpf).length !== 11) return notify("Informe um CPF com 11 digitos.", true);
    if (!cnh) return notify("Informe a CNH.", true);

    const payload = {
      full_name: trim(form.elements.full_name.value),
      email: trim(form.elements.email?.value) || null,
      employee_number: trim(form.elements.employee_number?.value) || null,
      department: trim(form.elements.department?.value) || null,
      job_title: trim(form.elements.job_title?.value) || null,
      cpf,
      cnh,
      active: form.elements.active?.value !== "false",
      updated_at: new Date().toISOString()
    };

    saving = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error("Sua sessao expirou. Entre novamente no painel.");

      let result;
      if (userId) {
        result = await client
          .from("fleet_users")
          .update(payload)
          .eq("id", userId)
          .select("id,full_name,cpf,cnh")
          .single();
      } else {
        result = await client
          .from("fleet_users")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select("id,full_name,cpf,cnh")
          .single();
      }

      if (result.error) throw result.error;
      if (!result.data?.cpf || !result.data?.cnh) {
        throw new Error("O banco nao confirmou CPF e CNH.");
      }

      notify(userId ? "Usuario atualizado com CPF e CNH." : "Usuario cadastrado com CPF e CNH.");
      document.getElementById("userModal")?.classList.add("hidden");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error("Erro ao salvar usuario:", error);
      let message = error.message || "Nao foi possivel salvar o usuario.";
      if (error.code === "23505") message = "CPF ou matricula ja cadastrados em outro usuario.";
      if (error.code === "42501") message = "Sem permissao para atualizar fleet_users. Verifique o administrador e as politicas RLS.";
      if (error.code === "42703") message = "As colunas cpf/cnh ainda nao existem em fleet_users.";
      notify(message, true);
    } finally {
      saving = false;
      if (button) {
        button.disabled = false;
        button.textContent = "Salvar";
      }
    }
  }

  function init() {
    const form = document.getElementById("userForm");
    if (!form) {
      console.error("Cadastro: formulario userForm nao encontrado.");
      return;
    }
    form.elements.cpf?.addEventListener("input", (event) => {
      event.target.value = formatCpf(event.target.value);
    });
  }

  document.addEventListener("submit", saveUser, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
