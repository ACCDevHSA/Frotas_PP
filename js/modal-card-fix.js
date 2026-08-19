'use strict';
(() => {
  const modal = document.getElementById('detailsModal');
  if (!modal) return;

  function closeDetails() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function openState() {
    document.body.style.overflow = 'hidden';
    const closeButton = modal.querySelector('.close');
    if (closeButton) requestAnimationFrame(() => closeButton.focus());
  }

  // Captura todos os controles de fechar, mesmo se o common.js estiver em cache.
  modal.querySelectorAll('[data-close="detailsModal"], .close').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeDetails();
    });
  });

  // Fecha ao clicar fora do cartão.
  modal.addEventListener('click', event => {
    if (event.target === modal) closeDetails();
  });

  // Fecha com Escape.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeDetails();
  });

  // Observa a abertura feita pelo fleet.js e aplica foco/trava de rolagem.
  new MutationObserver(() => {
    if (modal.classList.contains('hidden')) document.body.style.overflow = '';
    else openState();
  }).observe(modal, {attributes:true, attributeFilter:['class']});

  // Acessibilidade e sensação de botão nos cards gerados dinamicamente.
  function prepareCards() {
    document.querySelectorAll('.vehicle-card').forEach(card => {
      if (card.dataset.cardReady) return;
      card.dataset.cardReady = 'true';
      card.tabIndex = 0;
      card.setAttribute('role','button');
      card.setAttribute('aria-label','Abrir detalhes do veículo');
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.btn')) {
          event.preventDefault();
          card.click();
        }
      });
    });
  }
  prepareCards();
  const grid = document.getElementById('vehicleGrid');
  if (grid) new MutationObserver(prepareCards).observe(grid,{childList:true,subtree:true});
})();
