(function () {
  const CART_STORAGE_KEY = 'ursoninhos_cart';
  const USERS_STORAGE_KEY = 'ursoninhos_users';
  const SESSION_STORAGE_KEY = 'ursoninhos_session';

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

  function normalizeCartItem(item) {
    return {
      lineId: item.lineId || `${item.productId || item.id}::${item.size || 'UN'}::${item.variantLabel || ''}`,
      productId: item.productId || item.id || 'produto',
      title: item.title || item.name || 'Produto',
      price: Number(item.price || 0),
      size: item.size || '',
      quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
      previewImage: item.previewImage || item.thumb || '',
      previewViews: item.previewViews || { front: item.previewImage || item.thumb || '' },
      variantLabel: item.variantLabel || item.variant || '',
      metadata: item.metadata || {},
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

  function loadUsers() {
    const users = readJson(USERS_STORAGE_KEY, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    writeJson(USERS_STORAGE_KEY, users);
  }

  function getCurrentUser() {
    const email = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!email) return null;
    return loadUsers().find((user) => user.email === email) || null;
  }

  function login(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = loadUsers().find((entry) => entry.email === normalizedEmail);

    if (!user || user.password !== password) {
      return { ok: false, error: 'E-mail ou senha incorretos.' };
    }

    localStorage.setItem(SESSION_STORAGE_KEY, user.email);
    return { ok: true, user };
  }

  function register(userInput) {
    const users = loadUsers();
    const user = {
      name: String(userInput.name || '').trim(),
      email: String(userInput.email || '').trim().toLowerCase(),
      password: String(userInput.password || ''),
      cpf: String(userInput.cpf || '').replace(/\D/g, ''),
      phone: String(userInput.phone || '').replace(/\D/g, ''),
      address: userInput.address || null,
      provider: userInput.provider || 'local',
    };

    if (users.some((entry) => entry.email === user.email)) {
      return { ok: false, error: 'Ja existe uma conta com esse e-mail.' };
    }

    users.push(user);
    saveUsers(users);
    localStorage.setItem(SESSION_STORAGE_KEY, user.email);
    return { ok: true, user };
  }

  /* Login com Google (perfil vindo do Google Identity Services ou do
     mock): cria a conta na primeira vez e reaproveita nas seguintes.
     Quem entra so com Google usa o site normalmente — CPF, celular e
     endereco ficam pendentes e viram a notificacao "Atualize seus
     dados" no sino da home. */
  function loginWithGoogle(profile) {
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email) return null;

    const users = loadUsers();
    let user = users.find((entry) => entry.email === email);

    if (!user) {
      user = {
        name: String(profile.name || 'Cliente Google').trim(),
        email,
        password: '',
        cpf: '',
        phone: '',
        photoUrl: profile.photoUrl || '',
        provider: profile.provider || 'google',
        address: null,
      };
      users.push(user);
    } else {
      user.provider = user.provider || 'google';
      if (profile.photoUrl && !user.photoUrl) user.photoUrl = profile.photoUrl;
    }

    saveUsers(users);
    localStorage.setItem(SESSION_STORAGE_KEY, user.email);
    return user;
  }

  function loginWithGoogleMock() {
    return loginWithGoogle({
      name: 'Cliente Google',
      email: 'cliente.google@ursoninhos.mock',
      provider: 'google-mock',
    });
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
    return Number(loadSales()[productId] || 0);
  }

  function registerSale(productId, quantity) {
    if (!productId) return;
    const sales = loadSales();
    sales[productId] = Number(sales[productId] || 0) + Math.max(1, Number(quantity || 1));
    writeJson(SALES_STORAGE_KEY, sales);

    // Tenta somar tambem no backend (products.php v2). Na versao atual
    // do backend a rota nao existe — o erro e ignorado de proposito e o
    // contador local segue valendo.
    const baseUrl = window.URSONINHOS_APP_CONFIG?.backendBaseUrl;
    if (baseUrl) {
      fetch(`${baseUrl}/products.php?action=sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, quantity }),
      }).catch(() => {});
    }
  }

  function updateCurrentUser(patch) {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const users = loadUsers();
    const index = users.findIndex((entry) => entry.email === currentUser.email);
    if (index === -1) return null;

    users[index] = { ...users[index], ...patch };
    saveUsers(users);
    return users[index];
  }

  function logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
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
    loadUsers,
    saveUsers,
    getCurrentUser,
    login,
    register,
    loginWithGoogle,
    loginWithGoogleMock,
    getMissingProfileFields,
    getLocalSales,
    registerSale,
    embedCreator,
    parseCreator,
    updateCurrentUser,
    logout,
    generateOrderNumber,
  };
})();
