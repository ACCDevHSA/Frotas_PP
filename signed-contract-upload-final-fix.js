"use strict";

/*
 * Fleet Management - upload final do contrato assinado
 * Carregar por ultimo no index.html.
 *
 * Este modulo substitui SOMENTE a area de upload dos cards pendentes.
 * Ele nao depende do botao Concluir Solicitacao do workflow anterior.
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const db = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  const MAX_BYTES = 5 * 1024 * 1024;
  const selectedFiles = new WeakMap();
  let requests = [];
  let loading = false;

  const tokens = () => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem("fleetRequestTokens") || "[]"
      );
      return Array.isArray(parsed) ? [...new Set(parsed)] : [];
    } catch {
      return [];
    }
  };

  const formatDate = (value) => value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "-";

  function notify(message, error = false) {
    const toast = document.getElementById("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    toast.style.borderColor = error
      ? "var(--danger, var(--red))"
      : "var(--success, var(--green))";
    window.setTimeout(() => {
      toast.classList.remove("show");
      toast.style.removeProperty("border-color");
    }, 4200);
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = () => reject(
        reader.error || new Error("Nao foi possivel ler o PDF.")
      );
      reader.readAsDataURL(file);
    });
  }

  async function loadRequests() {
    if (loading) return requests;
    loading = true;
    const rows = [];

    try {
      for (const token of tokens()) {
        const tracking = await db.rpc("track_fleet_request", {
          p_token: token
        });
        if (tracking.error) continue;

        const row = Array.isArray(tracking.data)
          ? tracking.data[0]
          : tracking.data;

        if (!row) continue;

        const workflow = await db.rpc(
          "get_reservation_workflow_status",
          { p_token: token }
        );

        const status = Array.isArray(workflow.data)
          ? workflow.data[0]
          : workflow.data;

        rows.push({
          ...row,
          token,
          has_signed_contract: Boolean(status?.has_signed_contract)
        });
      }

      requests = rows;
      return rows;
    } finally {
      loading = false;
    }
  }

  function cardMatches(card, request) {
    const text = card.innerText || "";
    return text.includes(request.plate || "") &&
      text.includes(request.requester_name || "") &&
      text.includes(formatDate(request.start_date));
  }

  function installStyles() {
    if (document.getElementById("signedUploadFinalStyles")) return;

    const style = document.createElement("style");
    style.id = "signedUploadFinalStyles";
    style.textContent = `
      .signed-upload-final {
        display: grid;
        gap: 9px;
        margin-top: 10px;
        padding: 12px;
        border: 1px solid var(--warning, var(--amber));
        border-radius: var(--radius-sm);
        background: var(--surface-raised, var(--surface2));
      }

      .signed-upload-final strong {
        color: var(--warning, var(--amber));
      }

      .signed-upload-final input[type="file"] {
        position: static !important;
        display: block !important;
        width: 100% !important;
        height: auto !important;
        min-height: 44px !important;
        padding: 7px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        color: var(--text) !important;
      }

      .signed-upload-final input[type="file"]::file-selector-button {
        margin-right: 9px;
        padding: 7px 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        font-weight: 750;
        cursor: pointer;
      }

      .signed-upload-file-status {
        min-height: 20px;
        color: var(--muted);
        font-size: .76rem;
      }

      .signed-upload-file-status.ok {
        color: var(--success, var(--green));
      }

      .signed-upload-file-status.error {
        color: var(--danger, var(--red));
      }

      .signed-upload-final button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);
  }

  function validate(file) {
    if (!file) return "Selecione um arquivo PDF.";

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) return "Arquivo invalido. Selecione somente PDF.";
    if (file.size < 100) return "O arquivo selecionado esta vazio.";
    if (file.size > MAX_BYTES) return "O PDF deve ter no maximo 5 MB.";
    return "";
  }

  async function submit(request, component) {
    const file = selectedFiles.get(component);
    const status = component.querySelector(".signed-upload-file-status");
    const button = component.querySelector("[data-final-submit]");
    const validation = validate(file);

    if (validation) {
      status.textContent = validation;
      status.className = "signed-upload-file-status error";
      button.disabled = true;
      return;
    }

    button.disabled = true;
    button.textContent = "Enviando contrato...";
    status.textContent = "Lendo e enviando o PDF...";
    status.className = "signed-upload-file-status";

    try {
      const encoded = await readBase64(file);
      const { data, error } = await db.rpc(
        "complete_reservation_with_signed_contract",
        {
          p_token: request.token,
          p_file_name: file.name,
          p_pdf_base64: encoded
        }
      );

      if (error) throw error;
      if (!data) throw new Error(
        "O banco nao confirmou a conclusao da solicitacao."
      );

      component.classList.add("confirmed");
      component.innerHTML = `
        <strong>Solicitacao concluida</strong>
        <span class="signed-upload-file-status ok">
          Contrato assinado recebido. A reserva foi confirmada.
        </span>`;

      notify("Contrato assinado enviado e reserva confirmada.");
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Upload do contrato assinado:", error);
      status.textContent = error.message ||
        "Nao foi possivel enviar o contrato assinado.";
      status.className = "signed-upload-file-status error";
      button.disabled = false;
      button.textContent = "Concluir Solicitacao";
      notify(status.textContent, true);
    }
  }

  function createComponent(request) {
    const component = document.createElement("div");
    component.className = "signed-upload-final";
    component.dataset.token = request.token;
    component.innerHTML = `
      <strong>Contrato assinado</strong>
      <small>Selecione o PDF assinado para confirmar a reserva.</small>
      <input type="file" accept="application/pdf,.pdf"
        aria-label="Selecionar contrato assinado">
      <div class="signed-upload-file-status">
        Nenhum arquivo selecionado. Limite: 5 MB.
      </div>
      <button type="button" class="btn primary"
        data-final-submit disabled>
        Concluir Solicitacao
      </button>`;

    const input = component.querySelector('input[type="file"]');
    const status = component.querySelector(".signed-upload-file-status");
    const button = component.querySelector("[data-final-submit]");

    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      const validation = validate(file);
      selectedFiles.set(component, file);

      if (validation) {
        status.textContent = validation;
        status.className = "signed-upload-file-status error";
        button.disabled = true;
        return;
      }

      status.textContent = `${file.name} selecionado (${(
        file.size / 1024 / 1024
      ).toFixed(2)} MB).`;
      status.className = "signed-upload-file-status ok";
      button.disabled = false;
    });

    button.addEventListener("click", () => submit(request, component));

    for (const eventName of [
      "click", "pointerdown", "mousedown", "touchstart"
    ]) {
      component.addEventListener(eventName, event => {
        event.stopPropagation();
      });
    }

    return component;
  }

  async function decorate() {
    const rows = await loadRequests();

    document.querySelectorAll(
      "#reservationGrid .reservation-card"
    ).forEach(card => {
      const request = rows.find(row => cardMatches(card, row));
      if (!request || request.status !== "pending") return;

      /* Remove todos os uploads antigos para evitar concorrencia. */
      card.querySelectorAll(
        ".workflow-file-picker-fix, .workflow-file-picker, " +
        ".native-pdf-upload, .signed-upload-final"
      ).forEach(element => element.remove());

      /* Desativa exclusivamente o antigo botao de conclusao. */
      card.querySelectorAll("[data-complete]").forEach(button => {
        button.hidden = true;
        button.disabled = true;
      });

      card.appendChild(createComponent(request));
    });
  }

  function init() {
    installStyles();
    decorate();

    const grid = document.getElementById("reservationGrid");
    if (grid) {
      new MutationObserver(() => {
        window.setTimeout(decorate, 100);
      }).observe(grid, {
        childList: true,
        subtree: true
      });
    }
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
