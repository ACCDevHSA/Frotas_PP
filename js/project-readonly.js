'use strict';
(() => {
  function configureProjectField() {
    const form = document.getElementById('requestForm');
    if (!form) return;
    const projectInput = form.elements.project;
    if (!projectInput || projectInput.dataset.readonlyReady === 'true') return;

    projectInput.dataset.readonlyReady = 'true';
    projectInput.readOnly = true;
    projectInput.setAttribute('aria-readonly', 'true');
    projectInput.setAttribute('tabindex', '-1');
    projectInput.classList.add('readonly-project-field');
    projectInput.autocomplete = 'off';
    projectInput.title = 'Projeto definido automaticamente pelo veículo selecionado';

    const label = projectInput.closest('label');
    if (label) {
      label.classList.add('readonly-project-label');
      const textNode = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = 'Projeto do veículo ';
      if (!label.querySelector('.readonly-project-hint')) {
        const hint = document.createElement('small');
        hint.className = 'readonly-project-hint';
        hint.textContent = 'Preenchido automaticamente';
        projectInput.insertAdjacentElement('afterend', hint);
      }
    }

    // Impede alteração por colagem, teclas ou scripts de preenchimento automático.
    const preserveValue = () => {
      const selectedVehicle = typeof selected !== 'undefined' ? selected : null;
      if (selectedVehicle?.project != null) projectInput.value = selectedVehicle.project;
    };
    projectInput.addEventListener('beforeinput', event => event.preventDefault());
    projectInput.addEventListener('paste', event => event.preventDefault());
    projectInput.addEventListener('drop', event => event.preventDefault());
    projectInput.addEventListener('change', preserveValue);
  }

  configureProjectField();
  const modal = document.getElementById('requestModal');
  if (modal) {
    new MutationObserver(configureProjectField).observe(modal, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
  }
})();
