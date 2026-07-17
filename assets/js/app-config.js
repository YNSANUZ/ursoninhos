(function () {
  const origin = window.location.origin || '';
  const isBackendHost = /primusdf\.com\.br$/.test(window.location.hostname || '');
  const backendOrigin = isBackendHost ? origin : 'https://primusdf.com.br';
  window.URSONINHOS_APP_CONFIG = {
    backendBaseUrl: `${backendOrigin}/_ursoninhos_backend/api`,
    paymentsBaseUrl: `${backendOrigin}/_ursoninhos_backend/api`,
    // Chave PUBLICA de teste do Checkout Transparente / Payment Brick.
    // O Access Token privado nunca deve ser colocado neste arquivo.
    mercadoPagoPublicKey: 'APP_USR-684d5e66-929b-41a4-b9a8-0c4eb60312d3',
    defaultLogoUrl: 'https://i.ibb.co/6qrP8SY/ursoninhos-logo-fundo-transparente.png',
    // Login com Google de verdade: crie um "OAuth Client ID" (tipo Web)
    // em console.cloud.google.com > APIs e servicos > Credenciais, com
    // https://ursoninhos.com nas origens autorizadas, e cole aqui.
    // Vazio = recurso indisponivel. O site nunca cria uma conta Google
    // simulada: o botao so e ativado depois da configuracao real.
    googleClientId: '589014658302-nk5hd9nh5h424elinhmc27pk7slmuali.apps.googleusercontent.com',
    // Planilha Google com o controle de produtos (id, nome, preco, link).
    // O site LE direto dela (precisa estar compartilhada como "qualquer
    // pessoa com o link pode ver").
    productsSheetId: '1FTHI9piD4iKAiQtldgm8dfp2-TOKosk5LPN-9a9KoFQ',
    // URL do Web App do Google Apps Script (backend/google-apps-script.gs)
    // que permite ao site ESCREVER na planilha (publicar modelo, botao
    // "Sincronizar planilha" do painel ADM). O "?key=" precisa bater com
    // o SYNC_KEY definido no proprio script.
    // Deixe vazio ate publicar o Web App para "Qualquer pessoa" e
    // definir a mesma chave no Apps Script. URLs com chave de exemplo
    // sao rejeitadas por sheet-products.js.
    sheetWebAppUrl: 'https://script.google.com/macros/s/AKfycbwyB-c3EWQhPIBsaw_QearliqB6M_McWRxJZaejSw2eF50EEaGKt4TbcysUvFdNNE5Q/exec?key=chave-91078409',
  };
})();
