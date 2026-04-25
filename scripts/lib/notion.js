// Notion helpers — Posts Instagram database
// Schema REAL conforme DB Notion (validado 2026-04-25):
//   #          (rich_text)  ex P01..P12
//   Post       (title)      hook curto
//   Data prevista (date)
//   Template   (select)     T1 UI Hero | T2 Stat | T3 Manifesto | T4 Antes/Depois | T5 Carousel | T6 Editorial | R1..R3
//   Pilar      (select)     Produto | Educacional | Manifesto | Prova
//   Status     (select)     Backlog | Em producao | Aprovado | Agendado | Publicado | Metricas coletadas
//   Responsavel (select)    Gi | Claude Code | Claude Design | Claude in Chrome | Gi + Claude | Bot (auto)
//   Hook       (rich_text)
//   Body       (rich_text)
//   Hashtags   (multi_select) 13 opcoes pre-definidas
//   Dado       (select)     D1..D6 | sem dado
//   Asset      (url)
//   Scheduled  (date+time)
//   Published  (date+time)  preenchido pelo bot
//   IG Post    (rich_text)  preenchido pelo bot
//   Reach / Likes / Saves / Comments (number)
//   DMs        (number)     manual

import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_POSTS;

const txt = (rich) => (rich || []).map(r => r.plain_text).join('').trim();
const propText = (page, name) => txt(page.properties?.[name]?.rich_text);
const propTitle = (page, name) => txt(page.properties?.[name]?.title);
const propSelect = (page, name) => page.properties?.[name]?.select?.name || null;
const propMulti = (page, name) => (page.properties?.[name]?.multi_select || []).map(s => s.name);
const propDate = (page, name) => page.properties?.[name]?.date?.start || null;
const propUrl = (page, name) => page.properties?.[name]?.url || null;
const propNum = (page, name) => page.properties?.[name]?.number ?? null;

export function rowToPost(page) {
  return {
    pageId: page.id,
    code: propText(page, '#'),
    title: propTitle(page, 'Post'),
    dataPrevista: propDate(page, 'Data prevista'),
    template: propSelect(page, 'Template'),
    pilar: propSelect(page, 'Pilar'),
    status: propSelect(page, 'Status'),
    responsavel: propSelect(page, 'Responsavel'),
    hook: propText(page, 'Hook'),
    body: propText(page, 'Body'),
    hashtags: propMulti(page, 'Hashtags'),
    dado: propSelect(page, 'Dado'),
    assetUrl: propUrl(page, 'Asset'),
    scheduledAt: propDate(page, 'Scheduled'),
    publishedAt: propDate(page, 'Published'),
    igPostId: propText(page, 'IG Post'),
    metrics: {
      reach: propNum(page, 'Reach'),
      likes: propNum(page, 'Likes'),
      saves: propNum(page, 'Saves'),
      comments: propNum(page, 'Comments'),
      dms: propNum(page, 'DMs'),
    },
  };
}

export async function listApprovedPosts() {
  const res = await notion.databases.query({
    database_id: DB_ID,
    filter: { property: 'Status', select: { equals: 'Aprovado' } },
    sorts: [{ property: 'Scheduled', direction: 'ascending' }],
  });
  return res.results.map(rowToPost);
}

export async function listPublishedActive(daysBack = 14) {
  const since = new Date(Date.now() - daysBack * 86400 * 1000).toISOString();
  const res = await notion.databases.query({
    database_id: DB_ID,
    filter: {
      and: [
        { property: 'Status', select: { does_not_equal: 'Backlog' } },
        { property: 'Published', date: { on_or_after: since } },
      ],
    },
  });
  return res.results.map(rowToPost);
}

export async function getPostByCode(code) {
  const res = await notion.databases.query({
    database_id: DB_ID,
    filter: { property: '#', rich_text: { equals: code } },
  });
  if (!res.results.length) throw new Error(`Post nao encontrado: ${code}`);
  return rowToPost(res.results[0]);
}

export async function updatePostFields(pageId, fields) {
  const properties = {};
  if (fields.status) properties['Status'] = { select: { name: fields.status } };
  if (fields.assetUrl) properties['Asset'] = { url: fields.assetUrl };
  if (fields.publishedAt) properties['Published'] = { date: { start: fields.publishedAt } };
  if (fields.igPostId) properties['IG Post'] = { rich_text: [{ text: { content: fields.igPostId } }] };
  if (fields.body !== undefined) properties['Body'] = { rich_text: [{ text: { content: fields.body } }] };
  if (fields.metrics) {
    if (fields.metrics.reach != null) properties['Reach'] = { number: fields.metrics.reach };
    if (fields.metrics.likes != null) properties['Likes'] = { number: fields.metrics.likes };
    if (fields.metrics.saves != null) properties['Saves'] = { number: fields.metrics.saves };
    if (fields.metrics.comments != null) properties['Comments'] = { number: fields.metrics.comments };
  }
  return notion.pages.update({ page_id: pageId, properties });
}

export { notion };
