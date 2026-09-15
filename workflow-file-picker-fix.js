"use strict";

/* Fleet Management - correcao do seletor de PDF assinado.
 * Carregar DEPOIS de fleet-reservation-workflow-v2.js.
 */
(() => {
  function installStyles() {
    if (document.getElementById("workflowFilePickerFixStyles")) return;
    const style = document.createElement("style");
    style.id = "workflowFilePickerFixStyles";
    style.textContent = `
      .workflow-file{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}
      .workflow-file-picker-fix{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
      .workflow-file-name-fix{overflow:hidden;color:var(--muted);font-size:.78rem;text-overflow:ellipsis;white-space:nowrap}
      @media(max-width:520px){.workflow-file-picker-fix{grid-template-columns:1fr}.workflow-file-name-fix{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function enhance(box) {
    if (box.dataset.filePickerFixed === "true") return;
    const input = box.querySelector('input[type="file"]');
    const complete = box.querySelector('[data-complete]');
    if (!input || !complete) return;

    box.dataset.filePickerFixed = "true";
    input.classList.add("workflow-file");

    const wrapper = document.createElement("div");
    wrapper.className = "workflow-file-picker-fix";

    const pickButton = document.createElement("button");
    pickButton.type = "button";
    pickButton.className = "btn";
    pickButton.textContent = "Escolher PDF assinado";

    const fileName = document.createElement("span");
    fileName.className = "workflow-file-name-fix";
    fileName.textContent = "Nenhum arquivo selecionado";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, pickButton, fileName);
    complete.disabled = true;

    pickButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      input.click();
    });

    input.addEventListener("change", event => {
      event.stopPropagation();
      const file = input.files?.[0];
      fileName.textContent = file ? file.name : "Nenhum arquivo selecionado";
      complete.disabled = !file;
    });

    for (const eventName of ["click", "pointerdown", "mousedown", "touchstart"]) {
      wrapper.addEventListener(eventName, event => event.stopPropagation());
    }
  }

  function scan() {
    document.querySelectorAll(".workflow-state").forEach(enhance);
  }

  function init() {
    installStyles();
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
