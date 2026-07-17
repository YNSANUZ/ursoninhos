(function () {
  const store = window.UrsoninhosStore;
  if (!store) return;

  const PAYMENT_STORAGE_KEY = 'ursoninhos_checkout_payment';
  const PENDING_ORDER_STORAGE_KEY = 'ursoninhos_pending_order';
  const steps = ['cart', 'auth', 'address', 'review', 'payment'];
  const paymentCopy = {
    mercadopago: {
      title: 'Checkout transparente Mercado Pago',
      text: 'Escolha Pix, cartao ou boleto abaixo sem sair do Ursoninhos. O ambiente ainda e de teste.',
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
  const CARD_MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';
  const previewCache = new Map();
  const PRINT_CENTER_X = 0.478;
  const PRINT_TOP_Y = 0.30;
  const PRINT_SIZE = 0.34;
  let renderToken = 0;

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

  async function buildShirtMockup(printUrl, transform = {}, blend = 'screen') {
    const cacheKey = JSON.stringify({ printUrl, transform, blend });
    if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);

    const promise = (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');

      const base = await loadImage(CARD_MOCKUP_URL);
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
      return printUrl || 'assets/img/banner-estatico.jpg';
    });

    previewCache.set(cacheKey, promise);
    return promise;
  }

  async function resolveCartPreview(item) {
    const frontPreview = item.previewViews?.front || item.previewImage || 'assets/img/banner-estatico.jpg';
    if (!isCustomShirt(item)) return frontPreview;
    if (!item.metadata?.frontPrintUrl) return frontPreview;

    const printUrl = item.metadata.frontPrintUrl;
    const transform = item.metadata?.frontTransform || {};
    const blend = item.metadata?.frontPrintBlend || 'screen';
    return buildShirtMockup(printUrl, transform, blend);
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
        applyPreviewToImage(itemDetailImage, src, item);
      }
    }));
  }

  function getUnlockedSteps() {
    const cart = getCart();
    const user = getUser();
    const hasAddress = Boolean(user?.address);
    const hasPayment = Boolean(selectedPayment);

    return {
      cart: true,
      auth: cart.length > 0,
      address: cart.length > 0 && Boolean(user),
      review: cart.length > 0 && Boolean(user) && hasAddress,
      payment: cart.length > 0 && Boolean(user) && hasAddress,
      success: cart.length > 0 && Boolean(user) && hasAddress && hasPayment,
    };
  }

  function goToStep(step) {
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

  function renderItemDetail(lineId) {
    const item = getCart().find((entry) => entry.lineId === lineId) || getCart()[0];
    if (!item) return;

    selectedItemLineId = item.lineId;
    if (itemDetailImage) {
      itemDetailImage.src = item.previewViews?.front || item.previewImage || 'assets/img/banner-estatico.jpg';
      itemDetailImage.alt = `${item.title} selecionado`;
    }
    if (itemDetailTitle) itemDetailTitle.textContent = item.title;
    if (itemDetailSize) itemDetailSize.textContent = item.size || 'Nao informado';
    if (itemDetailQuantity) itemDetailQuantity.textContent = String(item.quantity);
    if (itemDetailPrice) itemDetailPrice.textContent = store.formatBRL(item.price);
    if (itemDetailTotal) itemDetailTotal.textContent = store.formatBRL(item.price * item.quantity);
    if (itemDetailPreview) itemDetailPreview.textContent = item.previewViews?.front ? 'Mockup frontal salvo' : 'Sem preview';
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
            src="${item.previewViews?.front || item.previewImage || 'assets/img/banner-estatico.jpg'}"
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
        if (event.target.closest('[data-action="increase"], [data-action="decrease"], [data-action="qty-input"], [data-action="remove"]')) return;
        renderItemDetail(lineId);
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

  function renderAuthState() {
    const user = getUser();
    if (loggedUserCard) {
      loggedUserCard.hidden = !user;
      loggedUserCard.innerHTML = user
        ? `<strong>${user.name}</strong><p>${user.email}</p><div class="checkout-nav"><button type="button" class="btn btn--outline" id="checkoutLogoutBtn">Sair</button></div>`
        : '';
    }

    if (guestAuthSection) guestAuthSection.hidden = Boolean(user);

    document.getElementById('checkoutLogoutBtn')?.addEventListener('click', () => {
      store.logout();
      renderAll();
      goToStep('auth');
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
    paymentChoices?.querySelectorAll('.payment-choice').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.method === selectedPayment);
    });

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

  document.getElementById('goToAuthBtn')?.addEventListener('click', () => goToStep('auth'));
  document.getElementById('goToAddressBtn')?.addEventListener('click', () => goToStep('address'));
  document.getElementById('goToPaymentBtn')?.addEventListener('click', () => goToStep('payment'));

  const checkoutGoogleButton = document.getElementById('googleLoginBtn');
  const checkoutGoogleContainer = document.getElementById('googleSigninContainer');

  function finishGoogleCheckout(profile) {
    const user = store.loginWithGoogle(profile);
    if (!user) return;
    renderAll();
    goToStep('address');
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
            finishGoogleCheckout({ name: payload.name, email: payload.email, photoUrl: payload.picture, provider: 'google' });
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

  checkoutLoginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutLoginForm);
    const result = store.login(formData.get('email'), formData.get('password'));
    if (!result.ok) {
      if (checkoutLoginError) checkoutLoginError.textContent = result.error;
      return;
    }
    if (checkoutLoginError) checkoutLoginError.textContent = '';
    renderAll();
    goToStep('address');
  });

  checkoutRegisterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutRegisterForm);
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    if (password !== confirmPassword) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = 'As senhas nao coincidem.';
      return;
    }

    const result = store.register({
      name: formData.get('name'),
      email: formData.get('email'),
      password,
    });

    if (!result.ok) {
      if (checkoutRegisterError) checkoutRegisterError.textContent = result.error;
      return;
    }

    if (checkoutRegisterError) checkoutRegisterError.textContent = '';
    renderAll();
    goToStep('address');
  });

  checkoutCepInput?.addEventListener('input', () => {
    const digits = checkoutCepInput.value.replace(/\D/g, '').slice(0, 8);
    checkoutCepInput.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    if (digits.length === 8) lookupCep(digits);
  });

  checkoutAddressForm?.addEventListener('submit', (event) => {
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

    store.updateCurrentUser({ address });
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    const publicKey = window.URSONINHOS_APP_CONFIG?.mercadoPagoPublicKey || '';
    if (!publicKey) {
      if (checkoutPaymentError) checkoutPaymentError.textContent = 'A Public Key de teste do Mercado Pago ainda nao foi configurada no site.';
      if (paymentVisualTitle) paymentVisualTitle.textContent = 'Configuracao pendente';
      return;
    }
    if (!window.MercadoPago) {
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
            if (paymentVisualText) paymentVisualText.textContent = 'Escolha Pix, cartao ou boleto. Nenhuma cobranca real sera feita neste modo de teste.';
          },
          onSubmit: async ({ selectedPaymentMethod, formData }) => {
            try {
              return await processBrickPayment(formData, selectedPaymentMethod);
            } catch (error) {
              if (paymentVisualTitle) paymentVisualTitle.textContent = 'Pagamento nao concluido';
              if (checkoutPaymentError) {
                checkoutPaymentError.textContent = 'O pagamento nao foi aprovado. Confira os dados ou tente outro cartao ou forma de pagamento.';
              }
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
        ? 'O Mercado Pago confirmou o pagamento de teste deste pedido.'
        : pending
          ? 'O pedido foi criado e aguarda a conclusao ou confirmacao do pagamento.'
          : 'O pagamento nao foi aprovado. Seu carrinho foi preservado para uma nova tentativa.';
    }

    if (approved) {
      getCart().forEach((item) => {
        if (item.metadata?.source === 'public-model') {
          store.registerSale(item.metadata.productId, item.quantity);
        }
      });
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
      const response = await fetch(`${paymentApiBaseUrl()}/payment-status.php?${query.toString()}`, { cache: 'no-store' });
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

  renderAll();
  restorePendingPayment();
})();
