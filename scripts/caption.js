// caption.js — refina caption final via Claude API a partir de uma row do Notion.
// Uso: node scripts/caption.js P01

import { getPostByCode } from './lib/notion.js';
import { refineCaption, buildFullCaption } from './lib/claude.js';

export async function captionForPost(post) {
  const refined = await refineCaption({
    hook: post.hook,
    body: post.body,
    dadoFonte: post.dado,
    template: post.template,
    pilar: post.pilar,
  });
  return buildFullCaption(refined, post.hashtags);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = process.argv[2];
  if (!code) { console.error('Uso: node scripts/caption.js <P01..P12>'); process.exit(1); }
  const post = await getPostByCode(code);
  const cap = await captionForPost(post);
  console.log('---');
  console.log(cap);
  console.log('---');
  console.log(`(${cap.length} chars total)`);
}
