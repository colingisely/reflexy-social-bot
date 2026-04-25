// Upload temporario de PNG para uma URL publica (necessario pelo IG Graph API).
// Estrategia em cascata (tenta na ordem ate uma funcionar):
//   1. GitHub Contents API (default — repo publico, raw URL persistente, zero deps externas)
//   2. Vercel Blob (se BLOB_READ_WRITE_TOKEN configurado, mais robusto pra producao)
//   3. 0x0.st (fallback final, free sem auth)

import fs from 'node:fs/promises';
import path from 'node:path';

export async function uploadImage(filePath) {
  const buf = await fs.readFile(filePath);
  const filename = path.basename(filePath);

  const providers = [];
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    providers.push(['github-raw', () => uploadToGitHub(buf, filename)]);
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    providers.push(['vercel-blob', () => uploadToVercelBlob(buf, filename)]);
  }
  providers.push(['0x0.st', () => uploadToZeroXZero(buf, filename)]);

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

async function uploadToGitHub(buf, filename) {
  const repo = process.env.GITHUB_REPOSITORY;     // owner/repo
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_REF_NAME || 'main';
  // Caminho com timestamp para evitar conflitos em re-runs do mesmo post
  const ts = new Date().toISOString().slice(0, 10);
  const repoPath = `assets/posts/${ts}/${filename}`;
  const url = `https://api.github.com/repos/${repo}/contents/${repoPath}`;

  // Verifica se ja existe (precisa SHA pra update)
  let sha;
  const head = await fetch(`${url}?ref=${branch}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });
  if (head.ok) {
    sha = (await head.json()).sha;
  }

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore(assets): upload ${filename}`,
      content: buf.toString('base64'),
      branch,
      ...(sha && { sha }),
      committer: { name: 'reflexy-social-bot', email: 'bot@reflexy.co' },
    }),
  });
  if (!r.ok) throw new Error(`github contents API HTTP ${r.status}: ${(await r.text()).slice(0, 100)}`);
  // URL raw publica (funciona porque repo e publico)
  return `https://raw.githubusercontent.com/${repo}/${branch}/${repoPath}`;
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
