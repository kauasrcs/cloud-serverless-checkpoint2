// Teste local da funcao.
//
// Monta um evento igual ao que o topico SNS envia e chama o handler, para
// conferir o processamento sem precisar fazer deploy nem acessar a nuvem.

const { handler } = require('./index');

const pedido = {
  id: 'pedido-1',
  cliente: 'Kaua',
  valor: 250,
  data: new Date().toISOString(),
};

const evento = {
  Records: [
    { Sns: { Message: JSON.stringify(pedido) } },
  ],
};

console.log('Publicando este pedido no topico (simulado):');
console.log(JSON.stringify(pedido, null, 2));
console.log('\nA funcao foi acionada pelo evento e respondeu:');

handler(evento).then((resultado) => {
  console.log(JSON.stringify(resultado, null, 2));
});
