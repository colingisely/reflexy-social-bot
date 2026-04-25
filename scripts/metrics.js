// metrics.js — coleta insights de posts ativos (ultimos 14d) e atualiza Notion.
// Uso: node scripts/metrics.js [--dry-run]

import { listPublishedActive, updatePostFields } from './lib/notion.js';
import { getMediaInsights } from './lib/ig.js';

export async function collectMetrics({ dryRun = false } = {}) {
  const posts = await listPublishedActive(14);
  const withId = posts.filter(p => p.igPostId);
  console.log(`[metrics] ${withId.length} posts ativos com IG ID`);

  const results = [];
  for (const p of withId) {
    try {
      const m = await getMediaInsights(p.igPostId);
      console.log(`[metrics] ${p.code}: reach=${m.reach} likes=${m.likes} saves=${m.saves} comments=${m.comments}`);
      if (!dryRun) {
        await updatePostFields(p.pageId, { metrics: m });
      }
      results.push({ code: p.code, ...m });
    } catch (e) {
      console.warn(`[metrics] ${p.code}: erro ${e.message}`);
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  await collectMetrics({ dryRun });
}
