(function () {
  const MAX_LAYERS_PER_SIDE = 3;
  const SIDES = ['front', 'back', 'sleeveRight', 'sleeveLeft'];
  const imageCache = new Map();

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeTransform(transform = {}) {
    return {
      scale: Math.max(0.22, Math.min(2.35, numberOr(transform.scale, 1))),
      offsetX: Math.max(-24, Math.min(24, numberOr(transform.offsetX, 0))),
      offsetY: Math.max(-24, Math.min(24, numberOr(transform.offsetY, 0))),
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
    return {
      id: String(layer.id || `layer-${index + 1}`),
      name: String(layer.name || (textData ? 'Texto' : 'Imagem')),
      type: textData || layer.type === 'text' ? 'text' : 'image',
      url,
      blend: ['screen', 'normal'].includes(layer.blend) ? layer.blend : 'normal',
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

  async function composeLayers(layers, options = {}) {
    const normalized = normalizeSide(layers);
    if (!normalized.length) return '';

    const size = Math.max(256, Number(options.size || 1024));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const baseRatio = Number(options.baseRatio || 1);

    for (const layer of normalized) {
      const image = await loadImage(layer.url);
      const transform = layer.transform;
      const box = size * baseRatio * transform.scale;
      const ratio = (image.naturalWidth || image.width) / (image.naturalHeight || image.height) || 1;
      let width = box;
      let height = box;
      if (ratio > 1) height = box / ratio;
      else width = box * ratio;

      const centerX = size * (0.5 + transform.offsetX / 100);
      const centerY = size * (0.5 + transform.offsetY / 100);
      ctx.globalCompositeOperation = layer.blend === 'screen' ? 'screen' : 'source-over';
      ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
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
