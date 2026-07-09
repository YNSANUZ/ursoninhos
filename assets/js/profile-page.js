(function () {
  const store = window.UrsoninhosStore;
  const accountUI = window.UrsoninhosAccountUI;
  if (!store || !accountUI) return;

  const profileSidebarAvatar = document.getElementById('profileSidebarAvatar');
  const profileSidebarName = document.getElementById('profileSidebarName');
  const profileSidebarEmail = document.getElementById('profileSidebarEmail');
  const profileNameInput = document.getElementById('profileNameInput');
  const profileEmailInput = document.getElementById('profileEmailInput');
  const profilePhotoInput = document.getElementById('profilePhotoInput');
  const profileAddressText = document.getElementById('profileAddressText');
  const profileSaveNote = document.getElementById('profileSaveNote');
  const profileForm = document.getElementById('profileForm');
  const profileLogoutBtn = document.getElementById('profileLogoutBtn');

  function formatAddress(address) {
    if (!address) return 'Nenhum endereco cadastrado ainda.';
    const complement = address.complement ? ` - ${address.complement}` : '';
    return `${address.street}, ${address.number}${complement} — ${address.neighborhood}, ${address.city}/${address.state} — CEP ${address.cep}`;
  }

  function renderUser() {
    const user = store.getCurrentUser();

    if (!user) {
      if (profileSidebarAvatar) profileSidebarAvatar.textContent = '?';
      if (profileSidebarName) profileSidebarName.textContent = 'Visitante';
      if (profileSidebarEmail) profileSidebarEmail.textContent = 'Entre pelo site principal para acessar sua conta.';
      if (profileAddressText) profileAddressText.textContent = 'Nenhum endereco cadastrado ainda.';
      if (profileForm) profileForm.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      return;
    }

    if (profileSidebarAvatar) {
      profileSidebarAvatar.innerHTML = user.photoUrl
        ? `<img src="${user.photoUrl}" alt="${user.name}">`
        : accountUI.buildAvatarMarkup(user, 'profile-sidebar__avatar-badge');
    }
    if (profileSidebarName) profileSidebarName.textContent = user.name;
    if (profileSidebarEmail) profileSidebarEmail.textContent = user.email;
    if (profileNameInput) profileNameInput.value = user.name || '';
    if (profileEmailInput) profileEmailInput.value = user.email || '';
    if (profilePhotoInput) profilePhotoInput.value = user.photoUrl || '';
    if (profileAddressText) profileAddressText.textContent = formatAddress(user.address);
  }

  document.querySelectorAll('[data-profile-section]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.profileSection;
      document.querySelectorAll('[data-profile-section]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-section]').forEach((panel) => {
        panel.hidden = panel.dataset.section !== section;
      });
    });
  });

  profileForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = store.getCurrentUser();
    if (!user) return;

    store.updateCurrentUser({
      name: profileNameInput?.value.trim() || user.name,
      photoUrl: profilePhotoInput?.value.trim() || '',
    });

    if (profileSaveNote) profileSaveNote.textContent = 'Perfil salvo com sucesso.';
    accountUI.renderTopbarAccounts();
    renderUser();
  });

  profileLogoutBtn?.addEventListener('click', () => {
    store.logout();
    window.location.href = 'index.html';
  });

  accountUI.renderTopbarAccounts();
  renderUser();
})();
