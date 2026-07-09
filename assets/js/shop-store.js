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

  function loginWithGoogleMock() {
    const email = 'cliente.google@ursoninhos.mock';
    const users = loadUsers();
    let user = users.find((entry) => entry.email === email);

    if (!user) {
      user = {
        name: 'Cliente Google',
        email,
        password: '',
        provider: 'google-mock',
        address: null,
      };
      users.push(user);
      saveUsers(users);
    }

    localStorage.setItem(SESSION_STORAGE_KEY, user.email);
    return user;
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
    loginWithGoogleMock,
    updateCurrentUser,
    logout,
    generateOrderNumber,
  };
})();
