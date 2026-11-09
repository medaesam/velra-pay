# VELRA Pay: تأكيد تحويلات إنستاباي وفودافون كاش أوتوماتيك

لما فلوس توصلك على المحفظة أو إنستاباي، الآيفون يبعت رسالة الـ SMS للسيرفر ده. السيرفر يدوّر على الطلب المستني في شوبيفاي ويعلّمه **مدفوع**، وتجيلك إشعار على التليفون بالنتيجة.

## إزاي بيقرر
- **فودافون كاش:** المبلغ + رقم اللي حوّل (لازم يطابق رقم العميلة في الطلب) ← يتعلّم مدفوع. لو الرقم مختلف ← مراجعة.
- **إنستاباي:** المبلغ + اسم اللي حوّل ← يتعلّم مدفوع. لو مفيش غير طلب واحد بالمبلغ ده ← يتعلّم مدفوع وعليه تاج `check-name` علشان تبص على الاسم.
- أي حالة فيها شك (مبلغ مختلف، أكتر من طلب بنفس المبلغ، مفيش طلب) ← الطلب ياخد تاج `payment-review` وملاحظة، وتجيلك إشعار تراجعه.
- كل تحويل بيتسجل برقم العملية (تاج `ref-...`)، فلو نفس الرسالة اتبعتت مرتين مش هتتحسب مرتين.
- الطلبات اللي بتتشاف بس: طلبات **إنستاباي/فودافون كاش** اللي لسه مش مدفوعة، من آخر 48 ساعة.
- نص الرسالة الكامل (فيه رصيدك) **مش بيتسجل** في أي مكان.

## 1) طريقة الدفع في شوبيفاي
Settings ← Payments ← Manual payment methods ← + Method ← **Create custom payment method**
- **الاسم (لازم فيه كلمة إنستاباي أو فودافون):** `إنستاباي أو فودافون كاش (InstaPay / Vodafone Cash)`
- **Additional details:**
  حوّلي إجمالي الطلب بالظبط على 01090119869 بإنستاباي أو فودافون كاش، ويُفضّل من نفس رقم التليفون اللي في الطلب.
  Transfer the exact order total to 01090119869 via InstaPay or Vodafone Cash, ideally from the phone number on your order.
- **Payment instructions:**
  شكرًا لطلبك من VELRA! حوّلي المبلغ بالظبط على 01090119869 (إنستاباي أو فودافون كاش). أول ما التحويل يوصل، طلبك هيتأكد تلقائيًا ويتجهّز للشحن.
  Thank you for ordering from VELRA! Transfer the exact amount to 01090119869 (InstaPay or Vodafone Cash). Your order is confirmed automatically as soon as the transfer arrives.

## 2) تطبيق شوبيفاي (علشان السيرفر يقدر يعلّم الطلبات مدفوعة)
1. افتح **dev.shopify.com** بنفس حساب الستور ← **Apps ← Create app** ← سمّيه `velra-pay`.
2. في **Versions**: اختار الصلاحيات `read_orders` و `write_orders` بس ← **Release**.
3. **Install** التطبيق على ستور Velra ووافق على الصلاحيات.
4. من **Settings** بتاعة التطبيق انسخ **Client ID** و **Client secret**.

## 3) تشغيل السيرفر على Railway
1. New Project ← Deploy from GitHub (ارفع الفولدر ده كـ repo) أو `railway up` من الفولدر.
2. **Variables:**
   - `SHOP` = عنوان الستور اللي آخره myshopify.com (تلاقيه في Settings ← Domains)
   - `SHOPIFY_CLIENT_ID` = من خطوة 2
   - `SHOPIFY_CLIENT_SECRET` = من خطوة 2
   - `SECRET` = `<المفتاح السري اللي بعتهولك في الشات>`
   - `DRY_RUN` = `true` (للتجربة الأول، وبعدها امسحه أو خليه `false`)
3. Settings ← Networking ← **Generate Domain**. هيطلعلك عنوان زي `velra-pay-production.up.railway.app`.
4. افتح `https://<العنوان>/health` في المتصفح، لازم يظهر `{"ok":true}`.

## 4) الأتمتة على الآيفون (مرتين: واحدة للمحفظة وواحدة لإنستاباي)
Shortcuts ← **Automation** ← **+** ← **Message**
- **Message Contains:** `تم استلام مبلغ` (للمحفظة). وفي الأتمتة التانية: `تحويل لحظي` (لإنستاباي)
- اختار **Run Immediately** (ومش Notify When Run)
- **Next ← New Blank Automation**، وضيف الأكشنز دي بالترتيب:
  1. **Get Contents of URL**
     - URL: `https://<العنوان>/sms?format=text`
     - Method: **POST**
     - Headers: `X-Velra-Key` = `<المفتاح السري اللي بعتهولك في الشات>`
     - Request Body: **JSON** ← مفتاح `text` (Text) = **Shortcut Input** (اختار منه Content)
  2. **Show Notification** ← خليه يعرض **Contents of URL**
- اعمل نفس الخطوات للأتمتة التانية.

## 5) التجربة
- و DRY_RUN = true: اعمل طلب تجريبي بطريقة «إنستاباي أو فودافون كاش»، وحوّل لنفسك مبلغ مساوي، أو ابعت لنفسك رسالة فيها نص رسالة قديمة. هتجيلك إشعار فيه «(تجربة)» من غير ما حاجة تتغير في شوبيفاي.
- لما تتأكد، غيّر `DRY_RUN` لـ `false`.

## ملاحظات
- التليفون لازم يكون شغال وعليه نت علشان الأتمتة تشتغل.
- لو البنك أو فودافون غيّروا صيغة الرسالة، هتجيلك «الرسالة دي مش رسالة فلوس واصلة». ابعتلي الصيغة الجديدة وأظبطها.
- إعدادات إضافية: `WINDOW_HOURS` (المدة اللي بيدوّر فيها، افتراضي 48)، `AUTO_UNIQUE_AMOUNT` (خليه `false` لو عايز كل تحويلات إنستاباي تيجي مراجعة)، `METHOD_MATCH`، `API_VERSION`.
- الاختبارات: `npm test`
