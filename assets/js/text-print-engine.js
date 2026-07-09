/* =========================================================
   Ursoninhos — text-print-engine.js
   Motor COMPARTILHADO das estampas de texto: fontes, os 40
   estilos (TEXT_PRINT_PRESETS) e as funções de desenho no
   canvas. Era parte do main.js e foi extraído para que a
   página "Camisas de Frases" gere os mockups com os MESMOS
   estilos do modal "Crie sua estampa de texto".

   Carregue este arquivo ANTES de main.js (home) e antes de
   frases-page.js (vitrine de frases). Script clássico: tudo
   aqui fica no escopo global para os outros scripts usarem.
   ========================================================= */

const TEXT_SANS = 'Arial, Helvetica, sans-serif';
const TEXT_SERIF = "Georgia, 'Times New Roman', serif";
const TEXT_CURSIVE = "'Dancing Script', cursive";
const TEXT_CONDENSED = "'Bebas Neue', sans-serif";
const TEXT_ANTON = "'Anton', sans-serif";
const TEXT_PACIFICO = "'Pacifico', cursive";
const TEXT_CAVEAT = "'Caveat', cursive";
const TEXT_MARKER = "'Permanent Marker', cursive";
const TEXT_AMATIC = "'Amatic SC', cursive";
const TEXT_VIBES = "'Great Vibes', cursive";
const TEXT_LOBSTER = "'Lobster', cursive";
const TEXT_OSWALD = "'Oswald', sans-serif";
const TEXT_PLAYFAIR = "'Playfair Display', serif";
const TEXT_TYPEWRITER = "'Special Elite', 'Courier New', monospace";

