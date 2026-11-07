// Synk-API for Styrke (Cloudflare Pages Function).
// POST /api/sync med header «Authorization: Bearer <SYNC_KEY>» og body:
//   { since: <cursor>, sessions: [økt, ...], meta: { data: {...}, updated: <ms> } }
// Økter er bare-legg-til (id = økta sin dato). Meta (innstillinger, neste dag, blokk) vinner hvis den er nyest.
// Svar: { cursor, more, total, sessions: [økter lagt til etter «since»], meta: { data, updated } | null }
//
// Krever i Cloudflare: D1-binding «DB» og hemmelighet «SYNC_KEY» (minst 16 tegn).

const PAGE = 1000;          // maks antall økter per svar
const MAX_IN = 1000;        // maks antall økter per forespørsel
const MAX_SESSION = 200_000; // maks størrelse på én økt (tegn)

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

async function authorized(request, secret) {
  const h = request.headers.get('authorization') || '';
  const got = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!got) return false;
  // Sammenlign hasher i konstant tid, så lengde og innhold ikke lekker via svartid.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(got)),
    crypto.subtle.digest('SHA-256', enc.encode(secret)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)'),
  ]);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Bruk POST' }, 405);
  if (!env.DB || !env.SYNC_KEY || String(env.SYNC_KEY).length < 16) {
    return json({ error: 'Serveren er ikke ferdig satt opp: mangler D1-binding «DB» eller hemmeligheten «SYNC_KEY».' }, 500);
  }
  if (!(await authorized(request, String(env.SYNC_KEY)))) return json({ error: 'Feil synk-nøkkel.' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Ugyldig JSON.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Ugyldig forespørsel.' }, 400);

  const since = Number.isInteger(body.since) && body.since > 0 ? body.since : 0;
  const incoming = Array.isArray(body.sessions) ? body.sessions : [];
  if (incoming.length > MAX_IN) return json({ error: `For mange økter i én forespørsel (maks ${MAX_IN}).` }, 413);

  const db = env.DB;
  await ensureSchema(db);
  const now = Date.now();
  const writes = [];

  for (const s of incoming) {
    if (!s || typeof s !== 'object' || typeof s.date !== 'string' || s.date.length > 40) continue;
    const data = JSON.stringify(s);
    if (data.length > MAX_SESSION) continue;
    writes.push(db.prepare('INSERT OR IGNORE INTO sessions (id, data, created) VALUES (?1, ?2, ?3)').bind(s.date, data, now));
  }

  const m = body.meta;
  if (m && typeof m === 'object' && m.data && typeof m.data === 'object' && Number.isFinite(m.updated)) {
    const data = JSON.stringify(m.data);
    if (data.length <= MAX_SESSION) {
      writes.push(db.prepare(
        "INSERT INTO meta (k, data, updated) VALUES ('state', ?1, ?2) " +
        'ON CONFLICT(k) DO UPDATE SET data = excluded.data, updated = excluded.updated WHERE excluded.updated > meta.updated'
      ).bind(data, Math.max(0, Math.floor(m.updated))));
    }
  }

  for (let i = 0; i < writes.length; i += 100) await db.batch(writes.slice(i, i + 100));

  const [rows, metaRow, count] = await db.batch([
    db.prepare('SELECT seq, data FROM sessions WHERE seq > ?1 ORDER BY seq LIMIT ?2').bind(since, PAGE),
    db.prepare("SELECT data, updated FROM meta WHERE k = 'state'"),
    db.prepare('SELECT COUNT(*) AS n FROM sessions'),
  ]);

  const list = rows.results || [];
  const cursor = list.length ? list[list.length - 1].seq : since;
  const mr = (metaRow.results || [])[0];
  return json({
    cursor,
    more: list.length === PAGE,
    total: (count.results || [])[0]?.n ?? null,
    sessions: list.map(r => JSON.parse(r.data)),
    meta: mr ? { data: JSON.parse(mr.data), updated: mr.updated } : null,
  });
}
