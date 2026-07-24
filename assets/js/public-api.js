(function () {
  const config = window.URSONINHOS_APP_CONFIG || {};
  const baseUrl = config.backendBaseUrl || '';
  const publicProductShortPaths = {
    'bebedouro-para-aves-pequenas-em-garrafa-pet-6-bocas-galinhas-pintinhos-codornas-e-p-ssaros-55e66092': '/55e66092/',
  };

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
    const products = payload.products || [];
    try {
      const metaResponse = await fetch(`${baseUrl}/product-meta.php`, { cache: 'no-store' });
      const metaPayload = await readJson(metaResponse);
      const metadata = metaPayload.products || {};
      products.forEach((product) => Object.assign(product, metadata[product.id] || {}));
    } catch (error) { /* backend antigo: produtos continuam disponíveis */ }
    return products;
  }

  async function getProduct(id) {
    const response = await fetch(`${baseUrl}/products.php?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const payload = await readJson(response);
    const product = payload.product || null;
    if (!product) return null;
    try {
      const metaResponse = await fetch(`${baseUrl}/product-meta.php?id=${encodeURIComponent(product.id)}`, { cache: 'no-store' });
      const metaPayload = await readJson(metaResponse);
      Object.assign(product, metaPayload.meta || {});
    } catch (error) { /* metadados opcionais */ }
    return product;
  }

  function getProductPath(productOrKey) {
    if (productOrKey && typeof productOrKey === 'object') {
      if (productOrKey.shortPath) return productOrKey.shortPath;
      if (productOrKey.shortId) return `/${encodeURIComponent(productOrKey.shortId)}/`;
      if (publicProductShortPaths[productOrKey.id]) return publicProductShortPaths[productOrKey.id];
      if (productOrKey.id) return `produto.html?id=${encodeURIComponent(productOrKey.id)}`;
    }

    const key = String(productOrKey || '').trim();
    if (publicProductShortPaths[key]) return publicProductShortPaths[key];
    if (/^\d{4}$/.test(key)) return `/${encodeURIComponent(key)}/`;
    return `produto.html?id=${encodeURIComponent(key)}`;
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

  async function createPhysicalProduct(product) {
    const response = await fetch(`${baseUrl}/products.php?action=create-physical`, {
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

  async function updateProduct(id, product) {
    const response = await fetch(`${baseUrl}/products.php?action=update&id=${encodeURIComponent(id)}`, {
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

  async function deleteProduct(id) {
    const response = await fetch(`${baseUrl}/products.php?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(window.UrsoninhosStore?.getAuthHeaders() || {}),
      },
    });
    return readJson(response);
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
    createPhysicalProduct,
    updateProduct,
    deleteProduct,
    getProductPath,
    syncProducts,
  };
})();
