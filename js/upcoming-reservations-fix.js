'use strict';
(() => {
  const grid = document.getElementById('reservationGrid');
  if (!grid) return;

  const parsePtBrDate = value => {
    const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
  };

  const localToday = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function refreshUpcomingVisibility() {
    const today = localToday();

    grid.querySelectorAll('.reservation-card').forEach(card => {
      const badge = card.querySelector('.badge');
      const isApproved = badge?.classList.contains('approved') ||
        badge?.textContent.trim().toLowerCase() === 'aprovada';

      if (!isApproved) {
        card.hidden = false;
        return;
      }

      const textBlocks = [...card.querySelectorAll('p')].map(item => item.textContent.trim());
      const periodText = textBlocks.find(text => /\d{2}\/\d{2}\/\d{4}/.test(text));
      const startDate = parsePtBrDate(periodText);

      // Uma reserva aprovada só pertence a "Próximas reservas" antes de começar.
      // No próprio dia inicial, o veículo já aparece como reserva atual no portfólio.
      card.hidden = Boolean(startDate && startDate <= today);
    });

    const visibleCards = [...grid.querySelectorAll('.reservation-card')]
      .filter(card => !card.hidden);
    let empty = grid.querySelector('.upcoming-empty-v6');

    if (!visibleCards.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty upcoming-empty-v6';
        empty.textContent = 'Não há reservas futuras.';
        grid.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  let scheduled = false;
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refreshUpcomingVisibility();
    });
  };

  new MutationObserver(scheduleRefresh).observe(grid, {
    childList: true,
    subtree: true,
    characterData: true
  });

  refreshUpcomingVisibility();
  setInterval(refreshUpcomingVisibility, 30000);
})();
