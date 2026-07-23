<?php
/* =========================================================
   Ursoninhos — products.php (versão 3)
   Substitui o products.php atual em
   _ursoninhos_backend/api/products.php na Hostinger.

   Novidades desta versão:
     - Campo "creator" (nome de quem criou o modelo) persistido.
     - Campo "sales" (número de vendas) + endpoint de incremento:
         POST products.php?action=sale  body: {"id":"...","quantity":1}
     - DELETE products.php?id=...&key=CHAVE  (remoção de produtos;
       defina a chave abaixo antes de subir).
     - Até 3 camadas independentes por lado, com texto editável.
     - Atualização completa de produtos pelo painel ADM.
     - Teto de preço maior (R$ 500 em vez de R$ 50).

   O arquivo de dados continua sendo products.json na MESMA pasta
   (se o seu atual usa outro nome, ajuste DATA_FILE abaixo).
   ========================================================= */

const DATA_FILE = __DIR__ . '/products.json';
const ADMIN_KEY = 'TROQUE-ESTA-CHAVE'; // usada só para DELETE
const MAX_PRICE = 500;
const PUBLIC_SHORT_ID_BASE = 8600;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

function respond($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function loadProducts()
{
    if (!file_exists(DATA_FILE)) return [];
    $raw = file_get_contents(DATA_FILE);
    $data = json_decode($raw, true);
    $products = is_array($data) ? $data : [];
    $changed = false;
    $products = ensureShortLinks($products, $changed);
    if ($changed) {
        saveProducts($products);
    }
    return $products;
}

function saveProducts($products)
{
    file_put_contents(DATA_FILE, json_encode(array_values($products), JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function slugify($text)
{
    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT', $text)), '-'));
    return $slug !== '' ? $slug : 'modelo';
}

function isValidShortId($value)
{
    return preg_match('/^\d{4}$/', (string) $value) === 1;
}

function buildShortPath($shortId)
{
    return '/' . (string) $shortId . '/';
}

function matchesProductKey($product, $key)
{
    $key = (string) $key;
    return (string) ($product['id'] ?? '') === $key || (string) ($product['shortId'] ?? '') === $key;
}

function ensureShortLinks($products, &$changed = false)
{
    $used = [];
    foreach ($products as $product) {
        $shortId = (string) ($product['shortId'] ?? '');
        if (isValidShortId($shortId)) {
            $used[$shortId] = true;
        }
    }

    $nextShortId = PUBLIC_SHORT_ID_BASE;
    foreach ($products as $index => $product) {
        $shortId = (string) ($product['shortId'] ?? '');
        if (!isValidShortId($shortId)) {
            while (isset($used[(string) $nextShortId])) {
                $nextShortId++;
            }
            $shortId = (string) $nextShortId;
            $used[$shortId] = true;
            $products[$index]['shortId'] = $shortId;
            $changed = true;
            $nextShortId++;
        }

        $shortPath = buildShortPath($shortId);
        if ((string) ($product['shortPath'] ?? '') !== $shortPath) {
            $products[$index]['shortPath'] = $shortPath;
            $changed = true;
        }
    }

    return $products;
}

function normalizeTransform($transform)
{
    return [
        'scale' => max(0.22, min(2.35, (float) ($transform['scale'] ?? 1))),
        'offsetX' => max(-24, min(24, (float) ($transform['offsetX'] ?? 0))),
        'offsetY' => max(-24, min(24, (float) ($transform['offsetY'] ?? 0))),
    ];
}

function normalizeLayer($layer, $index = 0)
{
    if (!is_array($layer)) return null;
    $url = trim((string) ($layer['url'] ?? $layer['file'] ?? ''));
    if ($url === '') return null;
    $transform = is_array($layer['transform'] ?? null) ? $layer['transform'] : [];
    $textData = is_array($layer['textData'] ?? null) ? $layer['textData'] : null;
    $lines = [];
    if ($textData) {
        $rawLines = is_array($textData['lines'] ?? null)
            ? $textData['lines']
            : preg_split('/\R/u', (string) ($textData['text'] ?? ''));
        foreach (array_slice($rawLines, 0, 12) as $line) {
            $clean = mb_substr(trim((string) $line), 0, 160);
            if ($clean !== '') $lines[] = $clean;
        }
        $textData = [
            'text' => implode("\n", $lines),
            'lines' => $lines,
            'presetId' => mb_substr((string) ($textData['presetId'] ?? 'statement'), 0, 80),
        ];
    }

    return [
        'id' => mb_substr((string) ($layer['id'] ?? ('layer-' . ($index + 1))), 0, 80),
        'name' => mb_substr((string) ($layer['name'] ?? ($textData ? 'Texto' : 'Imagem')), 0, 120),
        'type' => ($textData || ($layer['type'] ?? '') === 'text') ? 'text' : 'image',
        'url' => $url,
        'blend' => in_array($layer['blend'] ?? '', ['screen', 'normal'], true) ? $layer['blend'] : 'normal',
        'transform' => normalizeTransform($transform),
        'textData' => $textData,
    ];
}

function normalizeSide($side)
{
    if (!is_array($side)) return null;
    $sourceLayers = is_array($side['layers'] ?? null) ? $side['layers'] : [$side];
    $layers = [];
    foreach (array_slice($sourceLayers, 0, 3) as $index => $sourceLayer) {
        $layer = normalizeLayer($sourceLayer, $index);
        if ($layer) $layers[] = $layer;
    }
    if (!$layers) return null;
    $first = $layers[0];
    return [
        // Campos legados mantidos para páginas ainda em cache.
        'url' => $first['url'],
        'blend' => $first['blend'],
        'transform' => $first['transform'],
        'layers' => $layers,
    ];
}

function normalizeViews($views, $catalogImage = '')
{
    $views = is_array($views) ? $views : [];
    return [
        'front' => (string) ($views['front'] ?? $catalogImage),
        'back' => (string) ($views['back'] ?? ''),
        'right' => (string) ($views['right'] ?? ''),
        'left' => (string) ($views['left'] ?? ''),
    ];
}

function normalizeModel($model)
{
    $model = is_array($model) ? $model : [];
    return [
        'front' => normalizeSide($model['front'] ?? null),
        'back' => normalizeSide($model['back'] ?? null),
        'sleeveRight' => normalizeSide($model['sleeveRight'] ?? null),
        'sleeveLeft' => normalizeSide($model['sleeveLeft'] ?? null),
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $products = loadProducts();
    $id = $_GET['id'] ?? '';

    if ($id !== '') {
        foreach ($products as $product) {
            if (matchesProductKey($product, $id)) respond(['ok' => true, 'product' => $product]);
        }
        respond(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }

    respond(['ok' => true, 'products' => $products]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) respond(['ok' => false, 'error' => 'JSON invalido.'], 400);

    // Incremento de vendas: POST ?action=sale {id, quantity}
    if (($_GET['action'] ?? '') === 'sale') {
        $id = (string) ($body['id'] ?? '');
        $quantity = max(1, (int) ($body['quantity'] ?? 1));
        $products = loadProducts();
        foreach ($products as $index => $product) {
            if (matchesProductKey($product, $id)) {
                $products[$index]['sales'] = (int) ($product['sales'] ?? 0) + $quantity;
                saveProducts($products);
                respond(['ok' => true, 'product' => $products[$index]]);
            }
        }
        respond(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }

    // Edição pelo painel ADM. Mantém id, link curto, vendas e criação.
    if (($_GET['action'] ?? '') === 'update') {
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') respond(['ok' => false, 'error' => 'Produto obrigatorio.'], 400);
        $products = loadProducts();
        foreach ($products as $index => $existing) {
            if (!matchesProductKey($existing, $id)) continue;
            $title = trim((string) ($body['title'] ?? $existing['title'] ?? ''));
            if ($title === '') respond(['ok' => false, 'error' => 'Titulo obrigatorio.'], 400);
            $catalogImage = (string) ($body['catalogImage'] ?? $existing['catalogImage'] ?? '');
            $products[$index] = array_merge($existing, [
                'title' => mb_substr($title, 0, 120),
                'description' => mb_substr(trim((string) ($body['description'] ?? $existing['description'] ?? '')), 0, 600),
                'price' => min(MAX_PRICE, max(0, (float) ($body['price'] ?? $existing['price'] ?? 0))),
                'catalogImage' => $catalogImage,
                'creator' => mb_substr(trim((string) ($body['creator'] ?? $existing['creator'] ?? '')), 0, 80),
                'creatorPhoto' => (string) ($body['creatorPhoto'] ?? $existing['creatorPhoto'] ?? ''),
                'views' => array_key_exists('views', $body)
                    ? normalizeViews($body['views'], $catalogImage)
                    : ($existing['views'] ?? normalizeViews([], $catalogImage)),
                'model' => array_key_exists('model', $body)
                    ? normalizeModel($body['model'])
                    : ($existing['model'] ?? normalizeModel([])),
                'updatedAt' => date('c'),
            ]);
            saveProducts($products);
            respond(['ok' => true, 'product' => $products[$index]]);
        }
        respond(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }

    // Publicação de produto
    $title = trim((string) ($body['title'] ?? ''));
    if ($title === '') respond(['ok' => false, 'error' => 'Titulo obrigatorio.'], 400);

    $views = is_array($body['views'] ?? null) ? $body['views'] : [];
    $model = is_array($body['model'] ?? null) ? $body['model'] : [];

    $product = [
        'id' => slugify($title) . '-' . substr((string) round(microtime(true) * 1000), -6),
        'title' => mb_substr($title, 0, 120),
        'description' => mb_substr(trim((string) ($body['description'] ?? '')), 0, 600),
        'price' => min(MAX_PRICE, max(0, (float) ($body['price'] ?? 0))),
        'catalogImage' => (string) ($body['catalogImage'] ?? ''),
        'creator' => mb_substr(trim((string) ($body['creator'] ?? '')), 0, 80),
        'creatorPhoto' => (string) ($body['creatorPhoto'] ?? ''),
        'sales' => 0,
        'views' => normalizeViews($views, (string) ($body['catalogImage'] ?? '')),
        'model' => normalizeModel($model),
        'createdAt' => date('c'),
        'status' => 'published',
    ];

    $products = loadProducts();
    $products[] = $product;
    $changed = false;
    $products = ensureShortLinks($products, $changed);
    $product = end($products);
    saveProducts($products);
    respond(['ok' => true, 'product' => $product]);
}

if ($method === 'DELETE') {
    if (($_GET['key'] ?? '') !== ADMIN_KEY) {
        respond(['ok' => false, 'error' => 'Chave invalida.'], 403);
    }
    $id = $_GET['id'] ?? '';
    $products = loadProducts();
    $remaining = array_filter($products, fn($product) => !matchesProductKey($product, $id));
    if (count($remaining) === count($products)) {
        respond(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }
    saveProducts($remaining);
    respond(['ok' => true]);
}

respond(['ok' => false, 'error' => 'Metodo nao suportado.'], 405);
