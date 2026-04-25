// Instagram Graph API — wrappers minimos
// Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing
// Fluxo (single image):
//   1. POST /{IG_USER_ID}/media com {image_url, caption} → retorna {creation_id}
//   2. POST /{IG_USER_ID}/media_publish com {creation_id} → retorna {id} (post real)
//   3. (opcional) POST /{IG_USER_ID}/media com {media_type:STORIES, image_url} → media_publish
// IMPORTANTE: image_url precisa estar publicamente acessivel (https). Vamos usar Vercel Blob ou Imgur.
// Em DEV local o teste fica em dry-run; em CI sobe para Vercel Blob temporario.

const API = 'https://graph.facebook.com/v25.0';
const IG_USER_ID = process.env.IG_USER_ID;
const IG_TOKEN = process.env.IG_ACCESS_TOKEN;

if (!IG_USER_ID || !IG_TOKEN) {
  console.warn('[ig] WARN: IG_USER_ID ou IG_ACCESS_TOKEN nao definidos');
}

async function call(method, path, params = {}) {
  const url = new URL(`${API}/${path}`);
  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    url.searchParams.append('access_token', IG_TOKEN);
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) throw new Error(`IG API ${method} ${path}: ${JSON.stringify(data.error)}`);
    return data;
  }
  const body = new URLSearchParams({ ...params, access_token: IG_TOKEN });
  const r = await fetch(url, { method, body });
  const data = await r.json();
  if (data.error) throw new Error(`IG API ${method} ${path}: ${JSON.stringify(data.error)}`);
  return data;
}

export async function createMediaContainer({ imageUrl, caption, mediaType = 'IMAGE' }) {
  const params = mediaType === 'STORIES'
    ? { image_url: imageUrl, media_type: 'STORIES' }
    : { image_url: imageUrl, caption };
  const data = await call('POST', `${IG_USER_ID}/media`, params);
  return data.id; // creation_id
}

export async function publishMedia(creationId) {
  const data = await call('POST', `${IG_USER_ID}/media_publish`, { creation_id: creationId });
  return data.id; // ig media id (final post)
}

export async function publishImage({ imageUrl, caption }) {
  const creationId = await createMediaContainer({ imageUrl, caption });
  await waitContainerReady(creationId);
  return await publishMedia(creationId);
}

export async function publishStory({ imageUrl }) {
  const creationId = await createMediaContainer({ imageUrl, mediaType: 'STORIES' });
  await waitContainerReady(creationId);
  return await publishMedia(creationId);
}

export async function waitContainerReady(creationId, maxTries = 30, delayMs = 2000) {
  for (let i = 0; i < maxTries; i++) {
    const data = await call('GET', creationId, { fields: 'status_code' });
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error(`Container ${creationId} ERROR`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Container ${creationId} timeout`);
}

export async function getMediaInsights(mediaId) {
  // IG Insights metrics v2025: https://developers.facebook.com/docs/instagram-api/guides/insights
  // metric=reach,likes,saves,comments funciona para single media (post)
  const data = await call('GET', `${mediaId}/insights`, {
    metric: 'reach,likes,saves,comments',
  });
  const result = {};
  for (const m of data.data || []) {
    result[m.name] = m.values?.[0]?.value ?? null;
  }
  return result;
}

export async function getAccountInfo() {
  return call('GET', IG_USER_ID, { fields: 'username,followers_count,media_count,name' });
}