const TEXT_PRINT_PRESETS = [
  {
    id: 'whatsapp',
    name: 'Balões WhatsApp',
    type: 'bubbles', // renderizador próprio (balões agrupados à esquerda)
  },
  {
    id: 'branco',
    name: 'Branco sólido',
    line: () => ({ font: TEXT_SANS, mul: 1, lh: 1.5 }),
  },
  {
    id: 'statement',
    name: 'Statement',
    line: () => ({ font: TEXT_CONDENSED, mul: 1.7, lh: 1.04, spacing: 0.03, upper: true }),
  },
  {
    id: 'contorno',
    name: 'Só contorno',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 1.1, lh: 1.32, mode: 'stroke', upper: true }),
  },
  {
    id: 'misto',
    name: 'Sólido + contorno',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid
        ? { font: TEXT_SANS, weight: 'bold', mul: 1.45, lh: 1.22, mode: 'stroke', upper: true }
        : { font: TEXT_SANS, weight: 'bold', mul: 0.95, lh: 1.4, upper: true };
    },
  },
  {
    id: 'cursiva',
    name: 'Cursiva',
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.35, lh: 1.3 }),
  },
  {
    id: 'mix',
    name: 'Arial + cursiva',
    line: (i) => (i % 2
      ? { font: TEXT_CURSIVE, weight: '600', mul: 2, lh: 1.12 }
      : { font: TEXT_SANS, mul: 0.68, lh: 1.7, spacing: 0.26, upper: true }),
  },
  {
    id: 'serif',
    name: 'Editorial',
    line: () => ({ font: "Georgia, 'Times New Roman', serif", italic: true, mul: 1, lh: 1.5 }),
  },
  {
    id: 'maquina',
    name: 'Máquina de escrever',
    line: (i, n) => ({ font: "'Courier New', monospace", mul: 0.85, lh: 1.62, lower: true, suffix: i === n - 1 ? '_' : '' }),
  },
  {
    id: 'dourado',
    name: 'Destaque dourado',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.42, upper: true, color: i === mid ? '#d9a75c' : '#ffffff' };
    },
  },

  /* --- Estilos 11 a 40, inspirados nas referências do Pinterest ---
     Recursos extras que o motor entende: bg (tarja atrás da linha),
     strike (palavra riscada), underline, glow (neon), rotate (linha
     inclinada), frame no preset (moldura) e decoTop/decoBottom
     (enfeites como corações, borboletas e coroa via emoji). */
  {
    id: 'marca-texto',
    name: 'Marca-texto',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid
        ? { font: TEXT_ANTON, mul: 1.1, lh: 1.32, upper: true, bg: '#b6e63e', color: '#141414' }
        : { font: TEXT_ANTON, mul: 1.1, lh: 1.32, upper: true };
    },
  },
  {
    id: 'coracao',
    name: 'Caligrafia + coração',
    line: (i, n) => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.3, lh: 1.28, suffix: i === n - 1 ? ' ❤️' : '' }),
  },
  {
    id: 'pincel-duo',
    name: 'Pincel duotone',
    line: (i) => ({ font: TEXT_MARKER, mul: 1.1, lh: 1.3, upper: true, color: i % 2 ? '#e24b4a' : '#ffffff' }),
  },
  {
    id: 'script-inclinado',
    name: 'Script inclinado',
    line: () => ({ font: TEXT_PACIFICO, mul: 1.3, lh: 1.5, color: '#e05545', rotate: -8 }),
  },
  {
    id: 'maquina-titulo',
    name: 'Máquina com título',
    line: (i) => (i === 0
      ? { font: TEXT_TYPEWRITER, mul: 1.4, lh: 1.4, spacing: 0.18 }
      : { font: TEXT_TYPEWRITER, mul: 0.66, lh: 1.7 }),
  },
  {
    id: 'borboletas',
    name: 'Borboletas',
    decoTop: { text: '🦋', style: { font: TEXT_SANS, mul: 0.9, lh: 1.5 } },
    decoBottom: { text: '🦋', style: { font: TEXT_SANS, mul: 0.9, lh: 1.5 } },
    line: (i) => (i % 2
      ? { font: TEXT_SANS, mul: 0.7, lh: 1.6, spacing: 0.24, upper: true }
      : { font: TEXT_VIBES, mul: 1.7, lh: 1.18 }),
  },
  {
    id: 'retro-teal',
    name: 'Retrô colorido',
    line: (i, n) => ({ font: TEXT_LOBSTER, mul: 1.35, lh: 1.35, color: '#35b5a5', suffix: i === n - 1 ? ' 📍' : '' }),
  },
  {
    id: 'empilhado',
    name: 'Empilhado dramático',
    decoTop: { text: '♛', style: { font: TEXT_SANS, mul: 0.7, lh: 1.4, color: '#d9a75c' } },
    line: (i) => (i % 2
      ? { font: TEXT_OSWALD, weight: '500', mul: 1.6, lh: 1.1, upper: true }
      : { font: TEXT_OSWALD, weight: '500', mul: 0.8, lh: 1.28, upper: true, spacing: 0.12, color: '#cfcfcf' }),
  },
  {
    id: 'caps-script',
    name: 'Caps + script final',
    line: (i, n) => (i === n - 1 && n > 1
      ? { font: TEXT_PACIFICO, mul: 1.7, lh: 1.4, color: '#d9a75c' }
      : { font: TEXT_SANS, weight: 'bold', mul: 0.8, lh: 1.5, upper: true, spacing: 0.08 }),
  },
  {
    id: 'emoldurado',
    name: 'Emoldurado',
    frame: { pad: 0.6 },
    line: () => ({ font: TEXT_SERIF, mul: 0.95, lh: 1.55, upper: true, spacing: 0.06 }),
  },
  {
    id: 'riscado',
    name: 'Riscado',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid && n > 1
        ? { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.4, upper: true, color: '#8f8f8f', strike: '#e24b4a' }
        : { font: TEXT_SANS, weight: 'bold', mul: 1.15, lh: 1.35, upper: true };
    },
  },
  {
    id: 'giz',
    name: 'Giz de quadro',
    line: () => ({ font: TEXT_AMATIC, weight: '700', mul: 1.9, lh: 1.05, upper: true }),
  },
  {
    id: 'gigante',
    name: 'Gigante quebrado',
    line: () => ({ font: TEXT_ANTON, mul: 2.1, lh: 1, upper: true }),
  },
  {
    id: 'destaque-final',
    name: 'Destaque na última',
    line: (i, n) => (i === n - 1 && n > 1
      ? { font: TEXT_SANS, weight: 'bold', mul: 1.1, lh: 1.55, upper: true, bg: '#ffffff', color: '#111111' }
      : { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.45, upper: true }),
  },
  {
    id: 'marcador',
    name: 'Marcador',
    line: () => ({ font: TEXT_MARKER, mul: 1.05, lh: 1.4 }),
  },
  {
    id: 'chuva-coracoes',
    name: 'Chuva de corações',
    decoBottom: { text: '❤️ ❤️ ❤️', style: { font: TEXT_SANS, mul: 0.55, lh: 1.6 } },
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.3, lh: 1.3 }),
  },
  {
    id: 'editorial-luxo',
    name: 'Editorial de luxo',
    line: () => ({ font: TEXT_PLAYFAIR, weight: '600', italic: true, mul: 1, lh: 1.5 }),
  },
  {
    id: 'caligrafia-ouro',
    name: 'Caligrafia dourada',
    line: () => ({ font: TEXT_VIBES, mul: 1.6, lh: 1.28, color: '#d9a75c' }),
  },
  {
    id: 'neon-rosa',
    name: 'Neon rosa',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 1.05, lh: 1.45, upper: true, color: '#ff6ec7', glow: '#ff2fa0' }),
  },
  {
    id: 'neon-azul',
    name: 'Neon azul cursiva',
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.35, lh: 1.3, color: '#7fe3ff', glow: '#20b9e8' }),
  },
  {
    id: 'taxi',
    name: 'Placa amarela',
    line: () => ({ font: TEXT_ANTON, mul: 1, lh: 1.55, upper: true, bg: '#f2c230', color: '#141414' }),
  },
  {
    id: 'etiquetas',
    name: 'Etiquetas brancas',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 0.95, lh: 1.65, upper: true, bg: '#ffffff', color: '#141414' }),
  },
  {
    id: 'sublinhado',
    name: 'Sublinhado',
    line: (i, n) => (i === n - 1
      ? { font: TEXT_OSWALD, weight: '500', mul: 1.25, lh: 1.32, upper: true, underline: '#d9a75c' }
      : { font: TEXT_OSWALD, weight: '500', mul: 1.25, lh: 1.32, upper: true }),
  },
  {
    id: 'minimal-espacado',
    name: 'Minimal espaçado',
    line: () => ({ font: TEXT_SANS, mul: 0.62, lh: 2, spacing: 0.5, upper: true }),
  },
  {
    id: 'classico-duplo',
    name: 'Clássico duplo',
    line: (i) => (i % 2
      ? { font: TEXT_SANS, mul: 0.7, lh: 1.55, upper: true, spacing: 0.2, color: '#cfcfcf' }
      : { font: TEXT_SERIF, italic: true, mul: 1.25, lh: 1.32 }),
  },
  {
    id: 'manuscrito',
    name: 'Manuscrito rápido',
    line: () => ({ font: TEXT_CAVEAT, weight: '600', mul: 1.5, lh: 1.18 }),
  },
  {
    id: 'cartaz-vintage',
    name: 'Cartaz vintage',
    frame: { pad: 0.7, double: true },
    line: () => ({ font: TEXT_PLAYFAIR, weight: '600', mul: 0.95, lh: 1.45, upper: true, spacing: 0.05 }),
  },
  {
    id: 'assinatura',
    name: 'Assinatura',
    line: () => ({ font: TEXT_VIBES, mul: 1.5, lh: 1.28, rotate: -5 }),
  },
  {
    id: 'pop-colorido',
    name: 'Pop colorido',
    line: (i) => ({ font: TEXT_PACIFICO, mul: 1.25, lh: 1.42, color: ['#ff6ec7', '#35b5a5', '#f2c230'][i % 3] }),
  },
  {
    id: 'grito',
    name: 'Grito',
    line: (i) => ({ font: TEXT_ANTON, mul: 1.5, lh: 1.08, upper: true, color: i % 2 ? '#ffffff' : '#e24b4a' }),
  },
];

