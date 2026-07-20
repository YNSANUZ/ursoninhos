/* =========================================================
   Ursoninhos — frases-data.js
   Fonte ÚNICA das "Camisas de Frases" (frases desmotivacionais).

   >>> PARA ADICIONAR UMA FRASE NOVA: acrescente uma string no
   >>> array FRASES_DESMOTIVACIONAIS abaixo. Só isso. O produto,
   >>> o estilo (rodízio automático entre todos os estilos do
   >>> modal de texto) e o mockup são gerados sozinhos.

   Depende de text-print-engine.js (TEXT_PRINT_PRESETS) já
   carregado — a distribuição de estilos usa a lista real de
   estilos do modal "Crie sua estampa de texto".
   ========================================================= */

const FRASES_DESMOTIVACIONAIS = [
  'Tudo saindo conforme o não planejado.',
  'Vai dar certo! Errado já está dando.',
  'Veja pelo lado bom: não há!',
  'A gente deveria receber adicional humilhação.',
  'Na hora certa, tudo vai dar errado.',
  'Vamos nos desesperar com calma.',
  'Eu sei que má notícia gosta de companhia, mas as minhas andam de mutirão.',
  'Na mala da vida, eu sou o xampu que abre a tampa e sai sujando e estragando tudo.',
  'De longe você parecia feio. De perto, parece que você está de longe.',
  'Relaxe, está tudo absolutamente fora do seu controle.',
  'A vida é um pêndulo entre o "me dei mal" e o "me ferrei".',
  'Para quem já está humilhado, o que é mais uma derrota?',
  'Está vendo o carro novo do seu chefe? Se você seguir trabalhando com todo esse empenho, em seis meses ou um ano, ele vai conseguir comprar outro.',
  'Essa vergonha você vai passar no cartão ou no débito?',
  'A luz no fim do túnel? Foi cortada por falta de pagamento.',
  '(Ch)oremos!',
  'É um absurdo, mas faz sentido.',
  'Eu esperava o pior, mas isso foi bem pior do que eu esperava.',
  'O mérito da derrota é todo seu, orgulhe-se.',
  'Não desista! A vida vai fazer isso por você.',
  'Por causa de gente como você que na caixa de ovo vem escrito "contém ovo".',
  'Na cozinha da vida eu só sei fritar ovo e, de vez em quando, ainda queimo.',
  'Eu até tento esquecer meus problemas, mas eles parecem que não se esquecem de mim.',
  'É como diz o ditado: agora deu ruim!',
  'Faça uma vez, erre uma vez. Faça de novo, erre de novo.',
  'Vocês são as amizades que minha mãe pediu para eu evitar.',
  'Se alguém quiser me derrubar hoje, vai ter que me ajudar a levantar primeiro porque eu já estou no chão.',
  'Se minha vida fosse um dia da semana, eu seria uma segunda-feira pós-feriadão.',
  'Não sabendo que era impossível, foi lá e soube.',
  'Ouvi falar que cada um carregava sua cruz, mas a vida está achando que eu sou caminhão de frete e passando umas a mais para mim.',
  'Estou doida para ganhar na loteria e poder postar foto com legenda sobre a felicidade estar nas coisas simples.',
  'Na subida para meu sucesso, o elevador está quebrado, a escada está escorregadia e, de vez em quando, passa alguém subindo apressado e quase me derrubando no caminho.',
  'Você não pode mudar o seu passado, mas pode estragar seu futuro.',
  'A cada dia que passa, está sobrando mais mês no fim do dinheiro.',
  'A recompensa pelo bom trabalho é mais trabalho.',
  'A vida é um teste. Pena que esqueci de estudar.',
  'Nunca desista, faça até dar errado.',
  'A vida é um lindo conto de falhas.',
  'Tudo aquilo que você passou até agora está te preparando para algo pior.',
  'Um dia você perde. No outro você não ganha.',
  'Se o plano A falhar, não se preocupe. O plano B também vai.',
  'Depois da tempestade, vem a enchente.',
  'Ano novo, vida nova e mais 365 oportunidades de fazer besteira.',
  'Procrastinar é acreditar no potencial do seu "eu" de amanhã e se enganar por vários dias seguidos.',
  'Errar uma vez é humano. Repetir o erro, só eu mesmo.',
  'Na viagem da vida, meu GPS está quebrado, estou sem copiloto e o carro bem que precisa de uma revisão.',
  'Respire fundo... e aceite que não tem solução.',
  'O que não mata, humilha.',
];

