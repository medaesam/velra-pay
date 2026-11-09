const assert = require('assert');
const { parseSms } = require('./parse');
const { decide } = require('./match');
const vf = `تم استلام مبلغ 1300 جنيه من رقم 01012225436 المسجل بإسم Mahmoud H Elsaid على رقم محفظتك  01090119869.
رصيدك الحالي: 1301.21 جنيه
تاريخ العملية: 22:28 26-05-01
رقم العملية: 019629516471
تابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash`;
const ip = 'تم إضافة تحويل لحظي لبطاقتكم مسبقة الدفع بمبلغ 2000.00 جم من حسين محمود زكريا محمد نصر رقم مرجعي 245992494484 يوم 11-08 الساعة 18:09 للمزيد اتصل بـ 19623';
const a = parseSms(vf), b = parseSms(ip);
console.log(a); console.log(b);
assert.deepStrictEqual([a.kind, a.amount, a.phone, a.name, a.ref], ['wallet', 1300, '01012225436', 'Mahmoud H Elsaid', '019629516471']);
assert.deepStrictEqual([b.kind, b.amount, b.name, b.ref], ['instapay', 2000, 'حسين محمود زكريا محمد نصر', '245992494484']);
assert.strictEqual(parseSms('رصيدك الحالي 50 جنيه'), null);
const O = (name, amt, phone, cust) => ({ id: name, name, outstanding: amt, phone, customer: { firstName: cust, lastName: '' }, shippingAddress: { name: cust, phone } });
// wallet: phone + amount wins even with another order of same amount
let d = decide(a, [O('#1001', 1300, '+201012225436', 'Mona'), O('#1002', 1300, '01111111111', 'Sara')]);
assert.strictEqual(d.action, 'pay'); assert.strictEqual(d.order.name, '#1001');
// wallet: unique amount but different phone -> review
d = decide(a, [O('#1003', 1300, '01111111111', 'Sara')]); assert.strictEqual(d.action, 'review');
// instapay: Arabic name overlap
d = decide(b, [O('#1004', 2000, '0122', 'حسين نصر'), O('#1005', 2000, '0100', 'Laila')]); assert.strictEqual(d.order.name, '#1004');
// instapay: unique amount, English name -> auto
d = decide(b, [O('#1006', 2000, '0100', 'Hussein Nasr'), O('#1007', 950, '0100', 'X')]); assert.strictEqual(d.action, 'pay'); assert.strictEqual(d.confidence, 'unique-amount');
// instapay: two equal amounts, no name hit -> review
d = decide(b, [O('#1008', 2000, '0', 'A1'), O('#1009', 2000, '0', 'B2')]); assert.strictEqual(d.action, 'review');
// amount mismatch
d = decide(a, [O('#1010', 1250, '01012225436', 'Mahmoud')]); assert.strictEqual(d.reason, 'amount-mismatch');
console.log('all tests passed');