const TEXT_PRINT_MAX_LINES = 6;
const TEXT_PRINT_SAMPLE = ['Toda vez que eu', 'olho pros meus pais,', 'vejo um milhão', 'de motivos'];

// Garante que as fontes do Google estejam prontas antes de desenhar no
// canvas (senão o navegador desenha com a fonte fallback).
const textFontsReady = Promise.all([
  document.fonts.load("600 100px 'Dancing Script'"),
  document.fonts.load("100px 'Bebas Neue'"),
  document.fonts.load("100px 'Anton'"),
  document.fonts.load("100px 'Pacifico'"),
  document.fonts.load("600 100px 'Caveat'"),
  document.fonts.load("100px 'Permanent Marker'"),
  document.fonts.load("700 100px 'Amatic SC'"),
  document.fonts.load("100px 'Great Vibes'"),
  document.fonts.load("100px 'Lobster'"),
  document.fonts.load("500 100px 'Oswald'"),
  document.fonts.load("italic 600 100px 'Playfair Display'"),
  document.fonts.load("100px 'Special Elite'"),
]).catch(() => {});

function textForLine(line, style) {
  let text = line;
  if (style.upper) text = text.toUpperCase();
  if (style.lower) text = text.toLowerCase();
  return text + (style.suffix || '');
}

