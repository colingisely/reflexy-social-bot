// refresh-token.js — renova IG long-lived access token (60d → +60d).
// Uso: node scripts/refresh-token.js
// Em CI (GitHub Actions), o output e capturado e o secret IG_ACCESS_TOKEN e atualizado via gh CLI.

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const CURRENT_TOKEN = process.env.IG_ACCESS_TOKEN;

export async function refreshToken() {
  if (!META_APP_ID || !META_APP_SECRET || !CURRENT_TOKEN) {
    throw new Error('META_APP_ID, META_APP_SECRET e IG_ACCESS_TOKEN devem estar definidos');
  }

  const url = `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${encodeURIComponent(CURRENT_TOKEN)}`;
  const r = await fetch(url);
  const data = await r.json();
  if (!data.access_token) throw new Error(`refresh falhou: ${JSON.stringify(data)}`);

  const expiresAtMs = Date.now() + (data.expires_in * 1000);
  return {
    token: data.access_token,
    expiresIn: data.expires_in,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await refreshToken();
  console.log(`[refresh-token] novo token gerado, expira em ${result.expiresAt}`);
  // GitHub Actions captura via output:
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs/promises');
    await fs.appendFile(process.env.GITHUB_OUTPUT, `token=${result.token}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `expires_at=${result.expiresAt}\n`);
  } else {
    console.log('Para atualizar manualmente: gh secret set IG_ACCESS_TOKEN -b "<TOKEN>" -R colingisely/reflexy-social-bot');
  }
}
