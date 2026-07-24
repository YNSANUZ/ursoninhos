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
    const initials = getInitials(user?.name);
    const image = user?.photoUrl
      ? `<img class="${className}__image" src="${user.photoUrl}" alt="${user.name}">`
      : '';
    return `
      <span class="${className}">
        <span class="${className}__fallback">${initials}</span>
        ${image}
      </span>
    `;
  }

  function renderAccountSlot(slot) {
    if (!slot) return;
    const user = store.getCurrentUser();

    if (!user) {
      if (slot.dataset.hideGuest === 'true') {
        slot.innerHTML = '';
        return;
      }
      slot.innerHTML = '<a href="/" class="topbar__simple-link">Entrar / Cadastrar</a>';
      return;
    }

    const firstName = String(user.name || 'Cliente').split(' ')[0];
    const adminButton = user.role === 'admin'
      ? '<a href="/adm" class="topbar__adm-btn" aria-label="Abrir área administrativa">ADM</a>'
      : '';
    slot.innerHTML = `
      <div class="account-chip">
        ${adminButton}
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

    slot.querySelector('[data-account-logout]')?.addEventListener('click', async () => {
      await store.logout();
      window.location.href = '/';
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
    if (event.key && !['ursoninhos_user', 'ursoninhos_auth_token'].includes(event.key)) return;
    renderTopbarAccounts();
  });
  window.addEventListener('ursoninhos-auth-changed', renderTopbarAccounts);

  window.UrsoninhosAccountUI = {
    renderTopbarAccounts,
    getInitials,
    buildAvatarMarkup,
  };
})();
