<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const PRODUCT_META_FILE = URSONINHOS_DATA_DIR . '/product-meta.json';
const PRODUCT_MODEL_DIR = URSONINHOS_DATA_DIR . '/product-models';

if (!file_exists(PRODUCT_META_FILE)) {
    file_put_contents(PRODUCT_META_FILE, '{}', LOCK_EX);
}
if (!is_dir(PRODUCT_MODEL_DIR)) {
    mkdir(PRODUCT_MODEL_DIR, 0775, true);
}

function clean_terms(mixed $value, int $limit = 12): array
{
    $source = is_array($value) ? $value : preg_split('/[,;\r\n]+/u', (string) $value);
    $terms = [];
    foreach (array_slice($source ?: [], 0, $limit) as $term) {
        $term = mb_strtolower(trim((string) $term));
        $term = preg_replace('/[^\p{L}\p{N}\s_-]+/u', '', $term);
        $term = mb_substr(preg_replace('/\s+/u', ' ', $term), 0, 40);
        if ($term !== '' && !in_array($term, $terms, true)) $terms[] = $term;
    }
    return $terms;
}

function load_product_meta(): array
{
    $data = load_json_file(PRODUCT_META_FILE);
    return is_array($data) ? $data : [];
}

function save_product_meta(array $data): void
{
    save_json_file(PRODUCT_META_FILE, $data);
}

function public_meta(string $id, array $entry): array
{
    $hasModel = isset($entry['modelFile']) && is_file(PRODUCT_MODEL_DIR . '/' . basename((string) $entry['modelFile']));
    return [
        'id' => $id,
        'categories' => clean_terms($entry['categories'] ?? []),
        'tags' => clean_terms($entry['tags'] ?? [], 24),
        'hasModel' => $hasModel,
        'modelUrl' => $hasModel
            ? 'https://primusdf.com.br/_ursoninhos_backend/api/product-meta.php?action=model&id=' . rawurlencode($id)
            : '',
        'modelTriangles' => max(0, (int) ($entry['modelTriangles'] ?? 0)),
        'updatedAt' => (string) ($entry['updatedAt'] ?? ''),
    ];
}

function valid_product_id(string $id): string
{
    $id = trim($id);
    if ($id === '' || preg_match('/^[a-zA-Z0-9_-]{3,180}$/', $id) !== 1) {
        send_json(['ok' => false, 'error' => 'Produto invalido.'], 422);
    }
    return $id;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = strtolower(trim((string) ($_GET['action'] ?? '')));
$id = isset($_GET['id']) ? valid_product_id((string) $_GET['id']) : '';
$meta = load_product_meta();

if ($method === 'GET' && $action === 'model') {
    $entry = is_array($meta[$id] ?? null) ? $meta[$id] : [];
    $file = PRODUCT_MODEL_DIR . '/' . basename((string) ($entry['modelFile'] ?? ''));
    if (!is_file($file)) send_json(['ok' => false, 'error' => 'Modelo nao encontrado.'], 404);
    header_remove('Content-Type');
    header('Content-Type: model/stl');
    header('Content-Disposition: inline; filename="visualizacao-3d.stl"');
    header('Cache-Control: public, max-age=86400');
    header('X-Robots-Tag: noindex, noarchive');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

if ($method === 'GET') {
    if ($id !== '') {
        $entry = is_array($meta[$id] ?? null) ? $meta[$id] : [];
        send_json(['ok' => true, 'meta' => public_meta($id, $entry)]);
    }
    $public = [];
    foreach ($meta as $productId => $entry) {
        if (is_array($entry)) $public[$productId] = public_meta((string) $productId, $entry);
    }
    send_json(['ok' => true, 'products' => $public]);
}

if ($method !== 'POST') {
    send_json(['ok' => false, 'error' => 'Metodo nao suportado.'], 405);
}

require_user(true);
$id = valid_product_id((string) ($_GET['id'] ?? ''));
$entry = is_array($meta[$id] ?? null) ? $meta[$id] : [];

if ($action === 'model') {
    $upload = $_FILES['model'] ?? null;
    if (!is_array($upload) || (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        send_json(['ok' => false, 'error' => 'Envie a previa STL do produto.'], 422);
    }
    $tmp = (string) ($upload['tmp_name'] ?? '');
    $size = (int) ($upload['size'] ?? 0);
    if ($size < 84 || $size > 3000000 || !is_uploaded_file($tmp)) {
        send_json(['ok' => false, 'error' => 'Previa 3D invalida ou maior que 3 MB.'], 413);
    }
    $handle = fopen($tmp, 'rb');
    fseek($handle, 80);
    $triangleBytes = fread($handle, 4);
    fclose($handle);
    $triangleData = unpack('Vcount', $triangleBytes ?: '');
    $triangles = (int) ($triangleData['count'] ?? 0);
    if ($triangles < 1 || $triangles > 50000 || 84 + ($triangles * 50) !== $size) {
        send_json(['ok' => false, 'error' => 'A previa precisa ser um STL binario valido.'], 422);
    }
    if (!empty($entry['modelFile'])) {
        $old = PRODUCT_MODEL_DIR . '/' . basename((string) $entry['modelFile']);
        if (is_file($old)) unlink($old);
    }
    $fileName = hash_file('sha256', $tmp) . '.bin';
    if (!move_uploaded_file($tmp, PRODUCT_MODEL_DIR . '/' . $fileName)) {
        send_json(['ok' => false, 'error' => 'Nao foi possivel proteger a previa 3D.'], 500);
    }
    $entry['modelFile'] = $fileName;
    $entry['modelTriangles'] = $triangles;
    $entry['updatedAt'] = gmdate('c');
    $meta[$id] = $entry;
    save_product_meta($meta);
    send_json(['ok' => true, 'meta' => public_meta($id, $entry)]);
}

if ($action === 'delete-model') {
    if (!empty($entry['modelFile'])) {
        $file = PRODUCT_MODEL_DIR . '/' . basename((string) $entry['modelFile']);
        if (is_file($file)) unlink($file);
    }
    unset($entry['modelFile'], $entry['modelTriangles']);
    $entry['updatedAt'] = gmdate('c');
    $meta[$id] = $entry;
    save_product_meta($meta);
    send_json(['ok' => true, 'meta' => public_meta($id, $entry)]);
}

$body = read_json_input();
$entry['categories'] = clean_terms($body['categories'] ?? []);
$entry['tags'] = clean_terms($body['tags'] ?? [], 24);
$entry['updatedAt'] = gmdate('c');
$meta[$id] = $entry;
save_product_meta($meta);
send_json(['ok' => true, 'meta' => public_meta($id, $entry)]);
