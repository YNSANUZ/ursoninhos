<?php
/* =========================================================
   Ursoninhos — products.php (versão 2)
   Substitui o products.php atual em
   _ursoninhos_backend/api/products.php na Hostinger.

   Novidades desta versão:
     - Campo "creator" (nome de quem criou o modelo) persistido.
     - Campo "sales" (número de vendas) + endpoint de incremento:
         POST products.php?action=sale  body: {"id":"...","quantity":1}
     - DELETE products.php?id=...&key=CHAVE  (remoção de produtos;
       defina a chave abaixo antes de subir).
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
header('Access-Control-Allow-Headers: Content-Type');

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

function normalizeSide($side)
{
    if (!is_array($side) || empty($side['url'])) return null;
    $transform = is_array($side['transform'] ?? null) ? $side['transform'] : [];
    return [
        'url' => (string) $side['url'],
        'blend' => in_array($side['blend'] ?? '', ['screen', 'normal'], true) ? $side['blend'] : 'normal',
        'transform' => [
            'scale' => (float) ($transform['scale'] ?? 1),
            'offsetX' => (float) ($transform['offsetX'] ?? 0),
            'offsetY' => (float) ($transform['offsetY'] ?? 0),
        ],
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
        'sales' => 0,
        'views' => [
            'front' => (string) ($views['front'] ?? ($body['catalogImage'] ?? '')),
            'back' => (string) ($views['back'] ?? ''),
            'right' => (string) ($views['right'] ?? ''),
            'left' => (string) ($views['left'] ?? ''),
        ],
        'model' => [
            'front' => normalizeSide($model['front'] ?? null),
            'back' => normalizeSide($model['back'] ?? null),
            'sleeveRight' => normalizeSide($model['sleeveRight'] ?? null),
            'sleeveLeft' => normalizeSide($model['sleeveLeft'] ?? null),
        ],
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
