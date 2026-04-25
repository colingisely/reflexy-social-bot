// Upload temporario de PNG para uma URL publica (necessario pelo IG Graph API).
// Estrategia em cascata (tenta na ordem ate uma funcionar):
//   1. Vercel Blob (se BLOB_READ_WRITE_TOKEN configurado, mais robusto)
//   2. 0x0.st (free, sem auth, suporta datacenter IPs — funciona em GitHub Actions)
//   3. catbox.moe (free, sem auth — fallback final, falha em alguns datacenters com 412)

import fs from 'node:fs/promises';
import path from 'node:path';

export async function uploadImage(filePath) {
  const buf = await fs.readFile(filePath);
  const filename = path.basename(filePath);

  const providers = [];
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    providers.push(['vercel-blob', () => uploadToVercelBlob(buf, filename)]);
  }
  providers.push(['0x0.st', () => uploadToZeroXZero(buf, filename)]);
  providers.push(['catbox.moe', () => uploadToCatbox(buf, filename)]);

  let lastError;
  for (const [name, fn] of providers) {
    try {
      const url = await fn();
      console.log(`[upload] ${name}: ${url}`);
      return url;
    } catch (e) {
      console.warn(`[upload] ${name} falhou: ${e.message}`);
      lastError = e;
    }
  }
  throw new Error(`todos os providers de upload falharam: ${lastError?.message}`);
}

async function uploadToZeroXZero(buf, filename) {
  const form = new FormData();
  form.append('file', new Blob([buf]), filename);
  form.append('expires', '720'); // 30 dias em horas

  const r = await fetch('https://0x0.st', {
    method: 'POST',
    headers: { 'User-Agent': 'reflexy-social-bot/0.1 (+https://reflexy.co)' },
    body: form,
  });
  if (!r.ok) throw new Error(`0x0.st HTTP ${r.status}`);
  const url = (await r.text()).trim();
  if (!url.startsWith('https://')) throw new Error(`0x0.st retornou: ${url.slice(0, 100)}`);
  return url;
}

async function uploadToCatbox(buf, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buf]), filename);

  const r = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });
  if (!r.ok) throw new Error(`catbox HTTP ${r.status}`);
  const url = (await r.text()).trim();
  if (!url.startsWith('https://')) throw new Error(`catbox retornou: ${url.slice(0, 100)}`);
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
  if (!r.ok) throw new Error(`vercel blob HTTP ${r.status}`);
  const data = await r.json();
  return data.url;
}
