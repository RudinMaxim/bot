#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/pgmu/bot}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.turni.yml}"
SERVICE="${SERVICE:-nestjs}"

cd "$APP_DIR"

echo "===== HOST GIT ====="
git rev-parse --abbrev-ref HEAD || true
git rev-parse HEAD || true
git log -1 --oneline || true
git status --short || true

echo
echo "===== COMPOSE PS / IMAGE ====="
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" images
docker inspect bot-nestjs-1 \
  --format 'image={{.Image}} created={{.Created}} started={{.State.StartedAt}}' \
  || true

echo
echo "===== CONTAINER NODE / PACKAGE VERSIONS ====="
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -lc '
node -v
npm -v
node -p "
JSON.stringify({
  app: require(\"/app/package.json\").version,
  langchain: require(\"langchain/package.json\").version,
  core: require(\"@langchain/core/package.json\").version,
  openai: require(\"@langchain/openai/package.json\").version,
  js_tiktoken: require(\"js-tiktoken/package.json\").version
}, null, 2)"
'

echo
echo "===== CHECK DEPLOYED DIST CODE ====="
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -lc '
grep -R "model.stream\|streamLLM\|buildDirectAnswerText\|shouldUseDirectAnswer\|extractDirectAnswer" -n /app/dist/src || true
grep -R "getNumTokensFromMessages\|_getEstimatedTokenCountFromPrompt\|_getNumTokensFromGenerations" -n /app/dist/src/shared/agents/base || true
'

echo
echo "===== LANGCHAIN TOKEN WARNING SOURCE ====="
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -lc '
grep -R "Failed to calculate number of tokens" -n /app/node_modules/@langchain/core/dist/language_models /app/node_modules/@langchain/openai/dist || true
'

echo
echo "===== RECENT AI LOGS ====="
docker compose -f "$COMPOSE_FILE" logs --since 30m "$SERVICE" \
  | grep -Ei "Starting workflow|search_agent|response_agent|Prompt is very long|Failed to calculate number of tokens|Orchestrator completed|error|warn" \
  | tail -n 300 \
  || true

echo
echo "===== LANGCHAIN TOKEN WARNING STACK PROBE ====="
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" node <<'NODE'
const originalWarn = console.warn;
console.warn = (...args) => {
  originalWarn(...args);
  if (String(args[0]).includes('Failed to calculate number of tokens')) {
    originalWarn('===== WARN STACK =====');
    originalWarn(new Error('token warning stack').stack);
  }
};

(async () => {
  const { ChatOpenAI } = require('@langchain/openai');
  const { HumanMessage, AIMessage } = require('@langchain/core/messages');

  const model = new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || 'test',
    configuration: process.env.OPENROUTER_BASE_URL
      ? { baseURL: process.env.OPENROUTER_BASE_URL }
      : undefined,
    modelName: process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || 'gpt-4o',
    streaming: true,
  });

  console.log('modelName=', model.modelName || model.model);
  console.log('streamUsage=', model.streamUsage, 'streaming=', model.streaming);

  console.log('--- getNumTokens ---');
  await model.getNumTokens('hello world');

  console.log('--- getNumTokensFromMessages ---');
  await model.getNumTokensFromMessages([new HumanMessage('hello world')]);

  console.log('--- _getEstimatedTokenCountFromPrompt ---');
  await model._getEstimatedTokenCountFromPrompt([new HumanMessage('hello world')]);

  console.log('--- _getNumTokensFromGenerations ---');
  await model._getNumTokensFromGenerations([
    { message: new AIMessage('hello world') },
  ]);

  console.log('done');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
