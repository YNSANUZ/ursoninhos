ATUALIZACAO DO SITE URSONINHOS — GITHUB
=======================================

Publique este pacote SOMENTE DEPOIS de atualizar o backend na Hostinger.

No GitHub, envie os arquivos e pastas mantendo exatamente os mesmos caminhos.
Quando o GitHub perguntar, confirme a substituicao dos arquivos existentes.

Esta atualizacao inclui:
- login e cadastro conectados ao backend seguro;
- login Google validado pelo servidor;
- checkout usando usuario autenticado;
- preco final corrigido pelo servidor;
- painel ADM e planilha protegidos por permissao;
- chave publica Mercado Pago:
  APP_USR-684d5e66-929b-41a4-b9a8-0c4eb60312d3

A Public Key acima pode ficar no site. Access Token, assinatura do Webhook,
SYNC_KEY e senhas jamais podem ser enviados ao GitHub.

Depois da publicacao:
1. Aguarde o GitHub Pages atualizar.
2. Abra https://ursoninhos.com em janela anonima.
3. Crie uma conta nova; cadastros antigos do teste local nao sao reutilizados.
4. Saia e entre novamente para validar a sessao.
5. Complete CPF, celular e endereco.
6. Valide o login Google.
7. Para pagamento, continue usando apenas comprador @testuser.com enquanto o
   backend estiver em ambiente de teste.

O site ainda NAO deve receber pagamentos reais. A liberacao de producao so deve
acontecer depois de testar cadastro, login, endereco, carrinho, pagamento de
teste, webhook e consulta do pedido de ponta a ponta.
