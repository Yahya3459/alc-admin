# Alc Admin

## التثبيت

1. افتح الطرفية في مجلد المشروع:

```powershell
cd "g:\مركز الامجاد\alc-admin"
```

2. يمكنك تثبيت الحزم باستخدام `pnpm` عبر `npm exec` إذا لم يكن مثبتاً عالمياً:

```powershell
npm exec -- pnpm install
```

3. إذا أردت تثبيت `pnpm` عالمياً:

```powershell
npm install -g pnpm
```

ثم:

```powershell
pnpm install
```

## أوامر التشغيل

- لتشغيل المشروع في وضع التطوير:

```powershell
pnpm run dev
```

- لبناء المشروع للإنتاج:

```powershell
pnpm run build
```

- لتشغيل النسخة المبنية بعد البناء:

```powershell
pnpm run start
```

- لتشغيل التحقق من TypeScript:

```powershell
pnpm run check
```

- لتشغيل الاختبارات:

```powershell
pnpm run test
```

- لتحديث قاعدة البيانات باستخدام `drizzle-kit`:

```powershell
pnpm run db:push
```

## سكربت التثبيت

يمكنك تشغيل سكربت PowerShell التالي لتثبيت الاعتمادات تلقائياً باستخدام `pnpm` إذا كان مثبتاً، وإلا يستخدم `npm`:

```powershell
cd "g:\مركز الامجاد\alc-admin"
./install-deps.ps1
```

## حل مشاكل التثبيت

إذا واجهت خطأ في الشبكة أو `ECONNRESET` أثناء التثبيت، فحاول ما يلي:

```powershell
npm config get registry
npm config get proxy
npm config get https-proxy
npm ping
```

وإذا كنت تستخدم شبكة محظورة أو خلف بروكسي، قوم بتعديل إعدادات `npm`:

```powershell
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
```

إذا كان `pnpm` غير مثبت عالمياً، يمكن تثبيته يدوياً ثم إعادة التشغيل:

```powershell
npm install -g pnpm
pnpm install
```

## ملاحظات

- هذا المشروع يستخدم `pnpm` كمدير حزم رئيسي.
- يعتمد على `Node.js` و `TypeScript` و `Vite` و `Express` و `React`.
- الحزم المطلوبة موجودة داخل `package.json`.
