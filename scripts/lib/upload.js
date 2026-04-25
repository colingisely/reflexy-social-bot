// Upload temporario de PNG para uma URL publica (necessario pelo IG Graph API).
// Estrategia MVP: catbox.moe (free, no auth, persistente).
// Se BLOB_READ_WRITE_TOKEN estiver configurado, usa Vercel Blob (mais robusto, auto TTL 30d).

import fs from 'node:fs/promises';
import path from 'node:path';

export async function uploadImage(filePath) {
  const buf = await fs.readFile(filePath);
  const filename = path.basename(filePath);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return await uploadToVercelBlob(buf, filename);
  }
  return await uploadToCatbox(buf, filename);
}

async function uploadToCatbox(buf, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buf]), filename);

  const r = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });
  if (!r.ok) throw new Error(`catbox upload failed: ${r.status}`);
  const url = (await r.text()).trim();
  if (!url.startsWith('https://')) throw new Error(`catbox returned invalid URL: ${url}`);
  return url;
}

async function uploadToVercelBlob(buf, filename) {
  const r = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      'authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      'x-content-type': 'image/png',
    },
    body: buf,
  });
  if (!r.ok) throw new Error(`vercel blob upload failed: ${r.status}`);
  const data = await r.json();
  return data.url;
}
