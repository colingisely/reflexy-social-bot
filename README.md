# reflexy-social-bot

Bot autonomo de publicacao Instagram da Reflexy. Roda em GitHub Actions, le Notion como source-of-truth, renderiza posts via Puppeteer, publica via IG Graph API.

## O que ele faz

```
Notion DB "Posts Instagram"
       ↓ Gi muda Status = "Aprovado"
GitHub Actions cron */15min
       ↓
1. fetch row do Notion
2. Puppeteer: HTML template → PNG 1080x1350
3. Claude API: refina caption a partir de hook+body
4. IG Graph API: container + media_publish
5. wait 30min → repost como Story
6. update Notion: Status=Publicado, IG post ID, asset URL
       ↓
cron diario 9h: pull insights → grava em Notion
cron mensal dia 1: refresh long-lived token
```

## Setup

```bash
npm install
cp .env.example .env
# preencher .env com tokens reais (ver doc Notion T26.1)
npm run tick   # roda 1 ciclo: detecta Aprovados + processa
```

## Scripts

| Script | O que faz | Quando roda |
|---|---|---|
| `tick.js` | Loop principal: scan Notion, processa qualquer post Aprovado e ainda nao Publicado | cron */15min |
| `render.js` | Renderiza um template HTML em PNG via Puppeteer | chamado por tick |
| `caption.js` | Refina caption final via Claude API | chamado por tick |
| `publish.js` | Publica PNG no IG via Graph API | chamado por tick |
| `story.js` | Republica ultimo post como Story (delay 30min) | chamado por tick (com schedule) |
| `metrics.js` | Coleta insights de posts ativos e grava no Notion | cron 9h diario |
| `refresh-token.js` | Renova IG access token | cron mensal dia 1 |

## Templates HTML

Os templates ficam em `templates/`. Em desenvolvimento local, e symlink para
`/Users/giselycolin/REFLEXY CLAUDE/social/templates/` (source-of-truth visual).
Em CI (GitHub Actions), os arquivos sao copiados durante o checkout.

## Notion Integration

Para o bot ler/escrever no Notion:
1. Acesse https://www.notion.so/my-integrations
2. Create integration: nome "Reflexy Social Bot", tipo Internal, capabilities Read+Update+Insert content
3. Copie o "Internal Integration Token" (`secret_...`) → variavel `NOTION_TOKEN`
4. Abra o database "Posts Instagram" no Notion → ... → Connections → Add connection → Reflexy Social Bot
5. Confirme

## Arquitetura

- ESM modules (Node 20+)
- Sem framework — fetch nativo + lib oficial Notion + lib oficial Anthropic
- Puppeteer headless com viewport 1080x1350 (feed) ou 1080x1920 (reels/stories)
- Logs estruturados em stdout (capturados pelo GitHub Actions)
- Idempotente: pode rodar 2x na mesma row sem duplicar publish (checa `IG post ID` antes)
