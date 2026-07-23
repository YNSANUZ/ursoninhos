/* =========================================================
   Ursoninhos — notifications.js
   Sino de notificações do cabeçalho (home). Aparece apenas
   para usuários logados; a bolinha vermelha conta os avisos
   pendentes:
     - "Atualize seus dados": perfil sem CPF/celular/endereço
       (típico de quem entrou só com o Google) -> meu-perfil.
     - "Instale o atalho do site": oferece instalar o site
       como app/atalho na área de trabalho (PWA). Some depois
       de instalado ou dispensado.
   ========================================================= */
(function () {
  const store = window.UrsoninhosStore;
  const wrap = document.getElementById('topbarNotif');
  const bellBtn = document.getElementById('notifBellBtn');
  const badge = document.getElementById('notifBadge');
  const panel = document.getElementById('notifPanel');
  if (!store || !wrap || !bellBtn || !badge || !panel) return;

  const DISMISSED_KEY = 'ursoninhos_notif_dismissed';

  // O Chrome/Edge dispara este evento quando o site pode ser instalado;
  // guardamos o prompt para disparar no clique da notificação.
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    dismiss('install-shortcut');
  });

  function loadDismissed() {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function dismiss(id) {
    const dismissed = loadDismissed();
    if (!dismissed.includes(id)) dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    refresh();
  }

  function buildNotifications(user) {
    const dismissed = loadDismissed();
    const list = [];

    const missing = store.getMissingProfileFields(user);
    if (missing.length) {
      list.push({
        id: 'complete-profile',
        title: 'Atualize seus dados',
        text: `Falta preencher: ${missing.join(', ')}. Complete seu perfil para comprar mais rápido.`,
        actionLabel: 'Completar perfil',
        onAction: () => { window.location.href = 'meu-perfil.html'; },
        dismissable: false,
      });
    }

    if (!dismissed.includes('install-shortcut')) {
      list.push({
        id: 'install-shortcut',
        title: 'Instale o atalho do site',
        text: installPrompt
          ? 'Adicione a Ursoninhos na sua área de trabalho com um clique.'
          : 'No menu do navegador, use "Instalar Ursoninhos" para criar o atalho.',
        actionLabel: installPrompt ? 'Instalar agora' : 'Entendi',
        onAction: () => {
          if (installPrompt) {
            installPrompt.prompt();
            installPrompt = null;
          } else {
            dismiss('install-shortcut');
          }
        },
        dismissable: true,
      });
    }

    return list;
  }

  function renderPanel(notifications) {
    if (!notifications.length) {
      panel.innerHTML = '<p class="notif-panel__empty">Nenhuma notificação por aqui. 🐻</p>';
      return;
    }

    panel.innerHTML = notifications.map((item) => `
      <div class="notif-item" data-notif-id="${item.id}">
        <strong>${item.title}</strong>
        <p>${item.text}</p>
        <div class="notif-item__actions">
          <button type="button" class="notif-item__action" data-notif-action="${item.id}">${item.actionLabel}</button>
          ${item.dismissable ? `<button type="button" class="notif-item__dismiss" data-notif-dismiss="${item.id}">Dispensar</button>` : ''}
        </div>
      </div>
    `).join('');

    panel.querySelectorAll('[data-notif-action]').forEach((button) => {
      const item = notifications.find((entry) => entry.id === button.dataset.notifAction);
      button.addEventListener('click', () => item?.onAction());
    });
    panel.querySelectorAll('[data-notif-dismiss]').forEach((button) => {
      button.addEventListener('click', () => dismiss(button.dataset.notifDismiss));
    });
  }

  function refresh() {
    const user = store.getCurrentUser();

    if (!user) {
      wrap.hidden = true;
      panel.hidden = true;
      return;
    }

    const notifications = buildNotifications(user);
    wrap.hidden = false;
    badge.hidden = notifications.length === 0;
    badge.textContent = String(notifications.length);
    renderPanel(notifications);
  }

  bellBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !wrap.contains(event.target)) panel.hidden = true;
  });

  window.UrsoninhosNotifications = { refresh };
  refresh();
})();
