(function () {
  const MAX_LAYERS_PER_SIDE = 3;
  const SIDES = ['front', 'back', 'sleeveRight', 'sleeveLeft'];
  const imageCache = new Map();
  const blackKeyCache = new Map();

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeTransform(transform = {}) {
    return {
      scale: Math.max(0.22, Math.min(2.35, numberOr(transform.scale, 1))),
      offsetX: Math.max(-24, Math.min(24, numberOr(transform.offsetX, 0))),
      offsetY: Math.max(-24, Math.min(24, numberOr(transform.offsetY, 0))),
      // Rotação da estampa em graus (-180 a 180). Aplicada aqui, na
      // composição 2D — o decal 3D projeta a imagem já rotacionada, sem
      // precisar mexer no motor three.js.
      rotation: Math.max(-180, Math.min(180, numberOr(transform.rotation, 0))),
    };
  }

  function normalizeTextData(textData) {
    if (!textData || typeof textData !== 'object') return null;
    const lines = Array.isArray(textData.lines)
      ? textData.lines.map((line) => String(line).trim()).filter(Boolean).slice(0, 12)
      : String(textData.text || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 12);
    return {
      text: lines.join('\n'),
      lines,
      presetId: String(textData.presetId || 'statement'),
    };
  }

  function normalizeLayer(layer, index = 0) {
    if (!layer || typeof layer !== 'object') return null;
    const url = String(layer.url || layer.file || '').trim();
    if (!url) return null;
    const textData = normalizeTextData(layer.textData || layer.text);
    const isBuiltInBlackArtwork = /(?:^|\/)assets\/img\/prints\/[^/?#]+\.(?:jpe?g|webp)(?:[?#].*)?$/i.test(url);
    return {
      id: String(layer.id || `layer-${index + 1}`),
      name: String(layer.name || (textData ? 'Texto' : 'Imagem')),
      type: textData || layer.type === 'text' ? 'text' : 'image',
      url,
      originalUrl: String(layer.originalUrl || layer.originalFile || url),
      imageTreatment: ['original', 'remove-dark', 'invert-mono'].includes(layer.imageTreatment)
        ? layer.imageTreatment
        : 'original',
      darkBackgroundDetected: Boolean(layer.darkBackgroundDetected),
      blend: isBuiltInBlackArtwork
        ? 'screen'
        : ['screen', 'normal'].includes(layer.blend) ? layer.blend : 'normal',
      transform: normalizeTransform(layer.transform),
      textData,
    };
  }

  function normalizeSide(side) {
    if (!side) return [];
    const source = Array.isArray(side)
      ? side
      : Array.isArray(side.layers)
        ? side.layers
        : side.url || side.file
          ? [side]
          : [];
    return source
      .map((layer, index) => normalizeLayer(layer, index))
      .filter(Boolean)
      .slice(0, MAX_LAYERS_PER_SIDE);
  }

  function normalizeModel(model = {}) {
    return SIDES.reduce((result, side) => {
      result[side] = normalizeSide(model?.[side]);
      return result;
    }, {});
  }

  function serializeSide(layers) {
    const normalized = normalizeSide(layers);
    if (!normalized.length) return null;
    const first = normalized[0];
    return {
      url: first.url,
      blend: first.blend,
      transform: first.transform,
      layers: normalized,
    };
  }

  function serializeModel(model = {}) {
    return SIDES.reduce((result, side) => {
      result[side] = serializeSide(model?.[side]);
      return result;
    }, {});
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  /* O modo screen funciona quando a arte é desenhada diretamente sobre
     a camisa, mas não quando primeiro juntamos várias camadas num PNG
     transparente: nesse caso o preto voltaria a ser um retângulo opaco.
     Para manter o mesmo resultado em 2D, 3D, carrinho e página do produto,
     convertemos apenas as artes marcadas como screen para uma matriz com
     transparência gradual. A imagem original nunca é modificada. */
  function keyOutBlackBackground(image, cacheKey) {
    if (blackKeyCache.has(cacheKey)) return blackKeyCache.get(cacheKey);

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const TRANSPARENT_AT = 10;
    const OPAQUE_AT = 72;

    for (let index = 0; index < pixels.length; index += 4) {
      const brightness = Math.max(
        pixels[index],
        pixels[index + 1],
        pixels[index + 2]
      );
      const matte = Math.max(
        0,
        Math.min(1, (brightness - TRANSPARENT_AT) / (OPAQUE_AT - TRANSPARENT_AT))
      );
      pixels[index + 3] = Math.round(pixels[index + 3] * matte);
    }

    ctx.putImageData(imageData, 0, 0);
    blackKeyCache.set(cacheKey, canvas);
    return canvas;
  }

  async function composeLayers(layers, options = {}) {
    const normalized = normalizeSide(layers);
    if (!normalized.length) return '';

    const size = Math.max(256, Number(options.size || 1024));
    const isBodySide = options.side === 'front' || options.side === 'back';
    // Frente e costas usam a área real aproximada da prensa: um campo
    // vertical que vai de perto da gola até a região acima da barra.
    // Mangas continuam quadradas.
    const width = Math.max(256, Number(options.width || size));
    const height = Math.max(256, Number(options.height || (isBodySide ? Math.round(width * 1.45) : size)));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const baseRatio = Number(options.baseRatio ?? (isBodySide ? 0.68 : 1));
    const offsetXReach = isBodySide ? 1.55 : 1;
    const offsetYReach = isBodySide ? 1.45 : 1;

    for (const layer of normalized) {
      const image = await loadImage(layer.url);
      const drawable = layer.blend === 'screen'
        ? keyOutBlackBackground(image, layer.url)
        : image;
      const transform = layer.transform;
      const box = width * baseRatio * transform.scale;
      const ratio = (drawable.naturalWidth || drawable.width) / (drawable.naturalHeight || drawable.height) || 1;
      let drawWidth = box;
      let drawHeight = box;
      if (ratio > 1) drawHeight = box / ratio;
      else drawWidth = box * ratio;

      const centerX = width * (0.5 + (transform.offsetX / 100) * offsetXReach);
      const centerY = height * (0.5 + (transform.offsetY / 100) * offsetYReach);
      ctx.globalCompositeOperation = 'source-over';
      if (transform.rotation) {
        // Gira em torno do CENTRO da estampa, sem mover a posição.
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.drawImage(drawable, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      } else {
        ctx.drawImage(drawable, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    return canvas.toDataURL('image/png');
  }

  function countLayersBySide(model = {}) {
    const normalized = normalizeModel(model);
    return SIDES.reduce((counts, side) => {
      counts[side] = normalized[side].length;
      return counts;
    }, {});
  }

  window.UrsoninhosLayers = {
    MAX_LAYERS_PER_SIDE,
    SIDES,
    normalizeTransform,
    normalizeLayer,
    normalizeSide,
    normalizeModel,
    serializeSide,
    serializeModel,
    composeLayers,
    countLayersBySide,
  };
})();
