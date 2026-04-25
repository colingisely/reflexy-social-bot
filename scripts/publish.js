// publish.js — publica UM post: render + upload + caption + IG Graph API + update Notion.
// Uso: node scripts/publish.js P01 [--dry-run]

import { getPostByCode, updatePostFields } from './lib/notion.js';
import { renderTemplate } from './render.js';
import { captionForPost } from './caption.js';
import { uploadImage } from './lib/upload.js';
import { publishImage, publishStory } from './lib/ig.js';

const TEMPLATE_MAP = {
  T1: 't1-ui-hero',
  T2: 't2-stat',
  T3: 't3-manifesto',
  T4: 't4-antes-depois',
  T5: 't5-carousel-cover',
  T6: 't6-editorial',
};

export async function publishPost(code, { dryRun = false, alsoStory = true } = {}) {
  const post = await getPostByCode(code);
  console.log(`[publish] ${code}: ${post.title}`);

  if (post.igPostId) {
    console.log(`[publish] ${code} ja tem IG post ID (${post.igPostId}) — pulando`);
    return { skipped: true, postId: post.igPostId };
  }

  const templateFile = TEMPLATE_MAP[post.template];
  if (!templateFile) throw new Error(`Template ${post.template} nao mapeado em TEMPLATE_MAP`);

  // 1. Render
  console.log(`[publish] ${code}: rendering template ${templateFile}...`);
  const pngPath = await renderTemplate({
    templateId: templateFile,
    vars: { hook: post.hook },
    outPath: `renders/${code}.png`,
  });
  console.log(`[publish] ${code}: PNG salvo em ${pngPath}`);

  // 2. Caption
  console.log(`[publish] ${code}: refinando caption via Claude...`);
  const caption = await captionForPost(post);

  if (dryRun) {
    console.log('[publish] DRY RUN — nao publica. Caption:');
    console.log(caption);
    return { dryRun: true, pngPath, caption };
  }

  // 3. Upload
  console.log(`[publish] ${code}: subindo PNG (catbox/blob)...`);
  const imageUrl = await uploadImage(pngPath);
  console.log(`[publish] ${code}: image_url = ${imageUrl}`);

  // 4. Publish (feed)
  console.log(`[publish] ${code}: criando container IG e publicando...`);
  const igPostId = await publishImage({ imageUrl, caption });
  console.log(`[publish] ${code}: IG post ID = ${igPostId}`);

  const publishedAt = new Date().toISOString();

  // 5. Update Notion
  await updatePostFields(post.pageId, {
    status: 'Publicado',
    assetUrl: imageUrl,
    publishedAt,
    igPostId,
  });
  console.log(`[publish] ${code}: Notion atualizado para Publicado`);

  // 6. Story (mesmo media url, repost)
  if (alsoStory) {
    try {
      console.log(`[publish] ${code}: republicando como Story...`);
      const storyId = await publishStory({ imageUrl });
      console.log(`[publish] ${code}: Story publicado (${storyId})`);
    } catch (e) {
      console.warn(`[publish] ${code}: WARN story falhou: ${e.message}`);
    }
  }

  return { postId: igPostId, imageUrl, publishedAt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!code) { console.error('Uso: node scripts/publish.js <P01..P12> [--dry-run]'); process.exit(1); }
  await publishPost(code, { dryRun });
}
