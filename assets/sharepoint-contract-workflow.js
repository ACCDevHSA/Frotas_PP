"use strict";

/*
 * Fleet Management - contrato assinado via link do SharePoint
 * Use o mesmo arquivo no index.html e no painel.html.
 * Carregue por ultimo. Nao use junto com os fluxos antigos de upload.
 */
(() => {
  if (window.__sharePointContractWorkflowInstalled) return;
  window.__sharePointContractWorkflowInstalled = true;

  if (!window.APP_CONFIG || !window.supabase) {
    console.error("SharePoint workflow: Supabase/config.js nao carregado.");
    return;
  }

  const db = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  const isPublicPage = Boolean(document.getElementById("requestForm"));
  const isAdminPage = Boolean(document.getElementById("requestsBody"));
  let ownRequests = [];
  let loadingOwnRequests = false;
  let loadingAdminLinks = false;

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character])
  );
  const formatDate = (value) => value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "-";

  function requestTokens() {
    try {
      const values = JSON.parse(
        localStorage.getItem("fleetRequestTokens") || "[]"
      );
      return Array.isArray(values) ? [...new Set(values)] : [];
    } catch {
      return [];
    }
  }

  function notify(message, isError = false) {
    const toast = $("toast");
    if (!toast) return window.alert(message);

    toast.textContent = message;
    toast.classList.add("show");
    toast.style.borderColor = isError
      ? "var(--danger, var(--red))"
      : "var(--success, var(--green))";

    window.setTimeout(() => {
      toast.classList.remove("show");
      toast.style.removeProperty("border-color");
    }, 4200);
  }

  function normalizeUrl(value) {
    return String(value || "").trim();
  }

  function isSharePointUrl(value) {
    try {
      const url = new URL(normalizeUrl(value));
      if (url.protocol !== "https:") return false;
      const host = url.hostname.toLowerCase();
      return host === "sharepoint.com" ||
        host.endsWith(".sharepoint.com") ||
        host === "sharepoint.us" ||
        host.endsWith(".sharepoint.us") ||
        host === "sharepoint.de" ||
        host.endsWith(".sharepoint.de") ||
        host === "sharepoint.cn" ||
        host.endsWith(".sharepoint.cn");
    } catch {
      return false;
    }
  }

  function openSafeUrl(value) {
    if (!isSharePointUrl(value)) {
      notify("O link do contrato nao e um endereco valido do SharePoint.", true);
      return;
    }
    window.open(value, "_blank", "noopener,noreferrer");
  }

  function installStyles() {
    if ($("sharePointContractStyles")) return;

    const style = document.createElement("style");
    style.id = "sharePointContractStyles";
    style.textContent = `
      .sp-contract-box {
        display: grid;
        gap: 9px;
        margin-top: 12px;
        padding: 12px;
        border: 1px solid var(--warning, var(--amber));
        border-radius: var(--radius-sm);
        background: var(--surface-raised, var(--surface2));
      }

      .sp-contract-box.ready {
        border-color: var(--success, var(--green));
      }

      .sp-contract-box strong {
        color: var(--warning, var(--amber));
      }

      .sp-contract-box.ready strong {
        color: var(--success, var(--green));
      }

      .sp-contract-box input[type="url"] {
        width: 100%;
      }

      .sp-contract-help,
      .sp-contract-validation {
        color: var(--muted);
        font-size: .76rem;
      }

      .sp-contract-validation.valid {
        color: var(--success, var(--green));
      }

      .sp-contract-validation.invalid {
        color: var(--danger, var(--red));
      }

      .sp-contract-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }

      .sp-contract-actions .btn {
        width: 100%;
      }

      .sp-admin-contract {
        display: grid;
        gap: 4px;
        min-width: 125px;
      }

      .sp-admin-contract .signed-label {
        color: var(--success, var(--green));
        font-size: .72rem;
        font-weight: 800;
      }

      @media (max-width: 520px) {
        .sp-contract-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function loadOwnRequests() {
    if (loadingOwnRequests) return ownRequests;
    loadingOwnRequests = true;
    const rows = [];

    try {
      for (const token of requestTokens()) {
        const tracking = await db.rpc("track_fleet_request", {
          p_token: token
        });
        if (tracking.error) continue;

        const request = Array.isArray(tracking.data)
          ? tracking.data[0]
          : tracking.data;
        if (!request) continue;

        const workflow = await db.rpc(
          "get_sharepoint_contract_status",
          { p_token: token }
        );
        if (workflow.error) {
          console.error("Status do contrato:", workflow.error);
          continue;
        }

        const state = Array.isArray(workflow.data)
          ? workflow.data[0]
          : workflow.data;

        rows.push({
          ...request,
          token,
          has_signed_contract: Boolean(state?.has_signed_contract),
          signed_contract_url: state?.signed_contract_url || null,
          signed_submitted_at: state?.signed_submitted_at || null
        });
      }

      ownRequests = rows;
      return rows;
    } finally {
      loadingOwnRequests = false;
    }
  }

  function cardMatches(card, request) {
    const text = card.innerText || "";
    return text.includes(request.plate || "") &&
      text.includes(request.requester_name || "") &&
      text.includes(formatDate(request.start_date));
  }

  async function cancelOwnReservation(request, button) {
    if (!window.confirm("Cancelar esta solicitacao de reserva?")) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Cancelando...";

    try {
      const result = await db.rpc("cancel_own_fleet_reservation", {
        p_token: request.token
      });
      if (result.error) throw result.error;
      notify("Solicitacao cancelada.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error("Cancelamento:", error);
      notify(error.message || "Nao foi possivel cancelar.", true);
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function submitContractLink(request, box) {
    const input = box.querySelector('input[type="url"]');
    const button = box.querySelector("[data-submit-link]");
    const validation = box.querySelector(".sp-contract-validation");
    const contractUrl = normalizeUrl(input.value);

    if (!isSharePointUrl(contractUrl)) {
      validation.textContent =
        "Informe um link HTTPS valido do SharePoint.";
      validation.className = "sp-contract-validation invalid";
      button.disabled = true;
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Concluindo...";

    try {
      const result = await db.rpc(
        "submit_sharepoint_signed_contract",
        {
          p_token: request.token,
          p_contract_url: contractUrl
        }
      );
      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error("O banco nao confirmou o contrato assinado.");
      }

      notify(
        "Contrato assinado registrado. Solicitacao enviada para aprovacao."
      );
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error("Contrato SharePoint:", error);
      validation.textContent = error.message ||
        "Nao foi possivel registrar o link.";
      validation.className = "sp-contract-validation invalid";
      button.disabled = false;
      button.textContent = original;
    }
  }

  function createPendingBox(request) {
    const box = document.createElement("div");
    box.className = "sp-contract-box";

    if (request.has_signed_contract) {
      box.classList.add("ready");
      box.innerHTML = `
        <strong>Contrato assinado enviado</strong>
        <small>A solicitacao esta aguardando aprovacao administrativa.</small>
        <div class="sp-contract-actions">
          <button type="button" class="btn" data-open-link>
            Abrir contrato assinado
          </button>
          <button type="button" class="btn danger" data-cancel-own>
            Cancelar reserva
          </button>
        </div>`;

      box.querySelector("[data-open-link]").addEventListener(
        "click",
        () => openSafeUrl(request.signed_contract_url)
      );
      box.querySelector("[data-cancel-own]").addEventListener(
        "click",
        (event) => cancelOwnReservation(request, event.currentTarget)
      );
      return box;
    }

    box.innerHTML = `
      <strong>Aguardando assinatura do contrato</strong>
      <small class="sp-contract-help">
        Baixe o contrato, salve o PDF assinado no SharePoint e cole abaixo
        o link de compartilhamento autorizado.
      </small>
      <input type="url" inputmode="url" autocomplete="off"
        placeholder="https://empresa.sharepoint.com/..."
        aria-label="Link do contrato assinado no SharePoint">
      <div class="sp-contract-validation">
        O botao Concluir Solicitacao sera habilitado apos um link valido.
      </div>
      <div class="sp-contract-actions">
        <button type="button" class="btn" data-contract-word>Baixar Word</button>
        <button type="button" class="btn" data-contract-pdf>Baixar PDF</button>
      </div>
      <div class="sp-contract-actions">
        <button type="button" class="btn primary"
          data-submit-link disabled>
          Concluir Solicitacao
        </button>
        <button type="button" class="btn danger" data-cancel-own>
          Cancelar reserva
        </button>
      </div>`;

    const input = box.querySelector('input[type="url"]');
    const submit = box.querySelector("[data-submit-link]");
    const validation = box.querySelector(".sp-contract-validation");
    box.querySelector("[data-contract-word]").addEventListener("click", () => {
      if (!window.FleetContract) return notify("Motor do contrato nao carregado.", true);
      window.FleetContract.word(request);
    });
    box.querySelector("[data-contract-pdf]").addEventListener("click", () => {
      if (!window.FleetContract) return notify("Motor do contrato nao carregado.", true);
      window.FleetContract.pdf(request);
    });

    input.addEventListener("input", () => {
      const isValid = isSharePointUrl(input.value);
      submit.disabled = !isValid;
      validation.textContent = isValid
        ? "Link do SharePoint reconhecido."
        : "Informe um link HTTPS valido do SharePoint.";
      validation.className = `sp-contract-validation ${
        input.value.trim() ? (isValid ? "valid" : "invalid") : ""
      }`;
    });

    submit.addEventListener("click", () => submitContractLink(request, box));
    box.querySelector("[data-cancel-own]").addEventListener(
      "click",
      (event) => cancelOwnReservation(request, event.currentTarget)
    );

    return box;
  }

  async function decoratePublicCards() {
    const requests = await loadOwnRequests();

    document.querySelectorAll(
      "#reservationGrid .reservation-card"
    ).forEach((card) => {
      const request = requests.find((item) => cardMatches(card, item));
      if (!request || !["pending", "approved"].includes(request.status)) {
        return;
      }

      card.querySelectorAll(
        ".workflow-state, .signed-upload-final, .signed-contract-box, " +
        ".native-pdf-upload, .sp-contract-box"
      ).forEach((element) => element.remove());

      if (request.status === "pending") {
        card.appendChild(createPendingBox(request));
      } else if (request.status === "approved") {
        const box = document.createElement("div");
        box.className = "sp-contract-box ready";
        box.innerHTML = `
          <strong>Reserva aprovada</strong>
          <small>Contrato assinado identificado e reserva confirmada.</small>
          <div class="sp-contract-actions">
            ${request.has_signed_contract ?
              '<button type="button" class="btn" data-open-link>Abrir contrato assinado</button>' : ""}
            <button type="button" class="btn danger" data-cancel-own>
              Cancelar reserva
            </button>
          </div>`;

        box.querySelector("[data-open-link]")?.addEventListener(
          "click",
          () => openSafeUrl(request.signed_contract_url)
        );
        box.querySelector("[data-cancel-own]").addEventListener(
          "click",
          (event) => cancelOwnReservation(request, event.currentTarget)
        );
        card.appendChild(box);
      }
    });
  }

  function reservationIdFromRow(row) {
    const element = row.querySelector(
      "[data-decision],[data-delete],[data-decision-id]," +
      "[data-delete-id],[data-delete-reservation]"
    );

    return element?.dataset.decision ||
      element?.dataset.delete ||
      element?.dataset.decisionId ||
      element?.dataset.deleteId ||
      element?.dataset.deleteReservation || "";
  }

  async function decorateAdminTable() {
    if (loadingAdminLinks) return;
    loadingAdminLinks = true;

    try {
      const result = await db.rpc("admin_list_sharepoint_contracts");
      if (result.error) throw result.error;

      const contractMap = new Map(
        (result.data || []).map((item) => [item.reservation_id, item])
      );

      const table = document.querySelector("#requestsTab table");
      const header = table?.querySelector("thead tr");

      if (header && !header.querySelector(".sp-contract-header")) {
        const cell = document.createElement("th");
        cell.className = "sp-contract-header";
        cell.textContent = "Contrato Assinado";
        header.insertBefore(cell, header.lastElementChild);
      }

      document.querySelectorAll("#requestsBody tr").forEach((row) => {
        row.querySelector(".sp-contract-cell")?.remove();

        const reservationId = reservationIdFromRow(row);
        if (!reservationId) return;

        const contract = contractMap.get(reservationId);
        const cell = document.createElement("td");
        cell.className = "sp-contract-cell";

        const approveButton = row.querySelector('[data-decision][data-status="approved"]');
        if (contract?.contract_url) {
          if (approveButton) {
            approveButton.disabled = false;
            approveButton.title = "Aprovar solicitacao";
          }
          const wrapper = document.createElement("div");
          wrapper.className = "sp-admin-contract";
          wrapper.innerHTML = `
            <span class="signed-label">Assinado</span>
            <button type="button" class="btn small">
              Abrir contrato
            </button>`;
          wrapper.querySelector("button").addEventListener(
            "click",
            () => openSafeUrl(contract.contract_url)
          );
          cell.appendChild(wrapper);
        } else {
          if (approveButton) {
            approveButton.disabled = true;
            approveButton.title = "Aguardando link do contrato assinado";
          }
          cell.innerHTML = '<span class="muted">Aguardando link</span>';
        }

        row.insertBefore(cell, row.lastElementChild);
      });
    } catch (error) {
      console.error("Contratos no painel:", error);
    } finally {
      loadingAdminLinks = false;
    }
  }

  function initPublicPage() {
    const grid = $("reservationGrid");
    if (grid) {
      new MutationObserver(() => {
        window.setTimeout(decoratePublicCards, 80);
      }).observe(grid, { childList: true, subtree: true });
    }
    window.setTimeout(decoratePublicCards, 150);
  }

  function initAdminPage() {
    const body = $("requestsBody");
    if (body) {
      new MutationObserver(() => {
        window.setTimeout(decorateAdminTable, 100);
      }).observe(body, { childList: true, subtree: true });
    }
    window.setTimeout(decorateAdminTable, 500);
  }

  function init() {
    installStyles();
    if (isPublicPage) initPublicPage();
    if (isAdminPage) initAdminPage();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
