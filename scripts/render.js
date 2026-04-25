// render.js — renderiza UM template HTML em PNG via Puppeteer.
// Uso: node scripts/render.js <template-id> [--out path] [--hook "..."] [--meta key=val]
// Exemplo: node scripts/render.js t3-manifesto --hook "1 em cada 4 pecas..." --out renders/p01.png

import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');

const VIEWPORTS = {
  feed: { width: 1080, height: 1350 },
  reel: { width: 1080, height: 1920 },
  story: { width: 1080, height: 1920 },
};

export async function renderTemplate({ templateId, viewport = 'feed', vars = {}, outPath }) {
  const htmlPath = path.join(TEMPLATES_DIR, `${templateId}.html`);
  const exists = await fs.access(htmlPath).then(() => true).catch(() => false);
  if (!exists) throw new Error(`Template nao encontrado: ${htmlPath}`);

  const out = outPath || path.join(REPO_ROOT, 'renders', `${templateId}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(out), { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[viewport]);
    const fileUrl = 'file://' + htmlPath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Injeta variaveis: substitui o conteudo de [data-var="hook"] etc
    if (Object.keys(vars).length) {
      await page.evaluate((vars) => {
        for (const [key, val] of Object.entries(vars)) {
          const els = document.querySelectorAll(`[data-var="${key}"]`);
          els.forEach(el => { el.textContent = val; });
        }
      }, vars);
    }

    // Aguarda fontes
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: out, type: 'png', omitBackground: false });
    return out;
  } finally {
    await browser.close();
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const templateId = args[0];
  if (!templateId) {
    console.error('Uso: node scripts/render.js <template-id> [--hook "..."] [--out path]');
    process.exit(1);
  }
  const opts = { templateId, vars: {} };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out') opts.outPath = args[++i];
    else if (args[i] === '--viewport') opts.viewport = args[++i];
    else if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts.vars[key] = args[++i];
    }
  }
  const out = await renderTemplate(opts);
  console.log(out);
}
