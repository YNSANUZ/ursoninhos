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

/* Produtos novos importados da coleção de imagens em 21/07/2026.
   Cada item tem ID e estilo fixos: reordenar esta lista não altera URLs
   nem troca a arte de produtos que já foram publicados. Posts de
   divulgação, arrobas, links, assinaturas e duplicatas foram excluídos. */
const FRASES_CURADAS = [
  { shortId: '8548', frase: '— Não vai dar certo. — Claro que vai; eu sou maluco.', presetId: 'dialogo-duplo', maxLines: 6 },
  { shortId: '8549', frase: 'Já fiz muito barulho. É hora de ficar em silêncio.', presetId: 'marcador-seco' },
  { shortId: '8550', frase: 'Talvez o "para sempre" seja sobre memórias, não pessoas.', presetId: 'serifa-impacto' },
  { shortId: '8551', frase: 'Seja esperto: perceba tudo, mas aja como se não soubesse de nada.', presetId: 'manifesto' },
  { shortId: '8552', frase: 'Seja amável. A vida é um espelho.', presetId: 'minimal-forte' },
  { shortId: '8553', frase: 'Mesma árvore, estação diferente. Lembre-se: tudo é temporário.', presetId: 'marcador-seco' },
  { shortId: '8554', frase: 'O jogo começa quando você aceita que ninguém virá salvá-lo. Crie sua própria saída.', presetId: 'cartaz-impacto', maxLines: 10 },
  { shortId: '8555', frase: 'Quando sentir que vai desistir, lembre-se do porquê começou.', presetId: 'fecho-forte' },
  { shortId: '8556', frase: 'Todos precisamos de um momento de escuridão para ver quem realmente brilha em nossa vida.', presetId: 'coluna-condensada', maxLines: 9 },
  { shortId: '8557', frase: '0% talento. 100% obsessão.', presetId: 'contraste-central' },
  { shortId: '8558', frase: 'O conforto é o pior vício.', presetId: 'palavra-chave' },
  { shortId: '8559', frase: 'O cemitério está cheio de pessoas que se julgavam indispensáveis.', presetId: 'cartaz-impacto' },
  { shortId: '8560', frase: 'Não fique em um lugar perigoso esperando não ser atingido.', presetId: 'impacto-destaques' },
  { shortId: '8561', frase: 'Você pode convencer um sábio com razão, mas não pode convencer um tolo com provas.', presetId: 'manifesto' },
  { shortId: '8562', frase: 'Ouça sempre duas vezes: primeiro o que é dito, depois quem diz.', presetId: 'serifa-impacto' },
  { shortId: '8563', frase: 'A verdade soa como ódio para quem odeia a verdade.', presetId: 'manchete-amarela' },
  { shortId: '8564', frase: 'É exaustivo viver para agradar. Desagrade.', presetId: 'comando-final' },
  { shortId: '8565', frase: 'Eu nunca vi alguém feliz perturbando a vida dos outros.', presetId: 'marcador-seco' },
  { shortId: '8566', frase: 'Foi libertador entender que ser uma boa pessoa não exige gentileza com quem é cruel comigo.', presetId: 'bloco-branco', maxLines: 9 },
  { shortId: '8567', frase: 'O irônico de envelhecer é que a vista piora, mas você passa a enxergar melhor as pessoas.', presetId: 'coluna-condensada', maxLines: 9 },
  { shortId: '8568', frase: 'Bem-aventurado o coração que sonha.', presetId: 'fe-dourada' },
  { shortId: '8569', frase: 'Eu não sou os outros. Não espere que eu pense ou faça algo só porque todos fazem.', presetId: 'manifesto' },
  { shortId: '8570', frase: '— É muito fundo aí? — Bate no meu pescoço. A realidade do outro não é a sua realidade.', presetId: 'dialogo-duplo', maxLines: 8 },
  { shortId: '8571', frase: 'Não se preocupe em ser bom. Preocupe-se em ser justo.', presetId: 'impacto-destaques' },
  { shortId: '8572', frase: 'A maior distância entre duas pessoas é o mal-entendido.', presetId: 'marcador-seco' },
  { shortId: '8573', frase: 'Também tem gente falando bem de você pelas costas.', presetId: 'minimal-forte' },
  { shortId: '8574', frase: 'Também tem gente orando por você em silêncio.', presetId: 'fe-dourada' },
  { shortId: '8575', frase: 'Também tem gente lembrando de você com carinho.', presetId: 'duas-vozes' },
  { shortId: '8576', frase: 'A nossa melhor versão precisa existir dentro de casa. Caso contrário, o resto é encenação.', presetId: 'manifesto' },
  { shortId: '8577', frase: 'Acostume-se a ter coisas boas. Você trabalha para isso.', presetId: 'comando-final' },
  { shortId: '8578', frase: 'Posso ter mil defeitos, mas nenhum deles é ter um coração ruim.', presetId: 'marcador-seco' },
  { shortId: '8579', frase: 'A lealdade é rara. Se você encontrar, conserve.', presetId: 'fecho-forte' },
  { shortId: '8580', frase: 'A morte não avisa. Então saiba que eu amo você com toda a minha alma.', presetId: 'duas-vozes' },
  { shortId: '8581', frase: 'Sorria e trate todos bem, mas preste atenção na maldade de cada um.', presetId: 'impacto-destaques' },
  { shortId: '8582', frase: 'Sou difícil de lidar, mas minha lealdade é inquestionável.', presetId: 'marcador-seco' },
  { shortId: '8583', frase: 'Não somos iguais. Enquanto sua família resolvia seus problemas, a minha nem sabia que eu tinha um.', presetId: 'cartaz-impacto', maxLines: 10 },
  { shortId: '8584', frase: 'Nunca vou entender quem sente inveja dos próprios amigos. Quero ver os meus conquistando tudo o que sonham.', presetId: 'manifesto', maxLines: 9 },
  { shortId: '8585', frase: 'Inteligente é quem se faz de doido e vive.', presetId: 'minimal-forte' },
  { shortId: '8586', frase: 'Não existe nada que eu não consiga quando decido me dedicar.', presetId: 'escada-tipografica' },
  { shortId: '8587', frase: 'Amor-próprio é quando a onda percebe que é oceano.', presetId: 'serifa-impacto' },
  { shortId: '8588', frase: 'Nunca diga a alguém para ser forte quando essa pessoa procura você para poder ser fraca.', presetId: 'duas-vozes', maxLines: 8 },
  { shortId: '8589', frase: 'Deseje o bem a todos, mas afaste-se de quem não torce por você.', presetId: 'marcador-seco' },
  { shortId: '8590', frase: 'Eu achava meus pais rígidos. Vendo a geração de hoje, percebo que eles me salvaram.', presetId: 'manifesto' },
  { shortId: '8591', frase: 'Faça dinheiro e aja como se estivesse sem nenhum. Tenha mais do que mostra e fale menos do que sabe.', presetId: 'cartaz-impacto', maxLines: 10 },
  { shortId: '8592', frase: 'Na vida, seu maior professor é seu erro: cobra caro, mas ensina bem.', presetId: 'impacto-destaques' },
  { shortId: '8593', frase: 'O deboche só dura até o resultado chegar. Então você passa de louco a gênio.', presetId: 'comando-final' },
  { shortId: '8594', frase: 'Meu foco é trabalhar e fazer dinheiro. Falar dos outros eu deixo para quem tem tempo.', presetId: 'manifesto' },
  { shortId: '8595', frase: 'Só revele seu céu a quem celebra seu voo.', presetId: 'fe-dourada' },
  { shortId: '8596', frase: 'Cometa erros, mas nunca os mesmos.', presetId: 'palavra-chave' },
  { shortId: '8597', frase: 'Tive medo de errar. E errei. Que bom: um medo a menos.', presetId: 'dialogo-duplo' },
  { shortId: '8598', frase: 'Tarde foi ontem. Hoje ainda dá tempo.', presetId: 'comando-final' },
  { shortId: '8599', frase: 'Sua direção importa mais do que sua velocidade.', presetId: 'escada-tipografica' },
  { shortId: '8600', frase: 'Tenho tanto para melhorar em mim que não posso me tornar juiz de ninguém.', presetId: 'marcador-seco' },
  { shortId: '8601', frase: 'Enquanto eu estiver vivo, posso começar de novo. De novo. E de novo.', presetId: 'ritmo-branco' },
  { shortId: '8602', frase: 'Daqui a seis meses, você terá seis meses de desculpas ou seis meses de progresso.', presetId: 'contraste-central' },
  { shortId: '8603', frase: 'A luta constrói o caráter.', presetId: 'palavra-chave' },
  { shortId: '8604', frase: 'Fique perto de quem celebra seu voo.', presetId: 'fecho-forte' },
  { shortId: '8605', frase: 'Depois que você aprende a dizer "tá bom" em vez de discutir, sua vida avança sete passos.', presetId: 'duas-vozes' },
  { shortId: '8606', frase: 'A vida é curta demais para viver o mínimo das coisas.', presetId: 'marcador-seco' },
  { shortId: '8607', frase: 'Duvide de mim. Vai ser divertido.', presetId: 'comando-final' },
  { shortId: '8608', frase: 'Não acredite na sorte. Acredite no seu trabalho.', presetId: 'impacto-destaques' },
  { shortId: '8609', frase: 'Lealdade é um presente caro. Não espere isso de pessoas baratas.', presetId: 'manchete-amarela' },
  { shortId: '8610', frase: 'Viu? Nenhum deles era seu amigo, e você ainda os defendia tanto.', presetId: 'duas-vozes' },
  { shortId: '8611', frase: 'Onde pessoas sábias dialogam, opiniões diferentes não geram conflitos: geram novas ideias.', presetId: 'cartaz-impacto', maxLines: 10 },
  { shortId: '8612', frase: 'Que privilégio estar exausto por uma rotina que um dia pedi para ter.', presetId: 'fe-dourada' },
  { shortId: '8613', frase: 'Viciei meu cérebro em evolução, não em validação.', presetId: 'impacto-destaques' },
  { shortId: '8614', frase: 'Quanto menos souberem de mim, melhor.', presetId: 'minimal-forte' },
  { shortId: '8615', frase: 'Nem tudo o que a gente quer serve para a gente.', presetId: 'marcador-seco' },
  { shortId: '8616', frase: 'Privacidade é poder. O que as pessoas não sabem, elas não podem arruinar.', presetId: 'manifesto' },
  { shortId: '8617', frase: 'Eu me curei da síndrome de salva-vidas. Afogue-se quem quiser.', presetId: 'comando-final' },
  { shortId: '8618', frase: 'Imagine se o dono da cafeteria desistisse porque todo mundo tem café em casa. Pense nisso.', presetId: 'cartaz-impacto', maxLines: 10 },
  { shortId: '8619', frase: 'Gente desinteressada desinteressa a gente.', presetId: 'marcador-seco' },
  { shortId: '8620', frase: 'Nós somos o que carregamos no coração. O resto é aparência.', presetId: 'serifa-impacto' },
  { shortId: '8621', frase: 'A vida às vezes é difícil. Mas vou contar um segredo: você é mais forte.', presetId: 'fecho-forte' },
  { shortId: '8622', frase: 'O bem sempre volta ao remetente. Lembre-se disso.', presetId: 'marcador-seco' },
  { shortId: '8623', frase: 'Tudo em mim sempre será amor, mesmo quando não me amarem de volta.', presetId: 'serifa-impacto' },
  { shortId: '8624', frase: 'Hoje reparei que a minha grama também é verde para caramba.', presetId: 'marcador-seco' },
  { shortId: '8625', frase: 'Pregue primeiro em você os sermões que prega nos outros.', presetId: 'manifesto' },
  { shortId: '8626', frase: 'Eu me recuso a ser apenas mais um.', presetId: 'palavra-chave' },
  { shortId: '8627', frase: 'Espero que você se cure das coisas pelas quais nunca recebeu um pedido de desculpas.', presetId: 'duas-vozes', maxLines: 8 },
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

  // Os 48 produtos antigos conservam a distribuição original entre os
  // 40 presets que existiam quando foram publicados.
  const presetsLegados = TEXT_PRINT_PRESETS.slice(0, 40);
  const produtosLegados = unicas.map((frase, index) => {
    const preset = presetsLegados[index % presetsLegados.length];
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

  const produtosCurados = FRASES_CURADAS.map((item) => {
    const preset = TEXT_PRINT_PRESETS.find((candidate) => candidate.id === item.presetId) || TEXT_PRINT_PRESETS[1];
    const maxLines = item.maxLines || preset.maxLines || TEXT_PRINT_MAX_LINES;
    return {
      id: `frase-${item.shortId}`,
      shortId: item.shortId,
      shortPath: `/${item.shortId}/`,
      categoria: 'camisas-de-frases',
      tipo: 'camisa',
      frase: item.frase,
      titulo: tituloDeFrase(item.frase),
      linhas: item.linhas || quebrarFraseEmLinhas(item.frase, maxLines),
      presetId: preset.id,
      presetName: preset.name,
      preco: FRASES_PRECO_PADRAO,
      tags: FRASES_TAGS,
    };
  });

  return [...produtosLegados, ...produtosCurados];
}

window.UrsoninhosFrases = {
  FRASES_DESMOTIVACIONAIS,
  FRASES_CURADAS,
  FRASES_PRECO_PADRAO,
  FRASES_SHORT_ID_BASE,
  FRASES_TAGS,
  gerarProdutosDeFrases,
  quebrarFraseEmLinhas,
};
