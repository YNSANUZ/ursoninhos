(function () {
  const store = window.UrsoninhosStore;
  const accountUI = window.UrsoninhosAccountUI;
  if (!store || !accountUI) return;

  const profileSidebarAvatar = document.getElementById('profileSidebarAvatar');
  const profileSidebarName = document.getElementById('profileSidebarName');
  const profileSidebarEmail = document.getElementById('profileSidebarEmail');
  const profileNameInput = document.getElementById('profileNameInput');
  const profileEmailInput = document.getElementById('profileEmailInput');
  const profileCpfInput = document.getElementById('profileCpfInput');
  const profilePhoneInput = document.getElementById('profilePhoneInput');
  const profilePhotoInput = document.getElementById('profilePhotoInput');
  const profileAdminAccess = document.getElementById('profileAdminAccess');
  const ADMIN_EMAILS = ['ynsanuz@gmail.com', 'obstruir#gmail.com'];

  function isAuthorizedAdmin(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    return ADMIN_EMAILS.includes(email);
  }

  function maskCpf(value) {
    return String(value).replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }

  function maskPhone(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  profileCpfInput?.addEventListener('input', () => { profileCpfInput.value = maskCpf(profileCpfInput.value); });
  profilePhoneInput?.addEventListener('input', () => { profilePhoneInput.value = maskPhone(profilePhoneInput.value); });
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
      if (profileAdminAccess) profileAdminAccess.hidden = true;
      if (profileForm) profileForm.querySelectorAll('input').forEach((input) => { input.disabled = true; });
      return;
    }

    if (profileSidebarAvatar) {
      profileSidebarAvatar.innerHTML = accountUI.buildAvatarMarkup(user, 'profile-sidebar__avatar-badge');
    }
    if (profileSidebarName) profileSidebarName.textContent = user.name;
    if (profileSidebarEmail) profileSidebarEmail.textContent = user.email;
    if (profileNameInput) profileNameInput.value = user.name || '';
    if (profileEmailInput) profileEmailInput.value = user.email || '';
    if (profileCpfInput) profileCpfInput.value = maskCpf(user.cpf || '');
    if (profilePhoneInput) profilePhoneInput.value = maskPhone(user.phone || '');
    if (profilePhotoInput) profilePhotoInput.value = user.photoUrl || '';
    if (profileAddressText) profileAddressText.textContent = formatAddress(user.address);
    if (profileAdminAccess) profileAdminAccess.hidden = !isAuthorizedAdmin(user);
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

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = store.getCurrentUser();
    if (!user) return;

    const result = await store.updateCurrentUser({
      name: profileNameInput?.value.trim() || user.name,
      cpf: (profileCpfInput?.value || '').replace(/\D/g, ''),
      phone: (profilePhoneInput?.value || '').replace(/\D/g, ''),
      photoUrl: profilePhotoInput?.value.trim() || '',
    });

    if (!result?.ok) {
      if (profileSaveNote) profileSaveNote.textContent = result?.error || 'Nao foi possivel salvar o perfil.';
      return;
    }
    if (profileSaveNote) profileSaveNote.textContent = 'Perfil salvo com sucesso.';
    accountUI.renderTopbarAccounts();
    renderUser();
  });

  profileLogoutBtn?.addEventListener('click', async () => {
    await store.logout();
    window.location.href = 'index.html';
  });

  accountUI.renderTopbarAccounts();
  renderUser();
  window.addEventListener('ursoninhos-auth-changed', renderUser);
})();