function fontStringFor(style, size) {
  const italic = style.italic ? 'italic ' : '';
  const weight = style.weight ? `${style.weight} ` : '';
  return `${italic}${weight}${Math.round(size)}px ${style.font}`;
}

/* Motor de desenho. Tudo é medido numa fonte-base de 100px e depois
   escalado para caber na área útil do canvas — é isso que faz frase
   curta ficar grande e frase longa diminuir para caber. */
function drawTextPrint(canvas, preset, lines) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lines.length) return;

  const margin = canvas.width * 0.09;
  const availW = canvas.width - margin * 2;
  const availH = canvas.height - margin * 2;

  if (preset.type === 'bubbles') {
    drawBubblePrint(ctx, canvas, lines, availW, availH);
    return;
  }

  const BASE = 100;
  const n = lines.length;

  // Mede uma linha (texto do cliente ou enfeite) já com a folga da
  // tarja de fundo, quando houver.
  const makeSpec = (text, style) => {
    ctx.font = fontStringFor(style, BASE * style.mul);
    try { ctx.letterSpacing = `${(style.spacing || 0) * BASE * style.mul}px`; } catch (e) { /* sem suporte */ }
    let width = ctx.measureText(text).width;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* idem */ }
    if (style.bg) width += BASE * style.mul * 0.7;
    return { style, text, width, advance: BASE * style.mul * (style.lh || 1.3) };
  };

  const specs = [];
  if (preset.decoTop) specs.push(makeSpec(preset.decoTop.text, preset.decoTop.style));
  lines.forEach((line, i) => {
    const style = preset.line(i, n);
    specs.push(makeSpec(textForLine(line, style), style));
  });
  if (preset.decoBottom) specs.push(makeSpec(preset.decoBottom.text, preset.decoBottom.style));

  // Moldura reserva parte da área útil para não encostar no texto.
  const frameShrink = preset.frame ? 0.82 : 1;
  const maxWidth = Math.max(...specs.map((s) => s.width));
  const totalHeight = specs.reduce((sum, s) => sum + s.advance, 0);
  const scale = Math.min((availW * frameShrink) / maxWidth, (availH * frameShrink) / totalHeight);

  if (preset.frame) {
    const padF = BASE * scale * (preset.frame.pad || 0.6);
    const frameW = maxWidth * scale + padF * 2;
    const frameH = totalHeight * scale + padF * 2;
    const frameX = (canvas.width - frameW) / 2;
    const frameY = (canvas.height - frameH) / 2;
    ctx.strokeStyle = preset.frame.color || '#ffffff';
    ctx.lineWidth = Math.max(2, BASE * scale * 0.05);
    ctx.strokeRect(frameX, frameY, frameW, frameH);
    if (preset.frame.double) {
      const inset = ctx.lineWidth * 2.6;
      ctx.lineWidth = Math.max(1, ctx.lineWidth * 0.5);
      ctx.strokeRect(frameX + inset, frameY + inset, frameW - inset * 2, frameH - inset * 2);
    }
  }

  let y = (canvas.height - totalHeight * scale) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  specs.forEach((spec) => {
    const style = spec.style;
    const size = BASE * style.mul * scale;
    const textWidth = (spec.width - (style.bg ? BASE * style.mul * 0.7 : 0)) * scale;
    const baseline = y + size * 0.82;
    const cx = canvas.width / 2;

    ctx.save();

    // Linha inclinada (ex.: scripts com rotação leve).
    if (style.rotate) {
      const pivotY = baseline - size * 0.35;
      ctx.translate(cx, pivotY);
      ctx.rotate((style.rotate * Math.PI) / 180);
      ctx.translate(-cx, -pivotY);
    }

    ctx.font = fontStringFor(style, size);
    try { ctx.letterSpacing = `${(style.spacing || 0) * size}px`; } catch (e) { /* sem suporte */ }

    // Tarja de fundo (marca-texto / etiqueta / placa).
    if (style.bg) {
      const padH = size * 0.35;
      ctx.fillStyle = style.bg;
      ctx.fillRect(cx - textWidth / 2 - padH, baseline - size * 0.86, textWidth + padH * 2, size * 1.14);
    }

    // Brilho neon: sombra colorida + segunda passada do texto.
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = size * 0.45;
    }

    if (style.mode === 'stroke') {
      ctx.strokeStyle = style.color || '#ffffff';
      ctx.lineWidth = Math.max(1.2, size * 0.05);
      ctx.strokeText(spec.text, cx, baseline);
    } else {
      ctx.fillStyle = style.color || '#ffffff';
      ctx.fillText(spec.text, cx, baseline);
      if (style.glow) ctx.fillText(spec.text, cx, baseline);
    }

    ctx.shadowBlur = 0;

    if (style.strike) {
      ctx.strokeStyle = style.strike;
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx - textWidth / 2 - size * 0.1, baseline - size * 0.28);
      ctx.lineTo(cx + textWidth / 2 + size * 0.1, baseline - size * 0.28);
      ctx.stroke();
    }

    if (style.underline) {
      ctx.strokeStyle = style.underline;
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.beginPath();
      ctx.moveTo(cx - textWidth / 2, baseline + size * 0.14);
      ctx.lineTo(cx + textWidth / 2, baseline + size * 0.14);
      ctx.stroke();
    }

    ctx.restore();
    y += spec.advance * scale;
  });
}

