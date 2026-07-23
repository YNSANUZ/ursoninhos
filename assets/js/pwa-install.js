/* =========================================================
   Ursoninhos — pwa-install.js
   Fonte ÚNICA do prompt de instalação do PWA. Captura o evento
   "beforeinstallprompt" (Chrome/Edge) e mostra os gatilhos de
   instalar (qualquer elemento com [data-pwa-install]) só quando o
   site realmente pode ser instalado. Some depois de instalado.

   Carregue ANTES de notifications.js — o sino de notificações lê
   window.UrsoninhosPWA em vez de capturar o evento por conta
   própria (senão dois handlers brigariam pelo mesmo prompt).
   ========================================================= */
(function () {
  let deferredPrompt = null;
  let installed = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function updateVisibility() {
    // A classe no <body> liga/desliga todos os gatilhos via CSS.
    document.body.classList.toggle('pwa-installable', !!deferredPrompt && !installed);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateVisibility();
    // Mantém o sino de notificações em dia.
    window.UrsoninhosNotifications?.refresh?.();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    updateVisibility();
    window.UrsoninhosNotifications?.refresh?.();
  });

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (error) { /* usuário fechou */ }
    deferredPrompt = null; // o prompt só pode ser usado uma vez
    updateVisibility();
    window.UrsoninhosNotifications?.refresh?.();
    return true;
  }

  // Qualquer elemento [data-pwa-install] dispara o prompt ao clicar.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-pwa-install]');
    if (!trigger) return;
    event.preventDefault();
    promptInstall();
  });

  window.UrsoninhosPWA = {
    canInstall: () => !!deferredPrompt && !installed,
    promptInstall,
  };

  if (isStandalone()) installed = true;
  updateVisibility();
})();
