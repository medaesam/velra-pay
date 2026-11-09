// End-to-end with a fake Shopify: checks the right mutations are sent.
process.env.SHOP='test.myshopify.com'; process.env.SHOPIFY_CLIENT_ID='id'; process.env.SHOPIFY_CLIENT_SECRET='sec'; process.env.SECRET='k';
const calls=[];
const orders=[
 {id:'gid://1',name:'#1021',createdAt:'',tags:[],note:'',paymentGatewayNames:['إنستاباي أو فودافون كاش'],phone:null,totalOutstandingSet:{shopMoney:{amount:'1300.0'}},customer:{firstName:'Mahmoud',lastName:'Elsaid',phone:null},shippingAddress:{name:'Mahmoud Elsaid',phone:'+20 101 222 5436'},billingAddress:null},
 {id:'gid://2',name:'#1022',createdAt:'',tags:[],note:'',paymentGatewayNames:['إنستاباي أو فودافون كاش'],phone:null,totalOutstandingSet:{shopMoney:{amount:'2000.0'}},customer:{firstName:'Hussein',lastName:'Nasr',phone:null},shippingAddress:{name:'Hussein Nasr',phone:'01000000000'},billingAddress:null},
 {id:'gid://3',name:'#1023',createdAt:'',tags:[],note:'',paymentGatewayNames:['Cash on Delivery (COD)'],phone:null,totalOutstandingSet:{shopMoney:{amount:'2000.0'}},customer:{firstName:'Other',lastName:'',phone:null},shippingAddress:{name:'Other',phone:'0'},billingAddress:null},
];
global.fetch=async(url,opt)=>{ calls.push(url);
  if(url.endsWith('/oauth/access_token')) return {ok:true,json:async()=>({access_token:'tok',expires_in:86399})};
  const b=JSON.parse(opt.body); const q=b.query;
  let data={};
  if(q.includes('orders(first:100')) data={orders:{nodes:orders}};
  else if(q.includes('orders(first:1,')) data={orders:{nodes:[]}};
  else if(q.includes('orderMarkAsPaid')) { calls.push('PAID '+b.variables.input.id); data={orderMarkAsPaid:{userErrors:[]}}; }
  else if(q.includes('tagsAdd')) { calls.push('TAGS '+b.variables.id+' '+b.variables.tags.join(',')); data={tagsAdd:{userErrors:[]}}; }
  else if(q.includes('orderUpdate')) data={orderUpdate:{userErrors:[]}};
  return {ok:true,json:async()=>({data})};
};
const {handle}=require('./server');
(async()=>{
  const vf='تم استلام مبلغ 1300 جنيه من رقم 01012225436 المسجل بإسم Mahmoud H Elsaid على رقم محفظتك  01090119869.\nرصيدك الحالي: 1301.21 جنيه\nرقم العملية: 019629516471';
  const ip='تم إضافة تحويل لحظي لبطاقتكم مسبقة الدفع بمبلغ 2000.00 جم من حسين محمود زكريا محمد نصر رقم مرجعي 245992494484 يوم 11-08 الساعة 18:09';
  console.log((await handle(vf)).msg);
  console.log((await handle(ip)).msg);
  console.log((await handle(vf)).msg);
  console.log((await handle('عرض خاص من فودافون')).msg);
  console.log(calls.filter(c=>/^(PAID|TAGS)/.test(c)).join('\n'));
})();
