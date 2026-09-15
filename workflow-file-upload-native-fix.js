"use strict";

/*
 * Fleet Management - correção definitiva do upload do contrato assinado.
 * Carregar DEPOIS de fleet-reservation-workflow-v2.js.
 *
 * Esta versão usa o input nativo visível do navegador.
 * Não usa botão intermediário, label for, input.click() ou campo oculto.
 */
(() => {
  const MAX_BYTES = 5 * 1024 * 1024;

  function addStyles() {
    if (document.getElementById("nativeSignedPdfUploadStyles")) return;

    const style = document.createElement("style");
    style.id = "nativeSignedPdfUploadStyles";
    style.textContent = `
      .native-pdf-upload {
        display: grid;
        gap: 7px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--surface);
      }

      .native-pdf-upload strong {
        color: var(--text) !important;
        font-size: .8rem;
      }

      .native-pdf-upload input[type="file"] {
        position: static !important;
        display: block !important;
        width: 100% !important;
        height: auto !important;
        min-height: 42px !important;
        padding: 7px !important;
        overflow: visible !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        color: var(--text) !important;
        background: var(--surface-raised, var(--surface2)) !important;
      }

      .native-pdf-upload input[type="file"]::file-selector-button {
        margin-right: 10px;
        padding: 7px 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        font-weight: 750;
        cursor: pointer;
      }

      .native-pdf-upload-status {
        min-height: 20px;
        color: var(--muted);
        font-size: .75rem;
      }

      .native-pdf-upload-status.ok {
        color: var(--success, var(--green));
      }

      .native-pdf-upload-status.error {
        color: var(--danger, var(--red));
      }
    `;

    document.head.appendChild(style);
  }

  function enhance(box) {
    if (box.dataset.nativeUploadFixed === "true") return;

    const oldInput = box.querySelector('input[type="file"]');
    const completeButton = box.querySelector("[data-complete]");
    if (!oldInput || !completeButton) return;

    box.dataset.nativeUploadFixed = "true";

    /* Remove wrappers das correções anteriores, se existirem. */
    const oldWrapper = oldInput.closest(
      ".workflow-file-picker-fix, .workflow-file-picker"
    );

    /* Clone remove listeners e estilos inline conflitantes. */
    const input = oldInput.cloneNode(false);
    input.className = "";
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.removeAttribute("style");
    input.setAttribute("aria-label", "Selecionar contrato assinado em PDF");

    const nativeBlock = document.createElement("div");
    nativeBlock.className = "native-pdf-upload";

    const label = document.createElement("strong");
    label.textContent = "Selecione o contrato assinado em PDF";

    const status = document.createElement("div");
    status.className = "native-pdf-upload-status";
    status.textContent = "Nenhum arquivo selecionado. Limite: 5 MB.";

    nativeBlock.append(label, input, status);

    if (oldWrapper) oldWrapper.replaceWith(nativeBlock);
    else oldInput.replaceWith(nativeBlock);

    completeButton.disabled = true;

    input.addEventListener("change", () => {
      const file = input.files?.[0];

      status.classList.remove("ok", "error");
      completeButton.disabled = true;

      if (!file) {
        status.textContent = "Nenhum arquivo selecionado. Limite: 5 MB.";
        return;
      }

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        status.classList.add("error");
        status.textContent = "Arquivo inválido. Selecione somente PDF.";
        input.value = "";
        return;
      }

      if (file.size > MAX_BYTES) {
        status.classList.add("error");
        status.textContent = "Arquivo maior que 5 MB.";
        input.value = "";
        return;
      }

      status.classList.add("ok");
      status.textContent = `${file.name} selecionado (${(
        file.size / 1024 / 1024
      ).toFixed(2)} MB).`;
      completeButton.disabled = false;
    });

    /*
     * Impede somente que o clique do input suba para o card.
     * Não usa preventDefault, por isso o seletor nativo abre normalmente.
     */
    for (const eventName of ["click", "pointerdown", "mousedown", "touchstart"]) {
      nativeBlock.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    }

    /*
     * O fluxo principal procura input[type=file] dentro do mesmo box.
     * O novo input permanece dentro do box, portanto o upload original
     * continua usando o arquivo selecionado sem duplicar a lógica RPC.
     */
  }

  function scan() {
    document.querySelectorAll(".workflow-state").forEach(enhance);
  }

  function init() {
    addStyles();
    scan();

    const root = document.getElementById("reservationGrid") || document.body;
    new MutationObserver(scan).observe(root, {
      childList: true,
      subtree: true
    });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
