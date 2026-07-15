/* =========================================================
   Ursoninhos — sheet-products.js
   Ponte entre o site e a PLANILHA GOOGLE de produtos.

   LEITURA (funciona sozinha): a planilha é pública e é lida
   direto do navegador (endpoint gviz). O que estiver lá
   manda no site: preço e nome alterados na planilha valem
   na vitrine, na página do produto e no carrinho.

   ESCRITA (site -> planilha): precisa do Web App do Google
   Apps Script publicado pelo dono da loja (código pronto em
   backend/google-apps-script.gs). A URL do app entra em
   app-config.js (sheetWebAppUrl). Sem ela, push() não faz
   nada — o site continua funcionando normalmente.

   Colunas esperadas (linha 1): id | nome | tipo | cor |
   preco | link | atualizado_em
   ========================================================= */
(function () {
  const config = window.URSONINHOS_APP_CONFIG || {};
  const SHEET_ID = config.productsSheetId || '';
  const WEB_APP_URL = config.sheetWebAppUrl || '';
  const CACHE_KEY = 'ursoninhos_sheet_products';
  const CACHE_MS = 60 * 1000; // 1 min: mudou na planilha, site pega logo

  let memoryCache = null;

  function parsePreco(value) {
    if (typeof value === 'number') return value;
    const num = parseFloat(String(value || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  }

  /* Lê a planilha pelo endpoint gviz (JSON com CORS liberado para
     planilhas públicas) e devolve um mapa id -> linha. */
  async function fetchSheet() {
    if (!SHEET_ID) return {};

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&t=${Date.now()}`;
    const response = await fetch(url);
    const text = await response.text();

    // A resposta vem embrulhada em google.visualization.Query.setResponse(...)
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return {};
    const data = JSON.parse(text.slice(start, end + 1));

    const cols = (data.table?.cols || []).map((col) => String(col.label || col.id || '').trim().toLowerCase());
    const products = {};

    (data.table?.rows || []).forEach((row) => {
      const cells = row.c || [];
      const item = {};
      cols.forEach((name, index) => {
        if (!name) return;
        const cell = cells[index];
        item[name] = cell && cell.v !== null && cell.v !== undefined ? cell.v : '';
      });
      const id = String(item.id || '').trim();
      if (!id) return;
      products[id] = {
        id,
        nome: String(item.nome || '').trim(),
        tipo: String(item.tipo || '').trim(),
        cor: String(item.cor || '').trim(),
        preco: parsePreco(item.preco),
        link: String(item.link || '').trim(),
      };
    });

    return products;
  }

  /* Mapa id -> produto da planilha, com cache de 1 minuto para não
     bater no Google a cada página. Falhou a rede? Devolve {} e o site
     segue com os preços padrão do código. */
  async function load() {
    if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) return memoryCache.data;

    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_MS) {
        memoryCache = cached;
        return cached.data;
      }
    } catch (error) { /* cache corrompido: ignora */ }

    try {
      const data = await fetchSheet();
      memoryCache = { at: Date.now(), data };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache)); } catch (e) { /* sem espaço */ }
      return data;
    } catch (error) {
      console.warn('Planilha de produtos indisponível, usando preços padrão:', error);
      return {};
    }
  }

  // Aplica nome/preço da planilha num produto do site (match por id).
  // Devolve true se alguma coisa mudou.
  function applyOverride(product, sheetRow) {
    if (!sheetRow) return false;
    let changed = false;
    if (sheetRow.preco !== null && sheetRow.preco > 0 && sheetRow.preco !== product.preco) {
      product.preco = sheetRow.preco;
      changed = true;
    }
    if (sheetRow.nome) {
      product.nomePlanilha = sheetRow.nome;
      changed = true;
    }
    return changed;
  }

  /* Envia produtos para a planilha via Web App (upsert por id).
     Content-Type text/plain evita o preflight de CORS que o Apps
     Script não responde. Sem URL configurada, resolve em silêncio. */
  async function push(products) {
    if (!WEB_APP_URL || !products?.length) return { ok: false, skipped: true };
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'upsert', products }),
    });
    return response.json().catch(() => ({ ok: response.ok }));
  }

  window.UrsoninhosSheet = { load, applyOverride, push, enabled: !!SHEET_ID, canWrite: !!WEB_APP_URL };
})();
