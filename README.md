# Checkpoint 2 - Funcao Serverless Orientada a Eventos

[![Deploy](https://github.com/kauasrcs/cloud-serverless-checkpoint2/actions/workflows/deploy.yml/badge.svg)](https://github.com/kauasrcs/cloud-serverless-checkpoint2/actions/workflows/deploy.yml)

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

## CI/CD

A funcao ganhou logging estruturado e metricas customizadas (CloudWatch
Embedded Metric Format), e o deploy e automatizado por GitHub Actions - ver
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A cada push
na branch `main`, o workflow roda:

1. **Lint** - `node --check index.js`.
2. **Testes** - `node local.js`, o mesmo teste local descrito acima, sem
   credencial de nuvem.
3. **Build** - empacota `index.js` num `.zip`.
4. **Deploy** - atualiza o codigo na AWS (`aws lambda update-function-code`).

A autenticacao na AWS usa OIDC: o GitHub Actions assume uma IAM Role
diretamente, sem nenhuma chave de acesso guardada como secret. A role so
pode ser assumida por execucoes vindas deste repositorio, na branch `main`,
e so tem permissao para atualizar o codigo desta funcao especifica.

## Arquivos

* `index.js` - a funcao (o mesmo codigo que roda na nuvem)
* `local.js` - simula um evento do topico para testar localmente
* `.github/workflows/deploy.yml` - pipeline de CI/CD (lint, teste, build, deploy)
