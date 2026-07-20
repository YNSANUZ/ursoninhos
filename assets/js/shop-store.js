(function () {
  const CART_STORAGE_KEY = 'ursoninhos_cart';
  const AUTH_TOKEN_KEY = 'ursoninhos_auth_token';
  const USER_CACHE_KEY = 'ursoninhos_user';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error(`Nao foi possivel ler ${key}:`, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function formatBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  const STANDARD_SHIRT_PRICING = {
    front: 49.9,
    back: 20,
    sleeveLeft: 7,
    sleeveRight: 7,
  };

  function normalizeSides(sides = {}) {
    return {
      front: sides.front !== false,
      back: Boolean(sides.back),
      sleeveLeft: Boolean(sides.sleeveLeft),
      sleeveRight: Boolean(sides.sleeveRight),
    };
  }

  function getStandardShirtPrice(sides = {}) {
    const normalized = normalizeSides(sides);
    let total = STANDARD_SHIRT_PRICING.front;
    if (normalized.back) total += STANDARD_SHIRT_PRICING.back;
    if (normalized.sleeveLeft) total += STANDARD_SHIRT_PRICING.sleeveLeft;
    if (normalized.sleeveRight) total += STANDARD_SHIRT_PRICING.sleeveRight;
    return Number(total.toFixed(2));
  }

  function describeShirtSides(sides = {}) {
    const normalized = normalizeSides(sides);
    const parts = ['Frente'];
    const sleeveCount = Number(normalized.sleeveLeft) + Number(normalized.sleeveRight);

    if (normalized.back) parts.push('Costas');
    if (sleeveCount === 2) parts.push('2 mangas');
    else if (normalized.sleeveLeft) parts.push('Manga esquerda');
    else if (normalized.sleeveRight) parts.push('Manga direita');

    return parts.join(' + ');
  }

  function normalizeCartItem(item) {
    const metadata = item.metadata || {};
    const normalizedSides = normalizeSides(metadata.sides || {});
    const normalizedPrice = metadata.pricingMode === 'standard-shirt'
      ? getStandardShirtPrice(normalizedSides)
      : Number(item.price || 0);

    return {
      lineId: item.lineId || `${item.productId || item.id}::${item.size || 'UN'}::${item.variantLabel || ''}`,
      productId: item.productId || item.id || 'produto',
      title: item.title || item.name || 'Produto',
      price: normalizedPrice,
      size: item.size || '',
      quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
      previewImage: item.previewImage || item.thumb || '',
      previewViews: item.previewViews || { front: item.previewImage || item.thumb || '' },
      variantLabel: item.variantLabel || item.variant || '',
      metadata,
    };
  }

  function loadCart() {
    const items = readJson(CART_STORAGE_KEY, []);
    return Array.isArray(items) ? items.map(normalizeCartItem) : [];
  }

  function saveCart(cart) {
    writeJson(CART_STORAGE_KEY, cart.map(normalizeCartItem));
  }

  function addCartItem(item) {
    const cart = loadCart();
    const normalized = normalizeCartItem(item);
    const existing = cart.find((entry) =>
      entry.productId === normalized.productId &&
      entry.size === normalized.size &&
      entry.variantLabel === normalized.variantLabel &&
      entry.previewImage === normalized.previewImage
    );

    if (existing) {
      existing.quantity += normalized.quantity;
    } else {
      cart.push(normalized);
    }

    saveCart(cart);
    return cart;
  }

  function updateCartItemQuantity(lineId, quantity) {
    const cart = loadCart()
      .map(normalizeCartItem)
      .filter((item) => item.lineId !== lineId || quantity > 0)
      .map((item) => (item.lineId === lineId ? { ...item, quantity: Math.max(1, quantity) } : item));

    saveCart(cart);
    return cart;
  }

  function removeCartItem(lineId) {
    const cart = loadCart().filter((item) => item.lineId !== lineId);
    saveCart(cart);
    return cart;
  }

  function clearCart() {
    saveCart([]);
    return [];
  }

  function getCartCount() {
    return loadCart().reduce((sum, item) => sum + item.quantity, 0);
  }

  function getCartTotal() {
    return loadCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getCurrentUser() {
    const user = readJson(USER_CACHE_KEY, null);
    return user && typeof user === 'object' ? user : null;
  }

  function backendBaseUrl() {
    return window.URSONINHOS_APP_CONFIG?.backendBaseUrl || '';
  }

  function getAuthHeaders() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function setAuthenticatedUser(user, token = '') {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (user) writeJson(USER_CACHE_KEY, user);
    else localStorage.removeItem(USER_CACHE_KEY);
    window.dispatchEvent(new CustomEvent('ursoninhos-auth-changed', { detail: { user: user || null } }));
  }

  async function authRequest(body = null, method = 'POST') {
    const baseUrl = backendBaseUrl();
    if (!baseUrl) throw new Error('Backend de contas nao configurado.');
    const response = await fetch(`${baseUrl}/auth.php`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    let payload = {};
    try { payload = await response.json(); } catch (error) { /* resposta invalida */ }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Falha na comunicacao com o servidor.');
    }
    return payload;
  }

  async function refreshSession() {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      setAuthenticatedUser(null);
      return null;
    }
    try {
      const payload = await authRequest(null, 'GET');
      setAuthenticatedUser(payload.user);
      return payload.user;
    } catch (error) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthenticatedUser(null);
      return null;
    }
  }

  async function login(email, password) {
    try {
      const payload = await authRequest({ action: 'login', email, password });
      setAuthenticatedUser(payload.user, payload.token);
      return { ok: true, user: payload.user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function register(userInput) {
    try {
      const payload = await authRequest({ action: 'register', ...userInput });
      setAuthenticatedUser(payload.user, payload.token);
      return { ok: true, user: payload.user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /* Login com Google (perfil vindo do Google Identity Services ou do
     mock): cria a conta na primeira vez e reaproveita nas seguintes.
     Quem entra so com Google usa o site normalmente — CPF, celular e
     endereco ficam pendentes e viram a notificacao "Atualize seus
     dados" no sino da home. */
  async function loginWithGoogle(credential) {
    try {
      const payload = await authRequest({ action: 'google', credential: String(credential || '') });
      setAuthenticatedUser(payload.user, payload.token);
      return { ok: true, user: payload.user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // Dados minimos de um perfil de marketplace: CPF, celular e endereco.
  function getMissingProfileFields(user) {
    if (!user) return [];
    const missing = [];
    if (!user.cpf) missing.push('CPF');
    if (!user.phone) missing.push('celular');
    if (!user.address) missing.push('endereço');
    return missing;
  }

  /* --- Vendas por produto (mock local) ---
     Sem endpoint de atualizacao no backend ainda, o contador vive no
     localStorage deste navegador. Quando products.php ganhar o campo
     "sales", o total exibido soma backend + local. */
  const SALES_STORAGE_KEY = 'ursoninhos_sales';

  function loadSales() {
    const sales = readJson(SALES_STORAGE_KEY, {});
    return sales && typeof sales === 'object' ? sales : {};
  }

  function getLocalSales(productId) {
    return 0;
  }

  function registerSale(productId, quantity) {
    if (!productId) return;
    const sales = loadSales();
    sales[productId] = Number(sales[productId] || 0) + Math.max(1, Number(quantity || 1));
    writeJson(SALES_STORAGE_KEY, sales);

    // Tenta somar tambem no backend (products.php v2). Na versao atual
    // do backend a rota nao existe — o erro e ignorado de proposito e o
    // contador local segue valendo.
    // O total oficial e atualizado no servidor somente apos o webhook.
  }

  async function updateCurrentUser(patch) {
    try {
      const payload = await authRequest({ action: 'update', ...patch });
      setAuthenticatedUser(payload.user);
      return { ok: true, user: payload.user };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function logout() {
    try { await authRequest({ action: 'logout' }); } catch (error) { /* encerra localmente */ }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthenticatedUser(null);
  }

  function generateOrderNumber() {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    const timestamp = Date.now().toString().slice(-5);
    return `URS-${timestamp}${random}`;
  }

  /* --- Créditos do criador ---
     O backend atual so persiste campos fixos, entao o nome de quem
     criou o modelo viaja DENTRO da descricao, num marcador no formato
     "[criador:Nome]". parseCreator separa o texto limpo do nome para
     exibicao; embedCreator monta a descricao com o marcador. */
  const CREATOR_MARKER = /\s*\[criador:([^\]]+)\]\s*/i;

  function embedCreator(description, creatorName) {
    const clean = String(description || '').replace(CREATOR_MARKER, ' ').trim();
    const name = String(creatorName || '').trim();
    return name ? `${clean} [criador:${name}]` : clean;
  }

  function parseCreator(description) {
    const raw = String(description || '');
    const match = raw.match(CREATOR_MARKER);
    return {
      description: raw.replace(CREATOR_MARKER, ' ').replace(/\s{2,}/g, ' ').trim(),
      creator: match ? match[1].trim() : '',
    };
  }

  window.UrsoninhosStore = {
    formatBRL,
    loadCart,
    saveCart,
    addCartItem,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    getCartCount,
    getCartTotal,
    getStandardShirtPrice,
    describeShirtSides,
    getCurrentUser,
    getAuthHeaders,
    refreshSession,
    login,
    register,
    loginWithGoogle,
    getMissingProfileFields,
    getLocalSales,
    embedCreator,
    parseCreator,
    updateCurrentUser,
    logout,
    generateOrderNumber,
  };

  // Apaga o antigo cadastro local que continha senhas em texto simples.
  localStorage.removeItem('ursoninhos_users');
  localStorage.removeItem('ursoninhos_session');
  localStorage.removeItem('ursoninhos_sales');
  refreshSession();
})();
