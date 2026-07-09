(function () {
  const store = window.UrsoninhosStore;
  if (!store) return;

  const PAYMENT_STORAGE_KEY = 'ursoninhos_checkout_payment';
  const steps = ['cart', 'auth', 'address', 'review', 'payment'];
  const paymentCopy = {
    pix: {
      title: 'Pix selecionado',
      text: 'Mostre um QR Code e um codigo copia e cola aqui quando integrar o gateway.',
    },
    card: {
      title: 'Cartao selecionado',
      text: 'Depois entra o formulario seguro do gateway sem mudar o restante do fluxo.',
    },
    boleto: {
      title: 'Boleto selecionado',
      text: 'Aqui pode entrar a geracao do boleto e o prazo de vencimento.',
    },
  };

  let currentStep = 'cart';
  let selectedItemLineId = null;
  let selectedPayment = localStorage.getItem(PAYMENT_STORAGE_KEY) || '';

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
  const successOrderNumber = document.getElementById('successOrderNumber');
  const itemDetailImage = document.getElementById('itemDetailImage');
  const itemDetailTitle = document.getElementById('itemDetailTitle');
  const itemDetailSize = document.getElementById('itemDetailSize');
  const itemDetailQuantity = document.getElementById('itemDetailQuantity');
  const itemDetailPrice = document.getElementById('itemDetailPrice');
  const itemDetailTotal = document.getElementById('itemDetailTotal');
  const itemDetailPreview = document.getElementById('itemDetailPreview');

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

    currentStep = step;
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
    if (step === 'payment') renderPaymentSelection();
  }

  function renderSummary() {
    const cart = getCart();
    const user = getUser();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (checkoutCartCount) checkoutCartCount.textContent = String(totalItems);
    if (summaryItems) summaryItems.textContent = String(totalItems);
    if (summaryCustomer) summaryCustomer.textContent = user ? user.name : 'Visitante';
    if (summaryAddress) summaryAddress.textContent = user?.address ? 'Preenchido' : 'Pendente';
    if (summaryPayment) summaryPayment.textContent = selectedPayment ? selectedPayment.toUpperCase() : 'Pendente';
    if (summaryTotal) summaryTotal.textContent = store.formatBRL(store.getCartTotal());
  }

  function renderItemDetail(lineId) {
    const item = getCart().find((entry) => entry.lineId === lineId) || getCart()[0];
    if (!item) return;

    selectedItemLineId = item.lineId;
    if (itemDetailImage) itemDetailImage.src = item.previewViews?.front || item.previewImage || 'assets/img/banner-estatico.png';
    if (itemDetailTitle) itemDetailTitle.textContent = item.title;
    if (itemDetailSize) itemDetailSize.textContent = item.size || 'Nao informado';
    if (itemDetailQuantity) itemDetailQuantity.textContent = String(item.quantity);
    if (itemDetailPrice) itemDetailPrice.textContent = store.formatBRL(item.price);
    if (itemDetailTotal) itemDetailTotal.textContent = store.formatBRL(item.price * item.quantity);
    if (itemDetailPreview) itemDetailPreview.textContent = item.previewViews?.front ? 'Frente salva' : 'Sem preview';
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

    checkoutItems.innerHTML = cart.map((item) => `
      <article class="checkout-item" data-line-id="${item.lineId}">
        <button type="button" class="checkout-item__preview" data-action="detail">
          <img src="${item.previewViews?.front || item.previewImage || 'assets/img/banner-estatico.png'}" alt="${item.title}">
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
    if (!paymentChoices) return;
    paymentChoices.querySelectorAll('.payment-choice').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.method === selectedPayment);
    });

    const copy = paymentCopy[selectedPayment] || {
      title: 'Escolha uma forma de pagamento',
      text: 'Depois, aqui entra a integracao real com gateway.',
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

  document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
    store.loginWithGoogleMock();
    renderAll();
    goToStep('address');
  });

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

  paymentChoices?.querySelectorAll('.payment-choice').forEach((button) => {
    button.addEventListener('click', () => {
      selectedPayment = button.dataset.method;
      localStorage.setItem(PAYMENT_STORAGE_KEY, selectedPayment);
      renderAll();
    });
  });

  document.getElementById('finishOrderBtn')?.addEventListener('click', () => {
    if (!selectedPayment) {
      goToStep('payment');
      return;
    }

    if (successOrderNumber) successOrderNumber.textContent = store.generateOrderNumber();
    store.clearCart();
    renderSummary();
    renderCartItems();
    document.getElementById('stagePayment').hidden = true;
    document.getElementById('stageSuccess').hidden = false;
  });

  renderAll();
})();
