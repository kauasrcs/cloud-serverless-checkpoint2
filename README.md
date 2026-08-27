# Checkpoint 2 - Funcao Serverless Orientada a Eventos

Evolucao do Checkpoint 1. A funcao nao responde mais a chamadas HTTP diretas:
agora ela e acionada automaticamente sempre que uma mensagem e publicada em um
topico de pedidos. O evento do topico e quem dispara o processamento.

A URL usada para testar nao esta neste arquivo. Ela foi enviada no campo de
comentarios da entrega no Canvas.

## Provedor Utilizado

* AWS (SNS + Lambda + DynamoDB)

O SNS e o servico de publish/subscribe da AWS, equivalente ao Google Cloud
Pub/Sub: uma mensagem publicada no topico e entregue aos inscritos, e a funcao
inscrita e executada como consumidora do evento.

## Arquitetura

    produtor  ->  topico de pedidos (SNS)  ->  funcao (Lambda)  ->  tabela

A funcao esta inscrita no topico. Quando um pedido e publicado, o SNS invoca a
funcao passando a mensagem no evento, e a funcao grava o pedido processado numa
tabela. Nao existe chamada HTTP para a funcao nesse fluxo, e o produtor nao sabe
quem vai consumir a mensagem: e esse desacoplamento que caracteriza a
arquitetura orientada a eventos.

O SNS entrega a mensagem de forma assincrona, entao o produtor recebe a
confirmacao da publicacao imediatamente, sem esperar o processamento terminar.

## Formato da mensagem

    {
      "id": "pedido-1",
      "cliente": "Kaua",
      "valor": 250,
      "data": "2026-08-27T20:00:00.000Z"
    }

## Como rodar localmente

### Pre-requisitos

* Node.js instalado (versao 18 ou superior)
* Terminal de comandos aberto

### Passo a passo

1. Clone o repositorio para sua maquina:

       git clone https://github.com/kauasrcs/cloud-serverless-checkpoint2.git

2. Entre na pasta do projeto:

       cd cloud-serverless-checkpoint2

3. Instale as dependencias do projeto:

       npm install

4. Rode o teste local:

       npm start

O teste local monta um evento igual ao que o topico envia e chama a funcao,
mostrando o pedido publicado e o resultado do processamento. Nao precisa de
credencial da nuvem nem de dependencia externa: sem tabela configurada, a funcao
apenas processa o pedido e devolve o resultado. Na nuvem, o SDK da AWS usado
para publicar no topico e gravar na tabela ja vem incluido no runtime do Lambda.

## Arquivos

* `index.js` - a funcao (o mesmo codigo que roda na nuvem)
* `local.js` - simula um evento do topico para testar localmente
