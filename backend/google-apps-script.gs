/* =========================================================
   Ursoninhos — google-apps-script.gs
   Web App que deixa o SITE escrever na planilha de produtos.

   COMO PUBLICAR (uma vez, ~5 minutos):
   1. Abra a planilha de produtos no Google Sheets.
   2. Extensões -> Apps Script. Apague o conteúdo e cole ESTE arquivo.
   3. Troque SYNC_KEY abaixo por uma senha sua.
   4. Implantar -> Nova implantação -> tipo "App da Web":
        - Executar como: EU (sua conta)
        - Quem pode acessar: QUALQUER PESSOA
   5. Copie a URL gerada (termina em /exec) e cole em
      config/mercadopago.php da Hostinger no campo privado
      sheet_web_app_url. Nunca coloque essa URL no JavaScript do site.

   O site então passa a:
   - adicionar uma linha quando alguém publica um modelo no manequim;
   - atualizar/incluir todas as linhas pelo botão "Sincronizar
     planilha" do Painel ADM (camisas de frases + modelos públicos).

   As colunas são criadas sozinhas na primeira escrita:
   id | nome | tipo | cor | preco | link | atualizado_em
   ========================================================= */

// Nunca publique a chave real no GitHub. Troque este valor somente no editor
// privado do Google Apps Script antes de implantar uma nova versao.
const SYNC_KEY = 'COLE_UMA_NOVA_CHAVE_FORTE_AQUI';
const SPREADSHEET_ID = '1FTHI9piD4iKAiQtldgm8dfp2-TOKosk5LPN-9a9KoFQ';
const SHEET_NAME = 'produtos';
const HEADERS = ['id', 'nome', 'tipo', 'cor', 'preco', 'link', 'atualizado_em'];

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  } else {
    const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (String(firstRow[0]).trim().toLowerCase() !== 'id') {
      throw new Error('A aba produtos existe, mas nao possui o cabecalho esperado.');
    }
  }
  return sheet;
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.key !== SYNC_KEY) {
    return respond({ ok: false, error: 'Chave invalida.' });
  }
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const products = values
    .filter((row) => String(row[0]).trim() !== '')
    .map((row) => {
      const item = {};
      headers.forEach((name, index) => { item[String(name)] = row[index]; });
      return item;
    });
  return respond({ ok: true, products });
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  if (params.key !== SYNC_KEY) {
    return respond({ ok: false, error: 'Chave invalida.' });
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (error) {
    return respond({ ok: false, error: 'JSON invalido.' });
  }

  if (body.action !== 'upsert' || !Array.isArray(body.products)) {
    return respond({ ok: false, error: 'Acao nao suportada.' });
  }

  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const idToRow = {}; // id -> numero da linha (1-based)
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    if (id) idToRow[id] = i + 1;
  }

  const now = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  let created = 0;
  let updated = 0;

  body.products.forEach((product) => {
    const id = String(product.id || '').trim();
    if (!id) return;

    const rowValues = [
      id,
      String(product.nome || ''),
      String(product.tipo || ''),
      String(product.cor || ''),
      Number(product.preco || 0),
      String(product.link || ''),
      now,
    ];

    if (idToRow[id]) {
      // Atualiza a linha existente SEM apagar um preço editado na mao:
      // o preco da planilha so muda se o site mandar um valor > 0
      // diferente do atual e o campo forcarPreco vier true.
      const row = idToRow[id];
      const precoAtual = sheet.getRange(row, 5).getValue();
      if (!product.forcarPreco && Number(precoAtual) > 0) {
        rowValues[4] = Number(precoAtual);
      }
      sheet.getRange(row, 1, 1, HEADERS.length).setValues([rowValues]);
      updated++;
    } else {
      sheet.appendRow(rowValues);
      created++;
    }
  });

  return respond({ ok: true, created, updated });
}
