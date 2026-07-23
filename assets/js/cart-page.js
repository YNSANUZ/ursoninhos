(function () {
  const store = window.UrsoninhosStore;
  if (!store) return;

  const PAYMENT_STORAGE_KEY = 'ursoninhos_checkout_payment';
  const PENDING_ORDER_STORAGE_KEY = 'ursoninhos_pending_order';
  const HERO_EDITOR_RESUME_KEY = 'ursoninhos_resume_editor';
  const steps = ['cart', 'auth', 'address', 'review', 'payment'];
  const paymentCopy = {
    mercadopago: {
      title: 'Checkout transparente Mercado Pago',
      text: 'Escolha Pix, cartao ou boleto abaixo sem sair do Ursoninhos.',
    },
  };

  let currentStep = 'cart';
  let selectedItemLineId = null;
  let selectedPayment = 'mercadopago';
  let paymentBrickController = null;
  let paymentSession = null;
  let paymentBrickLoading = false;

  const checkoutCartCount = document.getElementById('checkoutCartCount');
  const checkoutItems = document.getElementById('checkoutItems');
  const summaryItems = document.getElementById('summaryItems');
  const summaryCustomer = document.getElementById('summaryCustomer');
  const summaryAddress = document.getElementById('summaryAddress');
  const summaryPayment = document.getElementById('summaryPayment');
  const summaryTotal = document.getElementById('summaryTotal');
  const loggedUserCard = document.getElementById('loggedUserCard');
  const guestAuthSection = document.getElementById('guestAuthSection');
  const checkoutLoginForm = document.getElementById('checkoutLoginForm');
  const checkoutRegisterForm = document.getElementById('checkoutRegisterForm');
  const checkoutLoginError = document.getElementById('checkoutLoginError');
  const checkoutRegisterError = document.getElementById('checkoutRegisterError');
  const checkoutAddressForm = document.getElementById('checkoutAddressForm');
  const checkoutAddressError = document.getElementById('checkoutAddressError');
  const checkoutCepInput = document.getElementById('checkoutCepInput');
  const checkoutStreetInput = document.getElementById('checkoutStreetInput');
  const checkoutNeighborhoodInput = document.getElementById('checkoutNeighborhoodInput');
  const checkoutCityInput = document.getElementById('checkoutCityInput');
  const checkoutStateInput = document.getElementById('checkoutStateInput');
  const checkoutCepStatus = document.getElementById('checkoutCepStatus');
  const checkoutRegisterCpfInput = document.getElementById('checkoutRegisterCpfInput');
  const checkoutRegisterPhoneInput = document.getElementById('checkoutRegisterPhoneInput');
  const reviewItemsList = document.getElementById('reviewItemsList');
  const reviewAddressText = document.getElementById('reviewAddressText');
  const paymentChoices = document.getElementById('paymentChoices');
  const paymentVisualTitle = document.getElementById('paymentVisualTitle');
  const paymentVisualText = document.getElementById('paymentVisualText');
  const checkoutPaymentError = document.getElementById('checkoutPaymentError');
  const paymentBrickContainer = document.getElementById('paymentBrick_container');
  const successOrderNumber = document.getElementById('successOrderNumber');
  const successOrderTitle = document.getElementById('successOrderTitle');
  const successOrderStatus = document.getElementById('successOrderStatus');
  const paymentResultDetails = document.getElementById('paymentResultDetails');
  const itemDetailImage = document.getElementById('itemDetailImage');
  const itemDetailTitle = document.getElementById('itemDetailTitle');
  const itemDetailSize = document.getElementById('itemDetailSize');
  const itemDetailQuantity = document.getElementById('itemDetailQuantity');
  const itemDetailPrice = document.getElementById('itemDetailPrice');
  const itemDetailTotal = document.getElementById('itemDetailTotal');
  const itemDetailPreview = document.getElementById('itemDetailPreview');
  const itemDetailViews = document.getElementById('itemDetailViews');
  const CARD_MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';
  const CARD_MOCKUP_BACK_URL = 'assets/img/camisa-modelo-card-back.jpg';
  const previewCache = new Map();
  const PRINT_CENTER_X = 0.478;
  const PRINT_TOP_Y = 0.30;
  const PRINT_SIZE = 0.34;
  let renderToken = 0;
  let selectedDetailView = 'front';

  function isValidCpf(rawCpf) {
    const cpf = String(rawCpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digit = (count) => {
      let sum = 0;
      for (let i = 0; i < count; i += 1) sum += Number(cpf[i]) * (count + 1 - i);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
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

  function getCheckoutMissingFields(user = getUser()) {
    if (!user) return ['login'];
    return store.getMissingProfileFields?.(user) || [];
  }

  function hasCheckoutProfile(user = getUser()) {
    return Boolean(user) && getCheckoutMissingFields(user).length === 0;
  }

  function nextCheckoutStepForUser(user = getUser()) {
    if (!user) return 'auth';
    if (!hasCheckoutProfile(user)) return 'auth';
    if (!user.address) return 'address';
    return 'review';
  }

  function isAddressField(field) {
    return String(field || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'endereco';
  }

  function getCart() {
    return store.loadCart();
  }

  function getUser() {
    return store.getCurrentUser();
  }

  function formatAddress(address) {
    if (!address) return 'Pendente';
    const complement = address.complement ? ` - ${address.complement}` : '';
    return `${address.street}, ${address.number}${complement} — ${address.neighborhood}, ${address.city}/${address.state} — CEP ${address.cep}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function isCustomShirt(item) {
    return String(item.productId || '').startsWith('camisa-personalizada::');
  }

  function isEditableCustomShirt(item) {
    return isCustomShirt(item) && item.metadata?.editorSource === 'home-customizer' && item.metadata?.editorState;
  }

  function isShareablePublicProduct(item) {
    return String(item.productId || '').startsWith('publico::') || item.metadata?.source === 'public-model';
  }

  function getSharePath(item) {
    if (!isShareablePublicProduct(item)) return '';
    const productPath = item.metadata?.productPath || '';
    if (productPath) return productPath;
    const key = item.metadata?.productId || String(item.productId || '').replace(/^publico::/, '');
    return window.UrsoninhosApi?.getProductPath?.(key) || '';
  }

  async function shareCartItem(item) {
    const path = getSharePath(item);
    if (!path) return;
    const shareUrl = path.startsWith('http') ? path : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
    const text = `${item.title} por ${store.formatBRL(item.price)}\n${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: `${item.title} por ${store.formatBRL(item.price)}`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      const activeItem = selectedItemLineId ? getCart().find((entry) => entry.lineId === selectedItemLineId) : null;
      if (checkoutPaymentError && activeItem?.lineId === item.lineId) {
        checkoutPaymentError.textContent = 'Link do produto copiado para compartilhar.';
      }
    } catch (error) {
      console.error('Nao foi possivel compartilhar o produto:', error);
    }
  }

  function isShirtItem(item) {
    const productId = String(item.productId || '').toLowerCase();
    const title = String(item.title || '').toLowerCase();
    return productId.includes('camisa') || title.includes('camisa');
  }

  function getPreferredPreviewSide(item) {
    if (item.metadata?.preferredPreviewSide && item.previewViews?.[item.metadata.preferredPreviewSide]) {
      return item.metadata.preferredPreviewSide;
    }
    const editorSide = item.metadata?.editorState?.activeSide;
    if (editorSide === 'back' && item.previewViews?.back) return 'back';
    if (editorSide === 'sleeveRight' && item.previewViews?.right) return 'right';
    if (editorSide === 'sleeveLeft' && item.previewViews?.left) return 'left';
    if (item.previewViews?.front) return 'front';
    if (item.previewViews?.back) return 'back';
    if (item.previewViews?.right) return 'right';
    if (item.previewViews?.left) return 'left';

    const sides = item.metadata?.sideSelections || {};
    if (sides.front !== null && sides.front !== undefined) return 'front';
    if (sides.back !== null && sides.back !== undefined) return 'back';
    if (sides.sleeveRight !== null && sides.sleeveRight !== undefined) return 'right';
    if (sides.sleeveLeft !== null && sides.sleeveLeft !== undefined) return 'left';
    return 'front';
  }

  function getPreviewLabel(side) {
    const labels = {
      front: 'Vista salva: frente',
      back: 'Vista salva: costas',
      right: 'Vista salva: manga direita',
      left: 'Vista salva: manga esquerda',
    };
    return labels[side] || 'Preview salvo';
  }

  function hasBackPrint(item) {
    if (item.previewViews?.back) return true;
    const backFile = item.metadata?.printsBySide?.back?.file;
    return Boolean(backFile);
  }

  function getAvailableDetailViews(item) {
    if (!isShirtItem(item)) return ['front'];
    return ['front', 'back'];
  }

  function getDefaultDetailView(item) {
    if (getPreferredPreviewSide(item) === 'back' && hasBackPrint(item)) return 'back';
    return 'front';
  }

  async function buildShirtMockup(printUrl, transform = {}, blend = 'screen', baseUrl = CARD_MOCKUP_URL) {
    const cacheKey = JSON.stringify({ printUrl, transform, blend, baseUrl });
    if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);

    const promise = (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');

      const base = await loadImage(baseUrl);
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

      if (printUrl) {
        const printImage = await loadImage(printUrl);
        const scale = Number(transform.scale || 1);
        const offsetX = Number(transform.offsetX || 0);
        const offsetY = Number(transform.offsetY || 0);
        const printWidth = canvas.width * PRINT_SIZE * scale;
        const printHeight = canvas.height * PRINT_SIZE * scale;
        const x = canvas.width * PRINT_CENTER_X - printWidth / 2 + offsetX * 10;
        const y = canvas.height * PRINT_TOP_Y + offsetY * 10;
        ctx.globalCompositeOperation = blend === 'screen' ? 'screen' : 'source-over';
        ctx.drawImage(printImage, x, y, printWidth, printHeight);
        ctx.globalCompositeOperation = 'source-over';
      }

      return canvas.toDataURL('image/jpeg', 0.9);
    })().catch((error) => {
      console.error('Nao foi possivel compor a miniatura da camisa:', error);
      return printUrl || baseUrl || CARD_MOCKUP_URL;
    });

    previewCache.set(cacheKey, promise);
    return promise;
  }

  async function resolveDetailViewPreview(item, view) {
    if (view === 'back') {
      if (isCustomShirt(item)) {
        const backPrintUrl = item.metadata?.printsBySide?.back?.file || '';
        const backTransform = item.metadata?.transforms?.back || {};
        const backBlend = item.metadata?.printsBySide?.back?.blend || 'screen';
        return buildShirtMockup(backPrintUrl, backTransform, backBlend, CARD_MOCKUP_BACK_URL);
      }
      if (isShirtItem(item)) {
        return CARD_MOCKUP_BACK_URL;
      }
    }

    if (isCustomShirt(item) && item.metadata?.frontPrintUrl) {
      const frontTransform = item.metadata?.transforms?.front || item.metadata?.frontTransform || {};
      const frontBlend = item.metadata?.frontPrintBlend || 'screen';
      return buildShirtMockup(item.metadata.frontPrintUrl, frontTransform, frontBlend);
    }
    return item.previewImage || item.previewViews?.front || 'assets/img/banner-estatico.jpg';
  }

  function syncDetailViewButtons(item) {
    if (!itemDetailViews) return;
    const availableViews = getAvailableDetailViews(item);
    itemDetailViews.hidden = availableViews.length < 2;
    itemDetailViews.querySelectorAll('[data-detail-view]').forEach((button) => {
      const view = button.dataset.detailView;
      button.hidden = !availableViews.includes(view);
      button.classList.toggle('is-active', view === selectedDetailView);
    });
  }

  async function resolveCartPreview(item) {
    const preferredSide = getPreferredPreviewSide(item);
    const preferredPreview = item.previewViews?.[preferredSide] ||
      item.previewViews?.front ||
      item.previewImage ||
      'assets/img/banner-estatico.jpg';
    if (!isCustomShirt(item)) return preferredPreview;
    if (!item.metadata?.frontPrintUrl) return item.previewImage || preferredPreview;

    const printUrl = item.metadata.frontPrintUrl;
    const transform = item.metadata?.transforms?.front || item.metadata?.frontTransform || {};
    const blend = item.metadata?.frontPrintBlend || 'screen';
    return buildShirtMockup(printUrl, transform, blend);
  }

  function resumeEditing(item) {
    if (!isEditableCustomShirt(item)) return;
    try {
      localStorage.setItem(HERO_EDITOR_RESUME_KEY, JSON.stringify(item.metadata.editorState));
      window.location.href = 'index.html#hero';
    } catch (error) {
      console.error('Nao foi possivel retomar a edicao da camisa:', error);
    }
  }

  function applyPreviewToImage(imgEl, src, item) {
    if (!imgEl || !src) return;
    imgEl.src = src;
    imgEl.alt = `${item.title} no mockup de camisa`;
  }

  async function hydrateCartPreviews(cartSnapshot, token) {
    await Promise.all(cartSnapshot.map(async (item) => {
      const src = await resolveCartPreview(item);
      if (token !== renderToken) return;

      const selector = `[data-preview-line-id="${CSS.escape(item.lineId)}"]`;
      document.querySelectorAll(selector).forEach((imgEl) => applyPreviewToImage(imgEl, src, item));

      if (selectedItemLineId === item.lineId) {
        renderItemDetail(item.lineId, { keepSelectedView: true });
      }
    }));
  }

  function getUnlockedSteps() {
    const cart = getCart();
    const user = getUser();
    const hasAddress = Boolean(user?.address);
    const hasPayment = Boolean(selectedPayment);
    const hasProfile = hasCheckoutProfile(user);

    return {
      cart: true,
      auth: cart.length > 0,
      address: cart.length > 0 && Boolean(user),
      review: cart.length > 0 && Boolean(user) && hasAddress,
      payment: cart.length > 0 && Boolean(user) && hasAddress && hasProfile,
      success: cart.length > 0 && Boolean(user) && hasAddress && hasProfile && hasPayment,
    };
  }

  function goToStep(step) {
    if (step === 'payment' && !hasCheckoutProfile(getUser())) {
      currentStep = 'auth';
      goToStep('auth');
      return;
    }

    const unlocked = getUnlockedSteps();
    if (step !== 'cart' && !unlocked[step]) return;

    const previousStep = currentStep;
    currentStep = step;
    if (previousStep === 'payment' && step !== 'payment') destroyPaymentBrick();
    steps.forEach((entry) => {
      const panel = document.getElementById(`stage${entry.charAt(0).toUpperCase()}${entry.slice(1)}`);
      if (panel) panel.hidden = entry !== step;
    });

    document.getElementById('stageSuccess').hidden = true;

    document.querySelectorAll('.checkout-step').forEach((button) => {
      const stepName = button.dataset.step;
      button.classList.toggle('is-active', stepName === step);
      button.classList.toggle('is-unlocked', Boolean(unlocked[stepName]));
      button.classList.toggle('is-locked', !unlocked[stepName]);
    });

    if (step === 'review') renderReview();
    if (step === 'payment') {
      if (!hasCheckoutProfile(getUser())) {
        currentStep = 'auth';
        goToStep('auth');
        return;
      }
      renderPaymentSelection();
      renderTransparentCheckout();
    }
  }

  function renderSummary() {
    const cart = getCart();
    const user = getUser();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (checkoutCartCount) checkoutCartCount.textContent = String(totalItems);
    if (summaryItems) summaryItems.textContent = String(totalItems);
    if (summaryCustomer) summaryCustomer.textContent = user ? user.name : 'Visitante';
    if (summaryAddress) summaryAddress.textContent = user?.address ? 'Preenchido' : 'Pendente';
    if (summaryPayment) summaryPayment.textContent = selectedPayment === 'mercadopago' ? 'Mercado Pago' : 'Pendente';
    if (summaryTotal) summaryTotal.textContent = store.formatBRL(store.getCartTotal());
  }

  async function renderItemDetail(lineId, options = {}) {
    const { keepSelectedView = false } = options;
    const item = getCart().find((entry) => entry.lineId === lineId) || getCart()[0];
    if (!item) return;

    selectedItemLineId = item.lineId;
    if (!keepSelectedView) {
      selectedDetailView = getDefaultDetailView(item);
    }
    syncDetailViewButtons(item);

    const viewSrc = await resolveDetailViewPreview(item, selectedDetailView);
    if (itemDetailImage) {
      itemDetailImage.src = viewSrc;
      itemDetailImage.alt = `${item.title} selecionado`;
    }
    if (itemDetailTitle) itemDetailTitle.textContent = item.title;
    if (itemDetailSize) itemDetailSize.textContent = item.size || 'Nao informado';
    if (itemDetailQuantity) itemDetailQuantity.textContent = String(item.quantity);
    if (itemDetailPrice) itemDetailPrice.textContent = store.formatBRL(item.price);
    if (itemDetailTotal) itemDetailTotal.textContent = store.formatBRL(item.price * item.quantity);
    if (itemDetailPreview) itemDetailPreview.textContent = item.previewImage ? getPreviewLabel(selectedDetailView) : 'Sem preview';
  }

  function renderCartItems() {
    const cart = getCart();

    if (!checkoutItems) return;

    if (!cart.length) {
      checkoutItems.innerHTML = `
        <div class="checkout-empty">
          <p>Seu carrinho esta vazio.</p>
          <a href="index.html#hero" class="btn btn--gold">Voltar para personalizar</a>
        </div>
      `;
      return;
    }

    renderToken += 1;
    const token = renderToken;

    checkoutItems.innerHTML = cart.map((item) => `
      <article class="checkout-item" data-line-id="${item.lineId}">
        <button type="button" class="checkout-item__preview" data-action="detail">
          <img
            src="${item.previewImage || item.previewViews?.front || 'assets/img/banner-estatico.jpg'}"
            alt="${escapeHtml(item.title)}"
            data-preview-line-id="${escapeHtml(item.lineId)}"
          >
        </button>
        <div class="checkout-item__meta">
          <h3>${item.title}</h3>
          <div class="checkout-item__specs">
            ${item.variantLabel ? `<span class="checkout-pill">${item.variantLabel}</span>` : ''}
            ${item.size ? `<span class="checkout-pill">Tamanho ${item.size}</span>` : ''}
            <span class="checkout-pill">Qtd. ${item.quantity}</span>
          </div>
          <div class="checkout-item__actions">
            <button type="button" class="checkout-link-btn" data-action="detail">Ver detalhes</button>
            ${isShareablePublicProduct(item) ? '<button type="button" class="checkout-link-btn" data-action="share">Compartilhar</button>' : ''}
            ${isEditableCustomShirt(item) ? '<button type="button" class="checkout-link-btn" data-action="resume">Continuar edição</button>' : ''}
            <button type="button" class="checkout-link-btn" data-action="remove">Remover</button>
          </div>
        </div>
        <div class="checkout-item__side">
          <span class="checkout-item__unit">${store.formatBRL(item.price)} cada</span>
          <div class="qty-stepper">
            <button type="button" data-action="decrease">−</button>
            <input type="number" value="${item.quantity}" min="1" data-action="qty-input">
            <button type="button" data-action="increase">+</button>
          </div>
          <strong class="checkout-item__total">${store.formatBRL(item.price * item.quantity)}</strong>
        </div>
      </article>
    `).join('');

    checkoutItems.querySelectorAll('.checkout-item').forEach((itemEl) => {
      const lineId = itemEl.dataset.lineId;
      // O card inteiro abre os detalhes; só ficam de fora os controles de
      // quantidade (+, − e o campo digitável) e o botão de remover.
      itemEl.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="increase"], [data-action="decrease"], [data-action="qty-input"], [data-action="remove"], [data-action="resume"], [data-action="share"]')) return;
        renderItemDetail(lineId);
      });
      itemEl.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
        const cartItem = getCart().find((entry) => entry.lineId === lineId);
        if (!cartItem) return;
        await shareCartItem(cartItem);
      });
      itemEl.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
        const cartItem = getCart().find((entry) => entry.lineId === lineId);
        if (!cartItem) return;
        resumeEditing(cartItem);
      });
      itemEl.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        store.removeCartItem(lineId);
        renderAll();
      });
      itemEl.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
        const cartItem = getCart().find((entry) => entry.lineId === lineId);
        if (!cartItem) return;
        store.updateCartItemQuantity(lineId, cartItem.quantity + 1);
        renderAll();
      });
      itemEl.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
        const cartItem = getCart().find((entry) => entry.lineId === lineId);
        if (!cartItem) return;
        store.updateCartItemQuantity(lineId, cartItem.quantity - 1);
        renderAll();
      });
      itemEl.querySelector('[data-action="qty-input"]')?.addEventListener('change', (event) => {
        const value = Math.max(1, parseInt(event.target.value || '1', 10) || 1);
        store.updateCartItemQuantity(lineId, value);
        renderAll();
      });
    });

    renderItemDetail(selectedItemLineId || cart[0].lineId);
    hydrateCartPreviews(cart, token);
  }

  itemDetailViews?.querySelectorAll('[data-detail-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.detailView;
      if (!view || !selectedItemLineId) return;
      selectedDetailView = view;
      renderItemDetail(selectedItemLineId, { keepSelectedView: true });
    });
  });

  function renderAuthState() {
    const user = getUser();
    if (loggedUserCard) {
      loggedUserCard.hidden = !user;
      if (!user) {
        loggedUserCard.innerHTML = '';
      } else {
        const missingFields = getCheckoutMissingFields(user);
        const needsProfile = missingFields.length > 0;
        loggedUserCard.innerHTML = `
          <strong>${user.name}</strong>
          <p>${user.email}</p>
          ${needsProfile ? `<p>Para concluir a compra, complete: ${missingFields.join(', ')}.</p>` : '<p>Seu cadastro ja esta pronto para seguir com a compra.</p>'}
          ${needsProfile ? `
            <form class="checkout-form" id="checkoutProfileForm">
              <div class="checkout-grid-2">
                <label class="form-field">
                  <span>CPF</span>
                  <input type="text" name="cpf" id="checkoutProfileCpfInput" inputmode="numeric" value="${escapeHtml(maskCpf(user.cpf || ''))}" placeholder="000.000.000-00" required>
                </label>
                <label class="form-field">
                  <span>Celular</span>
                  <input type="text" name="phone" id="checkoutProfilePhoneInput" inputmode="tel" value="${escapeHtml(maskPhone(user.phone || ''))}" placeholder="(00) 00000-0000" required>
                </label>
              </div>
              <p class="form-error" id="checkoutProfileError"></p>
              <div class="checkout-nav">
                <button type="submit" class="btn btn--gold">Salvar e continuar</button>
              </div>
            </form>
          ` : ''}
          <div class="checkout-nav"><button type="button" class="btn btn--outline" id="checkoutLogoutBtn">Sair</button></div>
        `;
      }
    }

    if (guestAuthSection) guestAuthSection.hidden = Boolean(user);
    document.getElementById('goToAddressBtn')?.toggleAttribute('hidden', !user || !hasCheckoutProfile(user));

    document.getElementById('checkoutLogoutBtn')?.addEventListener('click', async () => {
      await store.logout();
      renderAll();
      goToStep('auth');
    });

    const checkoutProfileCpfInput = document.getElementById('checkoutProfileCpfInput');
    const checkoutProfilePhoneInput = document.getElementById('checkoutProfilePhoneInput');
    const checkoutProfileError = document.getElementById('checkoutProfileError');

    checkoutProfileCpfInput?.addEventListener('input', () => {
      checkoutProfileCpfInput.value = maskCpf(checkoutProfileCpfInput.value);
    });
    checkoutProfilePhoneInput?.addEventListener('input', () => {
      checkoutProfilePhoneInput.value = maskPhone(checkoutProfilePhoneInput.value);
    });

    document.getElementById('checkoutProfileForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const cpf = String(checkoutProfileCpfInput?.value || '').replace(/\D/g, '');
      const phone = String(checkoutProfilePhoneInput?.value || '').replace(/\D/g, '');

      if (!isValidCpf(cpf)) {
        if (checkoutProfileError) checkoutProfileError.textContent = 'CPF invalido. Confira os numeros digitados.';
        return;
      }

      if (phone.length < 10) {
        if (checkoutProfileError) checkoutProfileError.textContent = 'Informe um celular valido com DDD.';
        return;
      }

      const result = await store.updateCurrentUser({ cpf, phone });
      if (!result?.ok) {
        if (checkoutProfileError) checkoutProfileError.textContent = result?.error || 'Nao foi possivel salvar o cadastro.';
        return;
      }

      if (checkoutProfileError) checkoutProfileError.textContent = '';
      renderAll();
      goToStep(nextCheckoutStepForUser(result.user));
    });
  }

  function fillAddressForm(address) {
    if (!checkoutAddressForm) return;
    checkoutAddressForm.cep.value = address?.cep || '';
    checkoutAddressForm.number.value = address?.number || '';
    checkoutAddressForm.street.value = address?.street || '';
    checkoutAddressForm.complement.value = address?.complement || '';
    checkoutAddressForm.neighborhood.value = address?.neighborhood || '';
    checkoutAddressForm.city.value = address?.city || '';
    checkoutAddressForm.state.value = address?.state || '';
  }

  function renderReview() {
    const cart = getCart();
    const user = getUser();
    if (reviewItemsList) {
      reviewItemsList.innerHTML = cart.map((item) => `
        <p class="address-display">${item.quantity}x ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ''} — ${store.formatBRL(item.price * item.quantity)}</p>
      `).join('');
    }
    if (reviewAddressText) reviewAddressText.textContent = formatAddress(user?.address);
  }

  function renderPaymentSelection() {
    const missingFields = getCheckoutMissingFields(getUser()).filter((field) => !isAddressField(field));
    paymentChoices?.querySelectorAll('.payment-choice').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.method === selectedPayment);
    });

    if (missingFields.length) {
      if (paymentVisualTitle) paymentVisualTitle.textContent = 'Complete seu cadastro';
      if (paymentVisualText) paymentVisualText.textContent = `Antes de pagar, preencha: ${missingFields.join(', ')} na etapa de login / cadastro.`;
      return;
    }

    const copy = paymentCopy[selectedPayment] || {
      title: 'Checkout transparente Mercado Pago',
      text: 'Carregando as formas de pagamento seguras.',
    };
    if (paymentVisualTitle) paymentVisualTitle.textContent = copy.title;
    if (paymentVisualText) paymentVisualText.textContent = copy.text;
  }

  async function lookupCep(cep) {
    if (!checkoutCepStatus) return;
    checkoutCepStatus.textContent = 'Buscando endereco...';
    checkoutCepStatus.classList.remove('is-error', 'is-success');

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (!response.ok || data.erro) {
        checkoutCepStatus.textContent = 'CEP nao encontrado.';
        checkoutCepStatus.classList.add('is-error');
        return;
      }

      if (checkoutStreetInput) checkoutStreetInput.value = data.logradouro || '';
      if (checkoutNeighborhoodInput) checkoutNeighborhoodInput.value = data.bairro || '';
      if (checkoutCityInput) checkoutCityInput.value = data.localidade || '';
      if (checkoutStateInput) checkoutStateInput.value = data.uf || '';
      checkoutCepStatus.textContent = 'Endereco encontrado.';
      checkoutCepStatus.classList.add('is-success');
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      checkoutCepStatus.textContent = 'Nao foi possivel buscar o CEP agora.';
      checkoutCepStatus.classList.add('is-error');
    }
  }

  function renderAll() {
    renderSummary();
    renderCartItems();
    renderAuthState();
    fillAddressForm(getUser()?.address || null);
    renderPaymentSelection();
    updateCartPrimaryButton();

    const cart = getCart();
    if (!cart.length && currentStep !== 'cart') {
      goToStep('cart');
    } else {
      goToStep(currentStep);
    }
  }

  document.querySelectorAll('.checkout-step').forEach((button) => {
    button.addEventListener('click', () => goToStep(button.dataset.step));
  });

  document.querySelectorAll('[data-goto-step]').forEach((button) => {
    button.addEventListener('click', () => goToStep(button.dataset.gotoStep));
  });

  function updateCartPrimaryButton() {
    const button = document.getElementById('goToAuthBtn');
    if (!button) return;
    const user = getUser();
    const missingFields = getCheckoutMissingFields(user);

    if (!user) {
      button.textContent = 'Continuar para login';
      return;
    }

    if (missingFields.length) {
      button.textContent = 'Completar cadastro';
      return;
    }

    button.textContent = user.address ? 'Revisar compra' : 'Continuar para entrega';
  }

  document.getElementById('goToAuthBtn')?.addEventListener('click', () => {
    goToStep(nextCheckoutStepForUser());
  });
  document.getElementById('goToAddressBtn')?.addEventListener('click', () => goToStep('address'));
  document.getElementById('goToPaymentBtn')?.addEventListener('click', () => goToStep('payment'));

  const checkoutGoogleButton = document.getElementById('googleLoginBtn');
  const checkoutGoogleContainer = document.getElementById('googleSigninContainer');

  async function finishGoogleCheckout(credential) {
    const result = await store.loginWithGoogle(credential);
    if (!result?.ok) {
      if (checkoutLoginError) checkoutLoginError.textContent = result?.error || 'Nao foi possivel concluir o login com Google.';
      return;
    }
    renderAll();
    goToStep(nextCheckoutStepForUser(result.user));
  }

  function setupCheckoutGoogleSignin() {
    const clientId = window.URSONINHOS_APP_CONFIG?.googleClientId;
    if (!clientId || !checkoutGoogleContainer) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          try {
            const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            finishGoogleCheckout(response.credential);
          } catch (error) {
            if (checkoutLoginError) checkoutLoginError.textContent = 'Nao foi possivel concluir o login com Google.';
          }
        },
      });
      window.google.accounts.id.renderButton(checkoutGoogleContainer, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        text: 'signin_with',
        locale: 'pt-BR',
      });
      if (checkoutGoogleButton) checkoutGoogleButton.hidden = true;
    };
    document.head.appendChild(script);
  }

  checkoutGoogleButton?.addEventListener('click', () => {
    if (checkoutLoginError) checkoutLoginError.textContent = 'Login com Google ainda nao configurado. Use e-mail e senha por enquanto.';
  });
  setupCheckoutGoogleSignin();

  checkoutRegisterCpfInput?.addEventListener('input', () => {
    checkoutRegisterCpfInput.value = maskCpf(checkoutRegisterCpfInput.value);
  });
  checkoutRegisterPhoneInput?.addEventListener('input', () => {
    checkoutRegisterPhoneInput.value = maskPhone(checkoutRegisterPhoneInput.value);
  });

  checkoutLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutLoginForm);
    const result = await store.login(formData.get('email'), formData.get('password'));
    if (!result.ok) {
      if (checkoutLoginError) checkoutLoginError.textContent = result.error;
      return;
    }
    if (checkoutLoginError) checkoutLoginError.textContent = '';
    renderAll();
    goToStep(nextCheckoutStepForUser(result.user));
  });

  checkoutRegisterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutRegisterForm);
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const cpf = String(formData.get('cpf') || '').replace(/\D/g, '');
    const phone = String(formData.get('phone') || '').replace(/\D/g, '');
    if (password !== confirmPassword) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = 'As senhas nao coincidem.';
      return;
    }

    if (!isValidCpf(cpf)) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = 'CPF invalido. Confira os numeros digitados.';
      return;
    }

    if (phone.length < 10) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = 'Informe um celular valido com DDD.';
      return;
    }

    const result = await store.register({
      name: formData.get('name'),
      email: formData.get('email'),
      cpf,
      phone,
      password,
    });

    if (!result.ok) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = result.error;
      return;
    }

    if (checkoutRegisterError) checkoutRegisterError.textContent = '';
    renderAll();
    goToStep(nextCheckoutStepForUser(result.user));
  });

  checkoutCepInput?.addEventListener('input', () => {
    const digits = checkoutCepInput.value.replace(/\D/g, '').slice(0, 8);
    checkoutCepInput.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    if (digits.length === 8) lookupCep(digits);
  });

  checkoutAddressForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutAddressForm);
    const address = {
      cep: String(formData.get('cep') || '').trim(),
      number: String(formData.get('number') || '').trim(),
      street: String(formData.get('street') || '').trim(),
      complement: String(formData.get('complement') || '').trim(),
      neighborhood: String(formData.get('neighborhood') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      state: String(formData.get('state') || '').trim().toUpperCase(),
    };

    if (!address.cep || !address.number || !address.street || !address.neighborhood || !address.city || !address.state) {
      if (checkoutAddressError) checkoutAddressError.textContent = 'Preencha os campos obrigatorios.';
      return;
    }

    const result = await store.updateCurrentUser({ address });
    if (!result?.ok) {
      if (checkoutAddressError) checkoutAddressError.textContent = result?.error || 'Nao foi possivel salvar o endereco.';
      return;
    }
    if (checkoutAddressError) checkoutAddressError.textContent = '';
    renderAll();
    goToStep('review');
  });

  function destroyPaymentBrick() {
    if (!paymentBrickController) return;
    Promise.resolve(paymentBrickController.unmount()).catch(() => {});
    paymentBrickController = null;
    if (paymentBrickContainer) paymentBrickContainer.innerHTML = '';
  }

  function paymentApiBaseUrl() {
    return window.URSONINHOS_APP_CONFIG?.paymentsBaseUrl
      || window.URSONINHOS_APP_CONFIG?.backendBaseUrl
      || '';
  }

  async function readApiJson(response) {
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('O servidor devolveu uma resposta invalida.');
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Falha na comunicacao com o servidor.');
    }
    return payload;
  }

  function checkoutItemPayload(item) {
    return {
      id: String(item.productId || item.lineId || 'produto'),
      title: String(item.title || 'Produto Ursoninhos'),
      description: [item.variantLabel, item.size ? `Tamanho ${item.size}` : ''].filter(Boolean).join(' - '),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.price || 0),
    };
  }

  async function createCheckoutSession() {
    if (paymentSession) return paymentSession;
    const baseUrl = paymentApiBaseUrl();
    const cart = getCart();
    const user = getUser();
    if (!baseUrl || !cart.length || !user?.email || !user?.address) {
      throw new Error('Revise o carrinho, o login e o endereco antes de pagar.');
    }

    const response = await fetch(`${baseUrl}/create-checkout-session.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...store.getAuthHeaders(),
      },
      body: JSON.stringify({
        items: cart.map(checkoutItemPayload),
        payer: {
          name: user.name,
          email: user.email,
          cpf: user.cpf || '',
          phone: user.phone || '',
          registrationDate: user.createdAt || '',
        },
        address: user.address,
      }),
    });
    const payload = await readApiJson(response);
    if (Array.isArray(payload.items)) {
      const serverPrices = new Map(payload.items.map((item) => [String(item.id), Number(item.unitPrice)]));
      let changed = false;
      const correctedCart = cart.map((item) => {
        const trustedPrice = serverPrices.get(String(item.productId || item.lineId || 'produto'));
        if (!Number.isFinite(trustedPrice) || trustedPrice === Number(item.price)) return item;
        changed = true;
        return { ...item, price: trustedPrice };
      });
      if (changed) {
        store.saveCart(correctedCart);
        renderSummary();
        renderCartItems();
      }
    }
    paymentSession = payload.order;
    localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify({ orderId: payload.order.id }));
    return paymentSession;
  }

  function payerInitialization(user) {
    const nameParts = String(user?.name || '').trim().split(/\s+/).filter(Boolean);
    return {
      email: user?.email || '',
      firstName: nameParts.shift() || '',
      lastName: nameParts.join(' '),
      address: {
        zipCode: String(user?.address?.cep || '').replace(/\D/g, ''),
        federalUnit: user?.address?.state || '',
        city: user?.address?.city || '',
        neighborhood: user?.address?.neighborhood || '',
        streetName: user?.address?.street || '',
        streetNumber: user?.address?.number || '',
        complement: user?.address?.complement || '',
      },
    };
  }

  async function processBrickPayment(formData, selectedPaymentMethod) {
    const session = await createCheckoutSession();
    const response = await fetch(`${paymentApiBaseUrl()}/process-payment.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...store.getAuthHeaders(),
      },
      body: JSON.stringify({
        orderId: session.id,
        formData,
        selectedPaymentMethod,
        deviceId: window.MP_DEVICE_SESSION_ID || '',
      }),
    });
    const payload = await readApiJson(response);
    localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify({
      orderId: payload.order.id,
      providerOrderId: payload.order.providerOrderId || '',
    }));
    showPaymentResult(payload.order, payload.instructions || {});
    return payload;
  }

  async function renderTransparentCheckout() {
    if (paymentBrickController || paymentBrickLoading || !paymentBrickContainer) return;
    const missingFields = getCheckoutMissingFields(getUser()).filter((field) => !isAddressField(field));
    if (missingFields.length) {
      destroyPaymentBrick();
      paymentBrickContainer.hidden = true;
      if (checkoutPaymentError) checkoutPaymentError.textContent = `Complete ${missingFields.join(' e ')} na etapa de login / cadastro antes de pagar.`;
      return;
    }

    const publicKey = window.URSONINHOS_APP_CONFIG?.mercadoPagoPublicKey || '';
    paymentBrickContainer.hidden = false;
    if (!publicKey) {
      paymentBrickContainer.hidden = true;
      if (checkoutPaymentError) checkoutPaymentError.textContent = 'A Public Key do Mercado Pago ainda nao foi configurada no site.';
      if (paymentVisualTitle) paymentVisualTitle.textContent = 'Configuracao pendente';
      return;
    }
    if (!window.MercadoPago) {
      paymentBrickContainer.hidden = true;
      if (checkoutPaymentError) checkoutPaymentError.textContent = 'Nao foi possivel carregar o componente seguro do Mercado Pago.';
      return;
    }

    paymentBrickLoading = true;
    if (checkoutPaymentError) checkoutPaymentError.textContent = '';
    if (paymentVisualTitle) paymentVisualTitle.textContent = 'Carregando formas de pagamento';
    try {
      const session = await createCheckoutSession();
      const mercadoPago = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
      const bricksBuilder = mercadoPago.bricks();
      paymentBrickController = await bricksBuilder.create('payment', 'paymentBrick_container', {
        initialization: {
          amount: Number(session.amount),
          payer: payerInitialization(getUser()),
        },
        customization: {
          paymentMethods: {
            bankTransfer: 'all',
            ticket: 'all',
            creditCard: 'all',
            debitCard: 'all',
            prepaidCard: 'all',
          },
          visual: { style: { theme: 'default' } },
        },
        callbacks: {
          onReady: () => {
            paymentBrickLoading = false;
            if (paymentVisualTitle) paymentVisualTitle.textContent = 'Pagamento seguro Mercado Pago';
            if (paymentVisualText) paymentVisualText.textContent = 'Escolha Pix, cartao ou boleto para concluir seu pedido com seguranca.';
          },
          onSubmit: async ({ selectedPaymentMethod, formData }) => {
            try {
              return await processBrickPayment(formData, selectedPaymentMethod);
            } catch (error) {
              if (paymentVisualTitle) paymentVisualTitle.textContent = 'Pagamento nao concluido';
              if (checkoutPaymentError) {
                checkoutPaymentError.textContent = error?.message
                  || 'O pagamento nao foi aprovado. Confira os dados ou tente outro cartao ou forma de pagamento.';
              }
              console.error('Falha ao processar pagamento:', error);
              throw error;
            }
          },
          onError: (error) => {
            console.error('Mercado Pago Brick:', error);
            if (checkoutPaymentError) checkoutPaymentError.textContent = 'Nao foi possivel carregar ou validar a forma de pagamento.';
          },
        },
      });
    } catch (error) {
      paymentBrickLoading = false;
      paymentBrickController = null;
      paymentBrickContainer.hidden = true;
      if (checkoutPaymentError) checkoutPaymentError.textContent = error.message || 'Falha ao preparar o checkout transparente.';
      if (paymentVisualTitle) paymentVisualTitle.textContent = 'Checkout indisponivel';
    }
  }

  function addPaymentInstructions(instructions, pending, order) {
    if (!paymentResultDetails) return;
    paymentResultDetails.innerHTML = '';

    if (instructions.qrCodeBase64) {
      const image = document.createElement('img');
      image.src = `data:image/png;base64,${instructions.qrCodeBase64}`;
      image.alt = 'QR Code Pix do pedido';
      image.style.maxWidth = '260px';
      image.style.width = '100%';
      paymentResultDetails.appendChild(image);
    }

    if (instructions.qrCode) {
      const code = document.createElement('textarea');
      code.readOnly = true;
      code.value = instructions.qrCode;
      code.setAttribute('aria-label', 'Codigo Pix copia e cola');
      paymentResultDetails.appendChild(code);
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'btn btn--outline';
      copyButton.textContent = 'Copiar codigo Pix';
      copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(instructions.qrCode);
        copyButton.textContent = 'Codigo copiado';
      });
      paymentResultDetails.appendChild(copyButton);
    }

    if (instructions.digitableLine) {
      const line = document.createElement('textarea');
      line.readOnly = true;
      line.value = instructions.digitableLine;
      line.setAttribute('aria-label', 'Linha digitavel do boleto');
      paymentResultDetails.appendChild(line);
    }

    if (instructions.ticketUrl) {
      const link = document.createElement('a');
      link.href = instructions.ticketUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'btn btn--outline';
      link.textContent = 'Abrir instrucoes de pagamento';
      paymentResultDetails.appendChild(link);
    }

    if (pending) {
      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'btn btn--gold';
      refreshButton.textContent = 'Verificar pagamento';
      refreshButton.addEventListener('click', () => refreshPaymentStatus(order.id));
      paymentResultDetails.appendChild(refreshButton);

      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'btn btn--outline';
      retryButton.textContent = 'Escolher outra forma de pagamento';
      retryButton.addEventListener('click', () => {
        paymentSession = null;
        localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        goToStep('review');
      });
      paymentResultDetails.appendChild(retryButton);
    }
  }

  function showPaymentResult(order, instructions = {}) {
    const status = String(order?.status || 'pending');
    const approved = status === 'approved';
    const pending = ['created', 'checkout_ready', 'pending', 'in_process', 'authorized'].includes(status);

    destroyPaymentBrick();
    if (successOrderNumber) successOrderNumber.textContent = order?.id || '';
    if (successOrderTitle) {
      successOrderTitle.textContent = approved ? 'Pagamento aprovado' : pending ? 'Pagamento pendente' : 'Pagamento nao aprovado';
    }
    if (successOrderStatus) {
      successOrderStatus.textContent = approved
        ? 'O Mercado Pago confirmou o pagamento deste pedido.'
        : pending
          ? 'O pedido foi criado e aguarda a conclusao ou confirmacao do pagamento.'
          : 'O pagamento nao foi aprovado. Seu carrinho foi preservado para uma nova tentativa.';
    }

    if (approved) {
      store.clearCart();
      localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      renderSummary();
      renderCartItems();
    }

    addPaymentInstructions(instructions, pending, order);
    steps.forEach((entry) => {
      const panel = document.getElementById(`stage${entry.charAt(0).toUpperCase()}${entry.slice(1)}`);
      if (panel) panel.hidden = true;
    });
    document.getElementById('stageSuccess').hidden = false;
  }

  async function refreshPaymentStatus(orderId) {
    if (!orderId) return;
    try {
      const query = new URLSearchParams({ order_id: orderId });
      const response = await fetch(`${paymentApiBaseUrl()}/payment-status.php?${query.toString()}`, {
        cache: 'no-store',
        headers: store.getAuthHeaders(),
      });
      const payload = await readApiJson(response);
      showPaymentResult(payload.order, payload.instructions || {});
    } catch (error) {
      if (successOrderStatus) successOrderStatus.textContent = 'Nao foi possivel atualizar agora. Tente novamente em alguns instantes.';
    }
  }

  async function restorePendingPayment() {
    let pending = null;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_ORDER_STORAGE_KEY) || 'null');
    } catch (error) {
      pending = null;
    }
    if (!pending?.orderId || !pending?.providerOrderId) return;
    await refreshPaymentStatus(pending.orderId);
  }

  window.addEventListener('ursoninhos-auth-changed', renderAll);
  renderAll();
  restorePendingPayment();
})();