const FRASES_PRECO_PADRAO = 49.9; // frente simples no novo padrão da loja
const FRASES_SHORT_ID_BASE = 8500;

// Palavras-chave da categoria: usadas nos cards (data-tags), na busca do
// site e no SEO da página, para "frases", "desmotivacionais" e
// "frases desmotivacionais" levarem até esta vitrine.
const FRASES_TAGS = ['frases', 'desmotivacionais', 'frases desmotivacionais', 'camisas de frases'];

// Slug único e legível a partir da frase (sem acentos/pontuação).
function slugDeFrase(frase) {
  return frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-') || 'frase';
}

// Título curto para o card (primeiras palavras, sem número).
function tituloDeFrase(frase) {
  const palavras = frase.replace(/\s+/g, ' ').trim().split(' ');
  const curto = palavras.slice(0, 5).join(' ');
  return palavras.length > 5 ? `${curto}…` : curto;
}

/* Quebra a frase em linhas equilibradas para a estampa: frases longas
   viram mais linhas (até o limite do motor de texto) com comprimentos
   parecidos, para o texto não sair da área nem ficar minúsculo. */
function quebrarFraseEmLinhas(frase, maxLinhas = TEXT_PRINT_MAX_LINES) {
  const texto = frase.replace(/\s+/g, ' ').trim();
  const palavras = texto.split(' ');
  if (palavras.length === 1) return [texto];

  // ~16 caracteres por linha fica legível no peito da camisa.
  const numLinhas = Math.min(maxLinhas, palavras.length, Math.max(1, Math.round(texto.length / 16)));
  const alvo = texto.length / numLinhas;

  const linhas = [];
  let atual = '';
  palavras.forEach((palavra) => {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    // Fecha a linha quando passar do alvo — menos na última, que recebe o resto.
    if (atual && candidata.length > alvo && linhas.length < numLinhas - 1) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidata;
    }
  });
  if (atual) linhas.push(atual);
  return linhas.slice(0, maxLinhas);
}

/* Gera os produtos automaticamente: remove repetições, e distribui os
   estilos do modal de texto em RODÍZIO (frase 1 -> estilo 1, frase 2 ->
   estilo 2...; acabando os estilos, recomeça — mantendo variedade). */
function gerarProdutosDeFrases() {
  const vistas = new Set();
  const unicas = FRASES_DESMOTIVACIONAIS.filter((frase) => {
    const chave = frase.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  const presets = TEXT_PRINT_PRESETS;
  return unicas.map((frase, index) => {
    const preset = presets[index % presets.length];
    return {
      id: `${slugDeFrase(frase)}-${index}`,
      shortId: String(FRASES_SHORT_ID_BASE + index),
      shortPath: `/${FRASES_SHORT_ID_BASE + index}/`,
      categoria: 'camisas-de-frases',
      tipo: 'camisa',
      frase,
      titulo: tituloDeFrase(frase),
      linhas: quebrarFraseEmLinhas(frase),
      presetId: preset.id,
      presetName: preset.name,
      preco: FRASES_PRECO_PADRAO,
      tags: FRASES_TAGS,
    };
  });
}

window.UrsoninhosFrases = {
  FRASES_DESMOTIVACIONAIS,
  FRASES_PRECO_PADRAO,
  FRASES_SHORT_ID_BASE,
  FRASES_TAGS,
  gerarProdutosDeFrases,
  quebrarFraseEmLinhas,
};
