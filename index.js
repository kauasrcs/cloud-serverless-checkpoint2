// Funcao serverless orientada a eventos.
//
// Ela e acionada automaticamente sempre que uma mensagem e publicada no topico
// de pedidos (SNS). Nao responde mais a chamadas HTTP diretas: o evento do
// topico e quem dispara o processamento. Cada pedido consumido e gravado numa
// tabela, para que o resultado do processamento possa ser conferido depois.
//
// As duas rotas HTTP existem apenas para permitir testar a arquitetura:
//   /             publica um pedido no topico (produtor)
//   /processados  lista os pedidos que a funcao ja consumiu

const TOPICO = process.env.TOPIC_ARN;
const TABELA = process.env.TABLE_NAME;

exports.handler = async (event) => {
  // Evento do SNS: a funcao foi acionada pelo topico.
  if (event.Records) {
    return consumirPedidos(event.Records);
  }

  const caminho = event.rawPath || '/';
  if (caminho === '/processados') {
    return listarProcessados();
  }
  return publicarPedido(event);
};

// Consumidor: e este trecho que roda quando o topico dispara a funcao.
async function consumirPedidos(records) {
  const pedidos = [];

  for (const record of records) {
    const pedido = JSON.parse(record.Sns.Message);
    console.log(`Pedido consumido do topico: ${pedido.id}`);
    pedidos.push(pedido);

    // Na nuvem o pedido e gravado na tabela. Rodando localmente nao existe
    // tabela configurada, entao a funcao apenas processa e mostra o resultado.
    if (TABELA) {
      await gravarPedido(pedido);
    }
  }

  return { consumidos: pedidos.length, pedidos: pedidos };
}

async function gravarPedido(pedido) {
  const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});

  await db.send(new PutItemCommand({
    TableName: TABELA,
    Item: {
      id: { S: pedido.id },
      dados: { S: JSON.stringify(pedido) },
    },
  }));
}

// Produtor: publica um pedido no topico, o que dispara a funcao pelo evento.
async function publicarPedido(event) {
  const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

  const params = event.queryStringParameters || {};
  const pedido = {
    id: params.id || `pedido-${Date.now()}`,
    cliente: params.cliente || 'cliente-teste',
    valor: Number(params.valor || 100),
    data: new Date().toISOString(),
  };

  const sns = new SNSClient({});
  const envio = await sns.send(new PublishCommand({
    TopicArn: TOPICO,
    Message: JSON.stringify(pedido),
  }));

  return responder(200, {
    mensagem: 'Pedido publicado no topico. A funcao sera acionada pelo evento.',
    pedido: pedido,
    messageId: envio.MessageId,
    comoConferir: 'Aguarde alguns segundos e acesse /processados',
  });
}

// Lista os pedidos que a funcao gravou ao consumir os eventos do topico.
async function listarProcessados() {
  const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});

  const resultado = await db.send(new ScanCommand({ TableName: TABELA }));

  const pedidos = (resultado.Items || [])
    .map((item) => JSON.parse(item.dados.S))
    .sort((a, b) => b.data.localeCompare(a.data));

  return responder(200, {
    mensagem: 'Pedidos consumidos pela funcao a partir dos eventos do topico.',
    total: pedidos.length,
    pedidos: pedidos,
  });
}

function responder(statusCode, corpo) {
  return {
    statusCode: statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo, null, 2),
  };
}
