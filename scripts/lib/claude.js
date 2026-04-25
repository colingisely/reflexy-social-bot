// Claude API wrapper para refino de captions
// Recebe row do Notion (hook + body + dado + hashtags) e produz caption final pronta para IG.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Voce e um copywriter da Reflexy — SaaS de provador virtual com IA para lojas Shopify de moda no Brasil.

Voz: PT-BR, direto, profissional, sem hype. Tom designer brasileira solo construindo SaaS premium. NUNCA usar:
- "transforme", "revolucionario", "incrivel", "magia"
- emoji em excesso (max 1-2 funcionais como ↓ ✦)
- promessas sem dado
- "voce sabia que..."

DEVE:
- Usar dados verificaveis quando disponiveis (sempre citar fonte entre parenteses na primeira frase se for stat)
- Explicar o problema antes da solucao
- Mencionar Shopify quando fizer sentido
- Terminar com CTA suave (nao agressivo): geralmente "Link na bio" ou "10 try-ons gratis pra testar"
- Tamanho IDEAL: 600-800 caracteres (sem hashtags). Maximo 1200.
- Quebrar em paragrafos curtos (1-3 linhas cada)

Estrutura padrao:
[FRASE-HOOK com dado/fonte]
[1-2 paragrafos explicando contexto/problema]
[1 paragrafo com solucao Reflexy]
[CTA + link na bio]`;

export async function refineCaption({ hook, body, dadoFonte, template, pilar }) {
  const userPrompt = `Hook (visual do post): "${hook}"

Briefing/body draft do Notion: ${body || '(vazio)'}

Dado/fonte: ${dadoFonte || '(nenhum)'}
Template visual: ${template} (${pilar})

Gere a caption final pronta para postar no Instagram. Sem hashtags (vou adicionar separado). Sem dizer "Caption:" — so o texto.`;

  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    return resp.content[0].text.trim();
  } catch (e) {
    // Fallback graceful: usa o body direto do Notion como caption.
    // Acontece quando: Anthropic API sem credito, key invalida, rate limit, etc.
    console.warn(`[claude] Claude API falhou (${e.status || 'unknown'}: ${e.message?.slice(0, 80)}). Usando body do Notion como fallback.`);
    return body?.trim() || hook;
  }
}

export function buildFullCaption(refinedBody, hashtags = []) {
  const tags = hashtags.length ? '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
  return refinedBody + tags;
}
