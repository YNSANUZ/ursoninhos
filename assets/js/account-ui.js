(function () {
  const store = window.UrsoninhosStore;
  if (!store) return;

  function getInitials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?';
  }

  function buildAvatarMarkup(user, className = 'account-chip__avatar') {
    if (user?.photoUrl) {
      return `<img class="${className} ${className}--image" src="${user.photoUrl}" alt="${user.name}">`;
    }
    return `<span class="${className}">${getInitials(user?.name)}</span>`;
  }

  function renderAccountSlot(slot) {
    if (!slot) return;
    const user = store.getCurrentUser();

    if (!user) {
      if (slot.dataset.hideGuest === 'true') {
        slot.innerHTML = '';
        return;
      }
      slot.innerHTML = '<a href="index.html" class="topbar__simple-link">Entrar / Cadastrar</a>';
      return;
    }

    const firstName = String(user.name || 'Cliente').split(' ')[0];
    slot.innerHTML = `
      <div class="account-chip">
        <a href="meu-perfil.html" class="account-chip__trigger">
          ${buildAvatarMarkup(user)}
          <span class="account-chip__name">${firstName}</span>
        </a>
        <div class="account-chip__menu">
          <a href="meu-perfil.html" class="account-chip__item">Meu Perfil</a>
          <a href="carrinho.html" class="account-chip__item">Meu Carrinho</a>
          <button type="button" class="account-chip__item account-chip__item--button" data-account-logout>Sair</button>
        </div>
      </div>
    `;

    slot.querySelector('[data-account-logout]')?.addEventListener('click', () => {
      store.logout();
      window.location.href = 'index.html';
    });
  }

  function renderTopbarAccounts() {
    document.querySelectorAll('#topbarAccount').forEach(renderAccountSlot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderTopbarAccounts);
  } else {
    renderTopbarAccounts();
  }

  window.addEventListener('storage', (event) => {
    if (event.key && !['ursoninhos_users', 'ursoninhos_session'].includes(event.key)) return;
    renderTopbarAccounts();
  });

  window.UrsoninhosAccountUI = {
    renderTopbarAccounts,
    getInitials,
    buildAvatarMarkup,
  };
})();