/* Balões estilo WhatsApp: cada linha vira um balão com a largura do
   próprio texto, todos alinhados à esquerda. Lado direito sempre bem
   redondo; no lado esquerdo, só o topo do primeiro e a base do último
   têm curva grande — os cantos onde os balões se encostam são curtos,
   como nas mensagens agrupadas do WhatsApp (igual ao print). */
function drawBubblePrint(ctx, canvas, lines, availW, availH) {
  const BASE = 100;
  ctx.font = `${BASE}px ${TEXT_SANS}`;

  const padH = BASE * 0.62;
  const padV = BASE * 0.42;
  const gap = BASE * 0.22;
  const bubbleH = BASE + padV * 2;

  const widths = lines.map((line) => ctx.measureText(line).width + padH * 2);
  const maxBubbleW = Math.max(...widths);
  const totalH = lines.length * bubbleH + (lines.length - 1) * gap;
  const scale = Math.min(availW / maxBubbleW, availH / totalH);

  const x0 = (canvas.width - maxBubbleW * scale) / 2;
  let y = (canvas.height - totalH * scale) / 2;

  const rBig = bubbleH * scale * 0.5;
  const rSmall = bubbleH * scale * 0.14;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const w = widths[i] * scale;
    const h = bubbleH * scale;
    const first = i === 0;
    const last = i === lines.length - 1;
    // Cantos: [sup-esq, sup-dir, inf-dir, inf-esq]
    const corners = [first ? rBig : rSmall, rBig, rBig, last ? rBig : rSmall];

    ctx.fillStyle = '#2e2e30';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x0, y, w, h, corners);
    } else {
      ctx.rect(x0, y, w, h); // fallback simples para navegadores antigos
    }
    ctx.fill();

    ctx.fillStyle = '#f7f7f7';
    ctx.font = `${BASE * scale}px ${TEXT_SANS}`;
    ctx.fillText(line, x0 + padH * scale, y + h / 2 + BASE * scale * 0.06);

    y += h + gap * scale;
  });
}
