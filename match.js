// Decides which pending order a payment belongs to. Pure function, easy to test.
const { nameOverlap, normPhone } = require('./parse');

function orderNames(o) { return [o.customer && [o.customer.firstName, o.customer.lastName].join(' '), o.shippingAddress && o.shippingAddress.name, o.billingAddress && o.billingAddress.name].filter(Boolean); }
function orderPhones(o) { return [o.phone, o.customer && o.customer.phone, o.shippingAddress && o.shippingAddress.phone, o.billingAddress && o.billingAddress.phone].filter(Boolean).map(normPhone); }

function decide(pay, orders, opts = {}) {
  const tol = opts.tolerance ?? 1;            // EGP
  const autoUnique = opts.autoUniqueAmount ?? true;
  const cands = orders.filter(o => Math.abs(o.outstanding - pay.amount) <= tol);
  const nameHit = o => orderNames(o).some(n => nameOverlap(pay.name, n) >= 1);
  const phoneHit = o => pay.phone && orderPhones(o).includes(normPhone(pay.phone));

  if (!cands.length) {
    const partial = orders.filter(o => (pay.phone && phoneHit(o)) || nameHit(o));
    return { action: 'review', reason: partial.length ? 'amount-mismatch' : 'no-order', orders: partial };
  }
  if (pay.kind === 'wallet') {
    const strong = cands.filter(phoneHit);
    if (strong.length === 1) return { action: 'pay', order: strong[0], confidence: 'phone+amount' };
    const named = cands.filter(nameHit);
    if (named.length === 1) return { action: 'pay', order: named[0], confidence: 'name+amount' };
    if (cands.length === 1 && autoUnique) return { action: 'review', reason: 'different-phone', orders: cands };
    return { action: 'review', reason: 'several-orders', orders: cands };
  }
  // InstaPay: no phone in the SMS, use the sender name, then a unique amount
  const named = cands.filter(nameHit);
  if (named.length === 1) return { action: 'pay', order: named[0], confidence: 'name+amount' };
  if (cands.length === 1 && autoUnique) return { action: 'pay', order: cands[0], confidence: 'unique-amount' };
  return { action: 'review', reason: 'several-orders', orders: cands };
}
module.exports = { decide };
