// VELRA payment checker: receives wallet/InstaPay SMS from an iPhone Shortcut,
// finds the matching pending Shopify order and marks it as paid.
const http = require('http');
const { parseSms } = require('./parse');
const { decide } = require('./match');

const {
  SHOP,                         // e.g. velra-beauty.myshopify.com
  SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,   // Dev Dashboard app (client credentials grant)
  SHOPIFY_ADMIN_TOKEN,          // or a legacy shpat_ token if you already have one
  SECRET,                       // shared key the iPhone Shortcut sends
  PORT = 3000,
  API_VERSION = '2026-07',
  METHOD_MATCH = 'instapay|vodafone|wallet|محفظة|انستاباي|إنستاباي',  // manual payment method name
  WINDOW_HOURS = '48',
  AUTO_UNIQUE_AMOUNT = 'true',  // InstaPay: auto-mark when only one order has that amount
  DRY_RUN = 'false',
} = process.env;

const money = n => `${Number(n).toLocaleString('en-US')} ج`;
const seen = new Set();          // refs handled since boot (tags on the order are the durable record)

/* ---------- Shopify ---------- */
let token = SHOPIFY_ADMIN_TOKEN || null, tokenExp = SHOPIFY_ADMIN_TOKEN ? Infinity : 0;
async function getToken() {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SHOPIFY_CLIENT_ID, client_secret: SHOPIFY_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error('token ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  token = j.access_token; tokenExp = Date.now() + ((j.expires_in || 86399) - 300) * 1000;
  return token;
}
async function gql(query, variables) {
  const r = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getToken() },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  return j.data;
}
const ORDER_FIELDS = `id name createdAt tags note paymentGatewayNames phone
  totalOutstandingSet { shopMoney { amount } }
  customer { firstName lastName phone } shippingAddress { name phone } billingAddress { name phone }`;

async function pendingOrders() {
  const since = new Date(Date.now() - Number(WINDOW_HOURS) * 3600e3).toISOString();
  const d = await gql(`query($q:String!){ orders(first:100, query:$q, sortKey:CREATED_AT, reverse:true){ nodes { ${ORDER_FIELDS} } } }`,
    { q: `financial_status:pending created_at:>='${since}'` });
  const re = new RegExp(METHOD_MATCH, 'i');
  return d.orders.nodes
    .filter(o => o.paymentGatewayNames.some(g => re.test(g)))
    .map(o => ({ ...o, outstanding: parseFloat(o.totalOutstandingSet.shopMoney.amount) }));
}
async function alreadyHandled(ref) {
  if (!ref) return false;
  if (seen.has(ref)) return true;
  const d = await gql(`query($q:String!){ orders(first:1, query:$q){ nodes { name } } }`, { q: `tag:'ref-${ref}'` });
  return d.orders.nodes[0] ? d.orders.nodes[0].name : false;
}
async function addTagsAndNote(o, tags, line) {
  await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors { message } } }`, { id: o.id, tags });
  const note = (o.note ? o.note + '\n' : '') + line;
  await gql(`mutation($input:OrderInput!){ orderUpdate(input:$input){ userErrors { message } } }`, { input: { id: o.id, note } });
}
async function markPaid(o) {
  const d = await gql(`mutation($input:OrderMarkAsPaidInput!){ orderMarkAsPaid(input:$input){ userErrors { field message } } }`, { input: { id: o.id } });
  const e = d.orderMarkAsPaid.userErrors; if (e.length) throw new Error(e.map(x => x.message).join('; '));
}

/* ---------- main flow ---------- */
async function handle(text) {
  const pay = parseSms(text);
  if (!pay) return { ok: false, msg: 'ℹ️ الرسالة دي مش رسالة فلوس واصلة، اتجاهلت.' };
  const who = pay.phone ? `${pay.phone} (${pay.name})` : pay.name;
  const tagRef = pay.ref ? `ref-${pay.ref}` : null;
  const prev = await alreadyHandled(pay.ref);
  if (prev) return { ok: true, msg: prev === true ? '↩️ التحويل ده اتسجل قبل كده.' : `↩️ التحويل ده اتسجل قبل كده على طلب ${prev}.` };

  const orders = await pendingOrders();
  const d = decide(pay, orders, { autoUniqueAmount: AUTO_UNIQUE_AMOUNT === 'true' });
  const line = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${pay.provider}: ${money(pay.amount)} من ${who}${pay.ref ? ' · رقم العملية ' + pay.ref : ''}`;

  if (d.action === 'pay') {
    if (DRY_RUN !== 'true') {
      await markPaid(d.order);
      await addTagsAndNote(d.order, ['paid-auto', pay.kind === 'wallet' ? 'vf-cash' : 'instapay', tagRef, d.confidence === 'unique-amount' ? 'check-name' : null].filter(Boolean),
        `${line} · اتأكد تلقائيًا (${d.confidence})`);
    }
    if (pay.ref) seen.add(pay.ref);
    const extra = d.confidence === 'unique-amount' ? ' · بص على الاسم للتأكيد' : '';
    return { ok: true, order: d.order.name, msg: `✅ طلب ${d.order.name} اتعلّم مدفوع: ${pay.provider} ${money(pay.amount)} من ${pay.name}${extra}${DRY_RUN === 'true' ? ' (تجربة)' : ''}` };
  }
  const reasons = { 'no-order': 'مفيش طلب مستني بالمبلغ ده', 'amount-mismatch': 'فيه طلب للعميل ده بس المبلغ مختلف', 'different-phone': 'فيه طلب بنفس المبلغ بس من رقم تاني', 'several-orders': 'فيه أكتر من طلب بنفس المبلغ' };
  if (DRY_RUN !== 'true') for (const o of (d.orders || []).slice(0, 3)) await addTagsAndNote(o, ['payment-review', tagRef].filter(Boolean), `${line} · محتاج مراجعة: ${reasons[d.reason]}`);
  const names = (d.orders || []).map(o => o.name).join('، ');
  return { ok: true, review: true, msg: `⚠️ وصل ${money(pay.amount)} (${pay.provider}) من ${who}. ${reasons[d.reason]}${names ? ': ' + names : ''}. راجع بنفسك.` };
}

const server = http.createServer(async (req, res) => {
  const asText = (req.url || '').includes('format=text');
  const send = (code, body) => { if (asText) { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(body.msg || (body.ok ? 'ok' : 'error')); } res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method !== 'POST' || !req.url.startsWith('/sms')) return send(404, { ok: false });
  if (!SECRET || req.headers['x-velra-key'] !== SECRET) return send(401, { ok: false, msg: 'unauthorized' });
  let body = ''; req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
  req.on('end', async () => {
    try {
      let text = body; try { const j = JSON.parse(body); text = j.text || j.message || body; } catch (e) {}
      const out = await handle(text);
      console.log(new Date().toISOString(), out.msg);          // the raw SMS (with your balance) is never logged
      send(200, out);
    } catch (e) { console.error(e); send(500, { ok: false, msg: '❌ حصلت مشكلة: ' + e.message.slice(0, 120) }); }
  });
});
if (require.main === module) server.listen(PORT, () => console.log('velra-pay listening on', PORT));
module.exports = { handle };
