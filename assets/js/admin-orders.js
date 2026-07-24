(function () {
  const store = window.UrsoninhosStore;
  const list = document.getElementById('adminOrdersList');
  if (!store || !list) return;

  const statusEl = document.getElementById('ordersConnectionStatus');
  const notice = document.getElementById('ordersNotice');
  const filter = document.getElementById('ordersFilter');
  const search = document.getElementById('ordersSearch');
  const alertButton = document.getElementById('enableOrderAlertsBtn');
  let orders = [];

  const apiUrl = () => `${window.URSONINHOS_APP_CONFIG?.backendBaseUrl || ''}/admin-orders.php`;
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';

  const productionLabels = {
    new: 'Novo — preparar',
    preparing: 'Separando pedido',
    printing: 'Em impressão',
    quality_check: 'Conferência de qualidade',
    shipped: 'Enviado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    awaiting_payment: 'Aguardando pagamento',
  };

  function setNotice(message, error = false) {
    notice.hidden = !message;
    notice.textContent = message || '';
    notice.classList.toggle('is-error', error);
  }

  function sideLabel(side) {
    return ({ front: 'Frente', back: 'Costas', sleeveLeft: 'Manga esquerda', sleeveRight: 'Manga direita' })[side] || side;
  }

  function customizationMarkup(item, itemIndex) {
    const snapshot = item.customizationSnapshot;
    if (!snapshot) return '<p class="admin-order__warning">Este item não possui snapshot de personalização.</p>';
    const previews = snapshot.previewViews || {};
    const previewCards = Object.entries({
      front: previews.front || snapshot.previewImage,
      back: previews.back,
      right: previews.right,
      left: previews.left,
    }).filter(([, src]) => src).map(([side, src]) => `
      <figure>
        <img src="${escapeHtml(src)}" alt="Prévia ${escapeHtml(side)}">
        <figcaption>
          ${escapeHtml(sideLabel(side))}
          <a href="${escapeHtml(src)}" download="${escapeHtml(item.id || `arte-${itemIndex}`)}-${escapeHtml(side)}.png">Baixar</a>
        </figcaption>
      </figure>
    `).join('');

    const textLines = [];
    Object.entries(snapshot.layersBySide || {}).forEach(([side, layers]) => {
      (layers || []).forEach((layer) => {
        const text = layer.textData?.text || (layer.textData?.lines || []).join(' ');
        if (text) textLines.push(`<li><strong>${escapeHtml(sideLabel(side))}:</strong> ${escapeHtml(text)}</li>`);
      });
    });

    return `
      <div class="admin-order__customization">
        <p><strong>Tamanho:</strong> ${escapeHtml(snapshot.size || '')} · <strong>Hash:</strong> ${escapeHtml(snapshot.contentHash || 'não informado')}</p>
        ${previewCards ? `<div class="admin-order__previews">${previewCards}</div>` : ''}
        ${textLines.length ? `<div><strong>Textos:</strong><ul>${textLines.join('')}</ul></div>` : ''}
      </div>
    `;
  }

  function itemMarkup(item, index) {
    return `
      <article class="admin-order__item">
        <div>
          <strong>${Number(item.quantity || 1)}× ${escapeHtml(item.title || 'Produto')}</strong>
          <span>${escapeHtml(item.description || '')}</span>
          <span>${formatBRL(item.unit_price || item.unitPrice)}</span>
        </div>
        ${customizationMarkup(item, index)}
      </article>
    `;
  }

  function orderMarkup(order) {
    const paid = order.status === 'approved';
    const address = order.address || {};
    const payer = order.payer || {};
    return `
      <article class="admin-order-card${order.adminAlertPending ? ' is-new' : ''}" data-order-id="${escapeHtml(order.id)}">
        <header>
          <div>
            <span class="admin-order__badge ${paid ? 'is-paid' : 'is-pending'}">${paid ? 'PAGO' : escapeHtml(order.status)}</span>
            ${order.environment !== 'production' ? '<span class="admin-order__badge is-test">TESTE</span>' : ''}
            <h2>${escapeHtml(order.id)}</h2>
            <p>${formatDate(order.createdAt)} · ${formatBRL(order.amount)}</p>
          </div>
          <strong>${escapeHtml(productionLabels[order.fulfillmentStatus] || order.fulfillmentStatus)}</strong>
        </header>

        <details ${order.adminAlertPending ? 'open' : ''}>
          <summary>Ver cliente, endereço, artes e produção</summary>
          <div class="admin-order__grid">
            <section>
              <h3>Cliente</h3>
              <p>${escapeHtml(payer.name)}<br>${escapeHtml(payer.email)}<br>${escapeHtml(payer.phone)}<br>CPF: ${escapeHtml(payer.cpf)}</p>
            </section>
            <section>
              <h3>Entrega</h3>
              <p>${escapeHtml(address.street)}, ${escapeHtml(address.number)} ${escapeHtml(address.complement)}<br>
              ${escapeHtml(address.neighborhood)} — ${escapeHtml(address.city)}/${escapeHtml(address.state)}<br>
              CEP ${escapeHtml(address.cep)}</p>
            </section>
            <section>
              <h3>Pagamento</h3>
              <p>Status: ${escapeHtml(order.status)}<br>ID: ${escapeHtml(order.paymentId)}<br>Pago: ${formatBRL(order.paidAmount)}</p>
            </section>
          </div>

          <div class="admin-order__items">${(order.items || []).map(itemMarkup).join('')}</div>

          <form class="admin-order__form">
            <label><span>Etapa</span>
              <select name="fulfillmentStatus" ${paid ? '' : 'disabled'}>
                ${Object.entries(productionLabels).filter(([key]) => key !== 'awaiting_payment').map(([key, label]) =>
                  `<option value="${key}" ${order.fulfillmentStatus === key ? 'selected' : ''}>${label}</option>`
                ).join('')}
              </select>
            </label>
            <label><span>Transportadora</span><input name="shippingCarrier" value="${escapeHtml(order.shippingCarrier)}" placeholder="Correios, Jadlog…"></label>
            <label><span>Código de rastreio</span><input name="trackingCode" value="${escapeHtml(order.trackingCode)}"></label>
            <label class="admin-order__notes"><span>Observações internas</span><textarea name="adminNotes" rows="3">${escapeHtml(order.adminNotes)}</textarea></label>
            <div class="admin-order__actions">
              ${order.adminAlertPending ? '<button type="button" class="btn btn--outline" data-acknowledge>Marcar como visto</button>' : ''}
              <button type="submit" class="btn btn--gold" ${paid ? '' : 'disabled'}>Salvar etapa</button>
            </div>
          </form>
        </details>
      </article>
    `;
  }

  function filteredOrders() {
    const term = String(search?.value || '').toLocaleLowerCase('pt-BR');
    const selected = filter?.value || 'all';
    return orders.filter((order) => {
      const production = ['new', 'preparing', 'printing', 'quality_check'].includes(order.fulfillmentStatus);
      const matchesFilter = selected === 'all'
        || (selected === 'new' && order.fulfillmentStatus === 'new' && order.status === 'approved')
        || (selected === 'production' && production)
        || (selected === 'shipped' && ['shipped', 'completed'].includes(order.fulfillmentStatus))
        || (selected === 'pending' && order.status !== 'approved')
        || (selected === 'test' && order.environment !== 'production');
      const haystack = [order.id, order.payer?.name, order.payer?.email, order.payer?.phone]
        .join(' ').toLocaleLowerCase('pt-BR');
      return matchesFilter && (!term || haystack.includes(term));
    });
  }

  function updateSummary() {
    document.getElementById('ordersNewCount').textContent = orders.filter((order) => order.status === 'approved' && order.fulfillmentStatus === 'new').length;
    document.getElementById('ordersProductionCount').textContent = orders.filter((order) => ['preparing', 'printing', 'quality_check'].includes(order.fulfillmentStatus)).length;
    document.getElementById('ordersShippedCount').textContent = orders.filter((order) => ['shipped', 'completed'].includes(order.fulfillmentStatus)).length;
    document.getElementById('ordersPendingCount').textContent = orders.filter((order) => order.status !== 'approved').length;
  }

  function render() {
    updateSummary();
    const visible = filteredOrders();
    list.innerHTML = visible.length
      ? visible.map(orderMarkup).join('')
      : '<p class="catalog-placeholder">Nenhum pedido encontrado neste filtro.</p>';
    bindCards();
  }

  async function mutate(body) {
    const response = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...store.getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Não foi possível atualizar o pedido.');
    const index = orders.findIndex((order) => order.id === payload.order.id);
    if (index >= 0) orders[index] = payload.order;
    render();
    return payload.order;
  }

  function bindCards() {
    list.querySelectorAll('.admin-order-card').forEach((card) => {
      const orderId = card.dataset.orderId;
      card.querySelector('[data-acknowledge]')?.addEventListener('click', async () => {
        try {
          await mutate({ action: 'acknowledge', orderId });
          setNotice(`Pedido ${orderId} marcado como visto.`);
        } catch (error) { setNotice(error.message, true); }
      });
      card.querySelector('form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await mutate({
            action: 'update_fulfillment',
            orderId,
            fulfillmentStatus: form.get('fulfillmentStatus'),
            shippingCarrier: form.get('shippingCarrier'),
            trackingCode: form.get('trackingCode'),
            adminNotes: form.get('adminNotes'),
          });
          setNotice(`Etapa do pedido ${orderId} salva.`);
        } catch (error) { setNotice(error.message, true); }
      });
    });
  }

  async function load() {
    const user = store.getCurrentUser();
    if (!user || user.role !== 'admin') {
      list.innerHTML = '<p class="catalog-placeholder">Entre com um perfil administrador para ver os pedidos.</p>';
      statusEl.textContent = 'Acesso restrito';
      return;
    }
    statusEl.textContent = 'Atualizando…';
    try {
      const response = await fetch(apiUrl(), { headers: store.getAuthHeaders() });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Falha ao consultar pedidos.');
      orders = payload.orders || [];
      statusEl.textContent = `Atualizado às ${new Date(payload.serverTime).toLocaleTimeString('pt-BR')}`;
      render();
    } catch (error) {
      statusEl.textContent = 'Sem conexão';
      setNotice(error.message || 'Não foi possível consultar os pedidos.', true);
    }
  }

  document.addEventListener('ursoninhos-admin-orders', (event) => {
    orders = event.detail?.orders || [];
    statusEl.textContent = `Atualizado às ${new Date(event.detail?.serverTime || Date.now()).toLocaleTimeString('pt-BR')}`;
    if (!document.activeElement?.matches('input, textarea, select')) render();
  });
  document.addEventListener('ursoninhos-admin-orders-error', () => { statusEl.textContent = 'Falha na conexão'; });
  filter?.addEventListener('change', render);
  search?.addEventListener('input', render);
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', load);
  alertButton?.addEventListener('click', async () => {
    await window.UrsoninhosAdminOrderAlerts?.activate?.();
    alertButton.textContent = '🔔 Alarme ativo';
    setNotice('Alarme ativado neste aparelho. Você ouviu um toque de teste.');
  });
  if (window.UrsoninhosAdminOrderAlerts?.alarmEnabled?.()) alertButton.textContent = '🔔 Alarme ativo';
  window.addEventListener('ursoninhos-auth-changed', load);
  load();
})();
