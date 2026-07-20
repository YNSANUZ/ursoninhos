(function () {
  const config = window.URSONINHOS_APP_CONFIG || {};
  const baseUrl = config.backendBaseUrl || '';

  async function readJson(response) {
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Falha na comunicacao com o backend.');
    }
    return payload;
  }

  async function listProducts() {
    const response = await fetch(`${baseUrl}/products.php`, { cache: 'no-store' });
    const payload = await readJson(response);
    return payload.products || [];
  }

  async function getProduct(id) {
    const response = await fetch(`${baseUrl}/products.php?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const payload = await readJson(response);
    return payload.product || null;
  }

  async function createProduct(product) {
    const response = await fetch(`${baseUrl}/products.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(window.UrsoninhosStore?.getAuthHeaders() || {}),
      },
      body: JSON.stringify(product),
    });
    const payload = await readJson(response);
    return payload.product || null;
  }

  async function syncProducts(products) {
    const response = await fetch(`${baseUrl}/products.php?action=sync-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(window.UrsoninhosStore?.getAuthHeaders() || {}),
      },
      body: JSON.stringify({ products }),
    });
    return readJson(response);
  }

  window.UrsoninhosApi = {
    listProducts,
    getProduct,
    createProduct,
    syncProducts,
  };
})();
