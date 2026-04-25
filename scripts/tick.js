// tick.js — orquestrador principal. Chamado pelo cron a cada 15min.
// 1. Busca posts Aprovados com Scheduled at <= now
// 2. Para cada um: render + caption + publish
// 3. Atualiza Notion
// Idempotente — pula posts que ja tem IG post ID.

import { listApprovedPosts } from './lib/notion.js';
import { publishPost } from './publish.js';

export async function tick() {
  const now = new Date();
  const posts = await listApprovedPosts();
  console.log(`[tick] ${posts.length} posts em status Aprovado`);

  const due = posts.filter(p => {
    if (p.igPostId) return false; // ja publicado
    if (!p.scheduledAt) return false;
    return new Date(p.scheduledAt) <= now;
  });

  console.log(`[tick] ${due.length} posts due agora`);

  for (const p of due) {
    try {
      await publishPost(p.code);
    } catch (e) {
      console.error(`[tick] ${p.code} FALHOU: ${e.message}`);
      console.error(e.stack);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await tick();
}
