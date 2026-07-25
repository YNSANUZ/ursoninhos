import { createHash, randomInt } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const API_URL = 'https://primusdf.com.br/_ursoninhos_backend/api/products.php';
const MAP_FILE = path.join(ROOT, 'assets', 'data', 'product-short-links.json');
const GENERATED_FILE = path.join(ROOT, 'assets', 'data', 'generated-product-share-pages.json');
const SOCIAL_IMAGE_DIR = path.join(ROOT, 'assets', 'img', 'share', 'products');
const SITE_URL = 'https://ursoninhos.com';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const cleanText = (value, limit = 190) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function allocateShortId(used) {
  if (used.size >= 1000) throw new Error('A faixa de links curtos 9000–9999 está completa.');
  let candidate;
  do candidate = String(randomInt(9000, 10000));
  while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

function coverSource(product) {
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const coverIndex = Math.min(Math.max(Number(product.coverIndex || 0), 0), Math.max(gallery.length - 1, 0));
  return gallery[coverIndex] || product.catalogImage || product.views?.front || '';
}

function imageFormat(contentType, bytes) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('png') || bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: 'png', type: 'image/png' };
  }
  if (type.includes('webp') || bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { extension: 'webp', type: 'image/webp' };
  }
  return { extension: 'jpg', type: 'image/jpeg' };
}

async function materializeSocialImage(product, shortId) {
  const source = String(coverSource(product) || '');
  let bytes;
  let contentType = '';

  if (source.startsWith('data:image/')) {
    const match = source.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
    if (match) {
      contentType = match[1];
      bytes = Buffer.from(match[2], 'base64');
    }
  } else if (/^https:\/\//i.test(source)) {
    const response = await fetch(source, { headers: { Accept: 'image/*' } });
    if (response.ok) {
      contentType = response.headers.get('content-type') || '';
      bytes = Buffer.from(await response.arrayBuffer());
    }
  }

  if (!bytes?.length) {
    return {
      url: `${SITE_URL}/assets/img/icon-512.png`,
      type: 'image/png',
    };
  }

  const format = imageFormat(contentType, bytes);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const fileName = `${shortId}-${hash}.${format.extension}`;
  await mkdir(SOCIAL_IMAGE_DIR, { recursive: true });
  await writeFile(path.join(SOCIAL_IMAGE_DIR, fileName), bytes);

  for (const existing of await readdir(SOCIAL_IMAGE_DIR)) {
    if (existing.startsWith(`${shortId}-`) && existing !== fileName) {
      await rm(path.join(SOCIAL_IMAGE_DIR, existing), { force: true });
    }
  }

  return {
    url: `${SITE_URL}/assets/img/share/products/${fileName}`,
    type: format.type,
  };
}

function pageHtml(product, shortId, productTemplate, socialImage) {
  const title = cleanText(product.title || 'Produto Ursoninhos', 120);
  const price = Number(product.price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const description = cleanText(`${product.description || 'Produto disponível na Ursoninhos.'} Por ${price}.`);
  const image = socialImage.url;
  const canonical = `${SITE_URL}/${shortId}/`;
  const socialMeta = `
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Ursoninhos">
  <meta property="og:title" content="${escapeHtml(title)} | Ursoninhos">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:type" content="${escapeHtml(socialImage.type)}">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:locale" content="pt_BR">
  <meta property="product:price:amount" content="${Number(product.price || 0).toFixed(2)}">
  <meta property="product:price:currency" content="BRL">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} | Ursoninhos">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">`;

  return productTemplate
    .replace('<head>', '<head>\n<base href="/">')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)} | Ursoninhos</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeHtml(description)}">${socialMeta}`
    );
}

const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
if (!response.ok) throw new Error(`API de produtos respondeu ${response.status}.`);
const payload = await response.json();
const products = Array.isArray(payload.products) ? payload.products.filter((product) => product?.id) : [];
const productTemplate = await readFile(path.join(ROOT, 'produto.html'), 'utf8');
const mapping = await readJson(MAP_FILE, {});
const previouslyGenerated = await readJson(GENERATED_FILE, []);
const used = new Set(Object.values(mapping).filter((value) => /^\d{4}$/.test(String(value))));

for (const product of products) {
  if (!/^\d{4}$/.test(String(mapping[product.id] || ''))) {
    mapping[product.id] = allocateShortId(used);
  }
}

const activeIds = new Set(products.map((product) => product.id));
for (const productId of Object.keys(mapping)) {
  if (!activeIds.has(productId)) delete mapping[productId];
}

const generatedNow = products.map((product) => String(mapping[product.id]));
for (const shortId of previouslyGenerated) {
  if (!generatedNow.includes(String(shortId)) && /^\d{4}$/.test(String(shortId))) {
    await rm(path.join(ROOT, String(shortId)), { recursive: true, force: true });
  }
}

await mkdir(path.dirname(MAP_FILE), { recursive: true });
for (const product of products) {
  const shortId = String(mapping[product.id]);
  const directory = path.join(ROOT, shortId);
  const socialImage = await materializeSocialImage(product, shortId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), pageHtml(product, shortId, productTemplate, socialImage), 'utf8');
}

await writeFile(MAP_FILE, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
await writeFile(GENERATED_FILE, `${JSON.stringify(generatedNow.sort(), null, 2)}\n`, 'utf8');
console.log(`Páginas sociais atualizadas: ${products.length}.`);
