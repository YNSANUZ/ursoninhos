(function () {
  const origin = window.location.origin || '';
  const isBackendHost = /primusdf\.com\.br$/.test(window.location.hostname || '');
  const backendOrigin = isBackendHost ? origin : 'https://primusdf.com.br';
  window.URSONINHOS_APP_CONFIG = {
    backendBaseUrl: `${backendOrigin}/_ursoninhos_backend/api`,
    defaultLogoUrl: 'https://i.ibb.co/6qrP8SY/ursoninhos-logo-fundo-transparente.png',
  };
})();
