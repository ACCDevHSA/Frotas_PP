"use strict";

/*
 * Fleet Management - correcao do salvamento de avarias do visualizador 3D.
 * Carregar DEPOIS de inspection-upgrade.js.
 */
(() => {
  let saving = false;

  function showMessage(message) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 3200);
      return;
    }
    window.alert(message);
  }

  function normalize(value) {
    return String(value || "").trim();
  }

  function appendObservation(part, description) {
    const notes = document.querySelector('#inspectionForm [name="vehicle_notes"]');
    if (!notes) return;

    const line = `[AVARIA - ${part}] ${description}`;
    const existingLines = normalize(notes.value)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!existingLines.includes(line)) existingLines.push(line);
    notes.value = existingLines.join("\n");
    notes.dispatchEvent(new Event("input", { bubbles: true }));
    notes.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markActivePoint() {
    /* O visualizador original ja altera a cor quando conclui normalmente.
       Esta classe oferece tambem uma confirmacao visual no popup. */
    const editor = document.querySelector(".damage-comment");
    if (!editor) return;
    editor.dataset.saved = "true";
  }

  function closeFloatingEditor() {
    const editor = document.querySelector(".damage-comment");
    if (editor) {
      editor.classList.add("hidden");
      editor.dataset.saved = "false";
    }
  }

  function saveDamageSafely(event) {
    const button = event.target.closest("#saveFloatingDamage");
    if (!button) return;

    /* Impede a rotina anterior de executar junto e provocar duplicidade/trava. */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (saving) return;
    saving = true;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Salvando...";

    try {
      const part = normalize(document.getElementById("floatingDamagePart")?.textContent);
      const description = normalize(document.getElementById("floatingDamageText")?.value);

      if (!part) throw new Error("Selecione novamente um ponto do veiculo.");
      if (!description) throw new Error("Descreva a avaria antes de salvar.");

      const legacyEditor = document.getElementById("damageEditor");
      const legacyPart = document.getElementById("damagePart");
      const legacyDescription = document.getElementById("damageDescription");
      const legacyAddButton = document.getElementById("addDamage");

      if (!legacyEditor || !legacyDescription || !legacyAddButton) {
        throw new Error("O formulario de avarias nao foi encontrado.");
      }

      /* Preenche a interface original. O app.js continua sendo a unica fonte
         que altera o array damages enviado ao Supabase. */
      legacyEditor.dataset.part = part;
      if (legacyPart) legacyPart.textContent = part;
      legacyDescription.value = description;

      /* click() chama o handler original do app.js e atualiza damageList. */
      legacyAddButton.click();

      const list = document.getElementById("damageList");
      const savedInList = list && [...list.querySelectorAll(".damage-item")]
        .some((item) => item.textContent.includes(part) && item.textContent.includes(description));

      if (!savedInList) {
        throw new Error("A avaria nao entrou na lista. Atualize app.js e tente novamente.");
      }

      appendObservation(part, description);
      markActivePoint();
      closeFloatingEditor();
      showMessage("Avaria salva na lista e nas observacoes.");
    } catch (error) {
      console.error("Erro ao salvar avaria:", error);
      showMessage(error.message || "Nao foi possivel salvar a avaria.");
    } finally {
      saving = false;
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  /* Captura antes do listener instalado pelo inspection-upgrade.js. */
  document.addEventListener("click", saveDamageSafely, true);
})();
