(function () {
  const store = window.UrsoninhosStore;
  const ENABLED_KEY = 'ursoninhos_admin_order_alarm_enabled';
  const ALERTED_KEY = 'ursoninhos_admin_order_alerted_ids';
  const POLL_MS = 20000;
  let audioContext = null;
  let pollTimer = null;
  let polling = false;

  const apiUrl = () => `${window.URSONINHOS_APP_CONFIG?.backendBaseUrl || ''}/admin-orders.php`;
  const isAdmin = () => store?.getCurrentUser?.()?.role === 'admin';

  function readIds() {
    try {
      const value = JSON.parse(localStorage.getItem(ALERTED_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function saveIds(ids) {
    localStorage.setItem(ALERTED_KEY, JSON.stringify(ids.slice(-200)));
  }

  function alarmEnabled() {
    return localStorage.getItem(ENABLED_KEY) === '1';
  }

  async function activate() {
    localStorage.setItem(ENABLED_KEY, '1');
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      playAlarm(true);
    } catch (error) { /* notificacao visual continua disponível */ }
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (error) { /* navegador sem suporte */ }
    }
    document.dispatchEvent(new CustomEvent('ursoninhos-order-alarm-state', { detail: { enabled: true } }));
    return true;
  }

  function tone(context, start, frequency) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.24, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  }

  function playAlarm(shortTest = false) {
    if (!alarmEnabled()) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime + 0.03;
      tone(audioContext, now, 880);
      if (!shortTest) {
        tone(audioContext, now + 0.38, 1046);
        tone(audioContext, now + 0.76, 1318);
      }
    } catch (error) { /* alerta visual continua */ }
  }

  function showToast(order) {
    document.querySelector('.admin-order-alarm-toast')?.remove();
    const toast = document.createElement('aside');
    toast.className = 'admin-order-alarm-toast';
    toast.innerHTML = `
      <strong>🔔 Nova compra aprovada!</strong>
      <span>${escapeHtml(order.id)} — ${formatBRL(order.amount)}</span>
      <a href="pedidos-admin.html">Abrir pedido</a>
      <button type="button" aria-label="Fechar aviso">×</button>
    `;
    toast.querySelector('button')?.addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function formatBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function notify(order) {
    playAlarm();
    showToast(order);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification('Nova compra aprovada — Ursoninhos', {
          body: `${order.id} • ${formatBRL(order.amount)}. Toque para preparar o pedido.`,
          icon: 'assets/img/icon-192.png',
          tag: `ursoninhos-order-${order.id}`,
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = 'pedidos-admin.html';
          notification.close();
        };
      } catch (error) { /* alerta sonoro e toast permanecem */ }
    }
  }

  async function poll() {
    if (polling || !isAdmin() || !apiUrl()) return null;
    polling = true;
    try {
      const response = await fetch(apiUrl(), {
        cache: 'no-store',
        headers: store.getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Falha ao consultar pedidos.');
      const payload = await response.json();
      const alerted = readIds();
      const fresh = (payload.orders || []).filter((order) =>
        order.status === 'approved' && order.adminAlertPending && !alerted.includes(order.id)
      );
      fresh.reverse().forEach(notify);
      if (fresh.length) saveIds([...alerted, ...fresh.map((order) => order.id)]);
      document.dispatchEvent(new CustomEvent('ursoninhos-admin-orders', { detail: payload }));
      return payload;
    } catch (error) {
      document.dispatchEvent(new CustomEvent('ursoninhos-admin-orders-error', { detail: { message: error.message } }));
      return null;
    } finally {
      polling = false;
    }
  }

  function start() {
    clearInterval(pollTimer);
    if (!isAdmin()) return;
    poll();
    pollTimer = window.setInterval(poll, POLL_MS);
  }

  window.addEventListener('ursoninhos-auth-changed', start);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poll();
  });
  window.UrsoninhosAdminOrderAlerts = { activate, alarmEnabled, playAlarm, poll, start };
  start();
})();
