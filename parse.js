// Parses incoming-money SMS from Vodafone Cash and InstaPay (bank) into a common shape.
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function toLatin(s) { return String(s || '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)); }
function num(s) { return parseFloat(toLatin(s).replace(/,/g, '')); }

function parseSms(raw) {
  const text = toLatin(raw).replace(/\s+/g, ' ').trim();

  // Vodafone Cash: "تم استلام مبلغ 1300 جنيه من رقم 01012225436 المسجل بإسم Mahmoud H Elsaid على رقم محفظتك ... رقم العملية: 019629516471"
  // also: "تم استلام مبلغ 1.00 جنيه من 01090119869؛ المسجل بإسم MOHAMED ESAM على رقم محفظتك 0109... بتاريخ 10-11-26 07:22"
  let m = text.match(/استلام مبلغ ([\d.,]+)\s*جنيه\s+من\s+(?:رقم\s+)?(\+?\d{10,13})\s*[؛;:،,]?\s*المسجل\s+ب[اإ]سم\s+(.+?)\s+على رقم محفظتك/);
  if (m) {
    let ref = (text.match(/رقم العملية:? ?(\d{6,})/) || [])[1] || null;
    if (!ref) { const dt = text.match(/بتاريخ\s+(\d{1,2})-(\d{1,2})-(\d{2,4})\s+(\d{1,2}):(\d{2})/); if (dt) ref = 'vf' + dt.slice(1).join('') + m[2].slice(-4) + String(m[1]).replace(/\D/g, ''); }
    return { kind: 'wallet', provider: 'Vodafone Cash', amount: num(m[1]), phone: m[2], name: m[3].trim(), ref };
  }

  // InstaPay (bank card): "تم إضافة تحويل لحظي لبطاقتكم ... بمبلغ 2000.00 جم من حسين محمود زكريا محمد نصر رقم مرجعي 245992494484 يوم 11-08 الساعة 18:09"
  m = text.match(/تحويل لحظي.*?بمبلغ ([\d.,]+) ?(?:جم|جنيه|EGP) من (.+?) رقم مرجعي (\d{6,})/);
  if (m) return { kind: 'instapay', provider: 'InstaPay', amount: num(m[1]), phone: null, name: m[2].trim(), ref: m[3] };

  // InstaPay, English variants some banks send
  m = text.match(/(?:received|credited)[^\d]*([\d.,]+) ?EGP.*?from (.+?)(?: ref(?:erence)?(?: no\.?)?:? ?(\d{6,})|\.|$)/i);
  if (m && /instapay|IPN/i.test(text)) return { kind: 'instapay', provider: 'InstaPay', amount: num(m[1]), phone: null, name: m[2].trim(), ref: m[3] || null };

  return null;
}

// Arabic/Latin name normalisation for loose matching
function normName(s) {
  return toLatin(s || '').toLowerCase()
    .replace(/[ً-ْـ]/g, '')       // diacritics, tatweel
    .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^a-zء-ي ]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
}
function nameOverlap(a, b) { const A = new Set(normName(a)); return normName(b).filter(w => A.has(w)).length; }
function normPhone(p) { const d = toLatin(p || '').replace(/\D/g, ''); return d.slice(-10); }

module.exports = { parseSms, normName, nameOverlap, normPhone, toLatin };
