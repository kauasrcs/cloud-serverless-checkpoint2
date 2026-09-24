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
//
// Logging estruturado e metricas (Checkpoint 4): cada log e uma linha JSON, e
// as metricas usam o formato CloudWatch Embedded Metric Format (EMF) - uma
// linha de log com uma forma especifica que o CloudWatch extrai
// automaticamente como metrica, sem chamada de API nem permissao adicional.

const TOPICO = process.env.TOPIC_ARN;
const TABELA = process.env.TABLE_NAME;
const NAMESPACE = 'PucCheckpoint2';

function log(nivel, mensagem, campos = {}) {
  console.log(JSON.stringify({ nivel, mensagem, ...campos }));
}

function metrica(servico, nome, valor, unidade) {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{ Namespace: NAMESPACE, Dimensions: [['Servico']], Metrics: [{ Name: nome, Unit: unidade }] }],
    },
    Servico: servico,
    [nome]: valor,
  }));
}

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
  const inicio = Date.now();
  const pedidos = [];

  for (const record of records) {
    const pedido = JSON.parse(record.Sns.Message);
    log('INFO', 'Pedido consumido do topico', { id: pedido.id });
    pedidos.push(pedido);

    // Na nuvem o pedido e gravado na tabela. Rodando localmente nao existe
    // tabela configurada, entao a funcao apenas processa e mostra o resultado.
    if (TABELA) {
      await gravarPedido(pedido);
    }
  }

  metrica('consumidor', 'PedidosConsumidos', pedidos.length, 'Count');
  metrica('consumidor', 'DuracaoMs', Date.now() - inicio, 'Milliseconds');
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
  const inicio = Date.now();
  const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

  const params = event.queryStringParameters || {};
  const pedido = {
    id: params.id || `pedido-${Date.now()}`,
    cliente: params.cliente || 'cliente-teste',
    valor: Number(params.valor || 100),
    data: new Date().toISOString(),
  };

  log('INFO', 'Publicando pedido no topico', { id: pedido.id });

  const sns = new SNSClient({});
  const envio = await sns.send(new PublishCommand({
    TopicArn: TOPICO,
    Message: JSON.stringify(pedido),
  }));

  metrica('produtor', 'PedidosPublicados', 1, 'Count');
  metrica('produtor', 'DuracaoMs', Date.now() - inicio, 'Milliseconds');

  return responder(200, {
    mensagem: 'Pedido publicado no topico. A funcao sera acionada pelo evento.',
    pedido: pedido,
    messageId: envio.MessageId,
    comoConferir: 'Aguarde alguns segundos e acesse /processados',
  });
}

// Lista os pedidos que a funcao gravou ao consumir os eventos do topico.
async function listarProcessados() {
  const inicio = Date.now();
  const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
  const db = new DynamoDBClient({});

  const resultado = await db.send(new ScanCommand({ TableName: TABELA }));

  const pedidos = (resultado.Items || [])
    .map((item) => JSON.parse(item.dados.S))
    .sort((a, b) => b.data.localeCompare(a.data));

  metrica('consulta', 'DuracaoMs', Date.now() - inicio, 'Milliseconds');
  log('INFO', 'Consulta de processados', { total: pedidos.length });

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
