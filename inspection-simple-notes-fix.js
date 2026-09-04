"use strict";

/*
 * Fleet Management - avarias por clique simples (v2)
 *
 * 1o clique na bolinha:
 *   - marca em verde
 *   - cria "N. Avaria: " em Observacoes do veiculo
 *   - direciona o cursor para a nova anotacao
 *
 * 2o clique na mesma bolinha:
 *   - desmarca
 *   - remove a anotacao vinculada
 *   - renumera as demais anotacoes
 *
 * Carregar DEPOIS de inspection-2d-upgrade.js.
 */
(() => {
  const POINT_PREFIX = "fleet-damage-point-";
  let clickLock = false;

  const $ = (id) => document.getElementById(id);

  function notify(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function notesField() {
    return document.querySelector('#inspectionForm [name="vehicle_notes"]');
  }

  function installStyles() {
    if ($("simpleDamageToggleStyles")) return;

    const style = document.createElement("style");
    style.id = "simpleDamageToggleStyles";
    style.textContent = `
      /* As imagens e os cards nunca aumentam. */
      .vehicle-view,
      .vehicle-view:hover,
      .vehicle-view:focus-within,
      .vehicle-view-image,
      .vehicle-view:hover .vehicle-view-image,
      .vehicle-view:focus-within .vehicle-view-image {
        transform: none !important;
        scale: 1 !important;
        transition: none !important;
      }

      /* Somente a bolinha sobe levemente. */
      button.damage-dot {
        transition: transform .14s ease,
          background-color .14s ease,
          box-shadow .14s ease !important;
      }

      button.damage-dot:hover,
      button.damage-dot:focus-visible {
        transform: translate(-50%, calc(-50% - 4px)) !important;
        scale: 1 !important;
        outline: none !important;
        box-shadow: 0 0 0 5px rgb(232 61 85 / 20%),
          0 8px 14px rgb(0 0 0 / 26%) !important;
      }

      button.damage-dot.simple-marked,
      button.damage-dot.simple-marked:hover,
      button.damage-dot.simple-marked:focus-visible {
        background: #45c78f !important;
        color: #08151f !important;
        box-shadow: 0 0 0 5px rgb(69 199 143 / 22%),
          0 8px 14px rgb(0 0 0 / 24%) !important;
      }

      /* O editor antigo nao e utilizado neste fluxo. */
      #damage2dPopover,
      .damage2d-popover {
        display: none !important;
      }

      #inspectionForm [name="vehicle_notes"].damage-notes-focus {
        border-color: var(--success, #43ce98) !important;
        box-shadow: 0 0 0 3px rgb(67 206 152 / 16%) !important;
      }

      .simple-damage-summary {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
        color: var(--muted);
        font-size: .74rem;
      }
    `;

    document.head.appendChild(style);
  }

  function readLines() {
    return (notesField()?.value || "").split("\n");
  }

  function isDamageLine(line) {
    return /^\s*\d+\.\s*Avaria\s*:/i.test(line);
  }

  function damageLines() {
    return readLines().filter(isDamageLine);
  }

  function manualLines() {
    return readLines().filter((line) => !isDamageLine(line));
  }

  function renumberDamageLines(lines) {
    return lines.map((line, index) => {
      const content = line.replace(/^\s*\d+\.\s*Avaria\s*:\s*/i, "");
      return `${index + 1}. Avaria: ${content}`;
    });
  }

  function writeNotes(manual, damages) {
    const notes = notesField();
    if (!notes) return;

    const cleanManual = manual.filter((line, index, all) => {
      if (line.trim()) return true;
      return index > 0 && index < all.length - 1;
    });

    notes.value = [...cleanManual, ...renumberDamageLines(damages)]
      .join("\n")
      .replace(/^\n+|\n+$/g, "");

    notes.dispatchEvent(new Event("input", { bubbles: true }));
    notes.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markedDotsInOrder() {
    return [...document.querySelectorAll(".damage-dot.simple-marked")]
      .sort((a, b) => Number(a.dataset.damageOrder) - Number(b.dataset.damageOrder));
  }

  function synchronizeDotNumbers() {
    markedDotsInOrder().forEach((dot, index) => {
      dot.dataset.damageOrder = String(index + 1);
      dot.textContent = String(index + 1);
      dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: Avaria ${index + 1}`;
    });
  }

  function updateSummary() {
    const container = document.querySelector(".damage-area");
    if (!container) return;

    let summary = $("simpleDamageSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "simpleDamageSummary";
      summary.className = "simple-damage-summary";
      container.appendChild(summary);
    }

    const total = document.querySelectorAll(".damage-dot.simple-marked").length;
    summary.innerHTML = `<span>Pontos marcados: <b>${total}</b></span><span>Proximo clique: <b>${total + 1}. Avaria:</b></span>`;
  }

  function focusNewLine() {
    const notes = notesField();
    if (!notes) return;

    notes.classList.add("damage-notes-focus");
    notes.focus({ preventScroll: true });
    notes.setSelectionRange(notes.value.length, notes.value.length);
    notes.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => notes.classList.remove("damage-notes-focus"), 1200);
  }

  function mark(dot) {
    const existingDamages = damageLines();
    const nextNumber = existingDamages.length + 1;

    dot.classList.add("simple-marked");
    dot.dataset.damageOrder = String(nextNumber);
    dot.dataset.damagePointKey = `${POINT_PREFIX}${dot.dataset.pointId || nextNumber}`;

    existingDamages.push(`${nextNumber}. Avaria: `);
    writeNotes(manualLines(), existingDamages);
    synchronizeDotNumbers();
    updateSummary();
    focusNewLine();

    notify(`${dot.dataset.label || "Ponto"} marcado. Digite a avaria nas observacoes.`);
  }

  function unmark(dot) {
    const order = Number(dot.dataset.damageOrder);
    const existingDamages = damageLines();

    if (Number.isInteger(order) && order > 0 && order <= existingDamages.length) {
      existingDamages.splice(order - 1, 1);
    }

    dot.classList.remove("simple-marked");
    delete dot.dataset.damageOrder;
    delete dot.dataset.damagePointKey;
    dot.textContent = "+";
    dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: adicionar avaria`;

    writeNotes(manualLines(), existingDamages);
    synchronizeDotNumbers();
    updateSummary();

    notify(`${dot.dataset.label || "Ponto"} desmarcado e anotacao removida.`);
  }

  function toggle(dot) {
    if (dot.classList.contains("simple-marked")) unmark(dot);
    else mark(dot);
  }

  /*
   * pointerdown executa antes do click do inspection-2d-upgrade.js.
   * O click seguinte e bloqueado para que o popup antigo nao abra.
   */
  window.addEventListener("pointerdown", (event) => {
    const dot = event.target.closest?.(".damage-dot");
    if (!dot) return;

    event.preventDefault();
    event.stopPropagation();
    clickLock = true;
    toggle(dot);
  }, true);

  window.addEventListener("click", (event) => {
    const dot = event.target.closest?.(".damage-dot");
    if (!dot || !clickLock) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clickLock = false;
  }, true);

  function resetVisualState() {
    document.querySelectorAll(".damage-dot.simple-marked").forEach((dot) => {
      dot.classList.remove("simple-marked");
      delete dot.dataset.damageOrder;
      delete dot.dataset.damagePointKey;
      dot.textContent = "+";
      dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: adicionar avaria`;
    });
    updateSummary();
  }

  function init() {
    installStyles();
    resetVisualState();
    updateSummary();

    /* Novo checklist sempre inicia sem marcacoes visuais. */
    const modal = $("inspectionModal");
    if (modal) {
      const observer = new MutationObserver(() => {
        if (!modal.classList.contains("hidden")) {
          window.setTimeout(() => {
            resetVisualState();
            const notes = notesField();
            if (notes && !notes.value.trim()) notes.value = "";
          }, 30);
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
