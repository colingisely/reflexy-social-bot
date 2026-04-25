// story.js — republica como Story um post ja publicado, dado o codigo.
// Uso: node scripts/story.js P01
// Util para retroativo. O fluxo padrao ja chama publishStory dentro de publish.js.

import { getPostByCode } from './lib/notion.js';
import { publishStory } from './lib/ig.js';

export async function storyForPost(code) {
  const post = await getPostByCode(code);
  if (!post.assetUrl) throw new Error(`${code} nao tem Asset URL`);
  const id = await publishStory({ imageUrl: post.assetUrl });
  console.log(`[story] ${code}: Story publicado (${id})`);
  return id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = process.argv[2];
  if (!code) { console.error('Uso: node scripts/story.js <P01..P12>'); process.exit(1); }
  await storyForPost(code);
}
