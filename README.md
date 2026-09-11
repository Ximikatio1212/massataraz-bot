# 🏋️ Massa Taraz — Telegram-бот интернет-магазина спортивного питания

Полноценный Telegram-магазин спортивного питания **без Telegram Mini App**. Весь интерфейс работает через обычные сообщения Telegram, inline-кнопки и пошаговые сценарии.

## Архитектура

- **Node.js + TypeScript**
- **grammY** — Telegram Bot API
- **Netlify Functions** — serverless-обработка webhook (без polling)
- **PostgreSQL + Prisma ORM** — хранение данных
- **MinIO / S3-совместимое хранилище** — изображения и чеки

Состояние многошаговых сценариев (FSM) хранится в базе данных, поэтому не теряется между вызовами serverless-функций.

## Возможности

### Пользователь
- Просмотр динамических категорий и товаров
- Готовые курсы (физические комплекты товаров)
- Корзина (товары + курсы), изменение количества
- Оформление заказа: ФИО, регион, город, адрес, телефон
- Реквизиты оплаты, загрузка чека
- История заказов и статусы

### Администратор (определяется по ``ADMIN_IDS``)
- Управление категориями, товарами, курсами
- Состав курсов и количество каждого товара
- Отдельная цена курса
- Управление остатками
- Просмотр клиентов, заказов, чеков
- Подтверждение/отклонение оплат, смена статусов
- Статистика продаж

---

## 1. Установка

### 1.1 Требования
- Node.js 18+
- PostgreSQL (Supabase, Neon, Render, локально — любой)
- S3-совместимое хранилище (Wasabi, Cloudflare R2, MinIO, Supabase Storage и т.п.)
- Аккаунт Netlify

### 1.2 Создание бота и получение токена
1. Откройте [BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте `/newbot`.
3. Введите имя бота (например, `Massa Taraz Shop`) и username (например, `massa_taraz_shop_bot`).
4. Скопируйте полученный **токен** (вида `123456:ABC-DEF...`).
5. При необходимости настройте фото и описание через BotFather (`/setdescription`, `/setuserpic`).

### 1.3 Создание базы данных PostgreSQL
Создайте базу и получите строку подключения:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

Подойдут бесплатные сервисы: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app).

### 1.4 Настройка S3-хранилища
Создайте bucket (например, `massa-taraz`). Получите:
- Endpoint (например, `https://s3.wasabisys.com`)
- Access Key
- Secret Key

### 1.5 Реквизиты оплаты
Заполните номер и реквизиты для оплаты (Kaspi, банковская карта и т.п.) в `.env`:
- `PAYMENT_PHONE` — телефон для оплаты (показывается клиенту)
- `PAYMENT_DETAILS` — реквизиты

---

## 2. Настройка проекта

### 2.1 Клонирование
```bash
git clone <ваш-репозиторий>
cd massa-taraz
```

### 2.2 Установка зависимостей
```bash
npm install
```

### 2.3 Переменные окружения
```bash
cp .env.example .env
```
Заполните `.env`:

```env
BOT_TOKEN=123456:ABC-DEF...
# Секрет webhook (любая строка) — Telegram пришлёт его в заголовке X-Telegram-Bot-Api-Secret-Token
WEBHOOK_SECRET=my-secret-webhook-string

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public

# ID администраторов через запятую
ADMIN_IDS=123456789,987654321

PAYMENT_PHONE=+7 700 123 45 67
PAYMENT_DETAILS=Kaspi 4400 4301 2345 6789 (Иванов Иван)

STORAGE_ENDPOINT=https://s3.wasabisys.com
STORAGE_BUCKET=massa-taraz
STORAGE_ACCESS_KEY=xxxx
STORAGE_SECRET_KEY=xxxx
# Публичный endpoint S3 (для R2 public bucket и аналогов)
STORAGE_PUBLIC_ENDPOINT=https://pub-xxxx.r2.dev
```

> **Как узнать свой Telegram ID:** напишите [@userinfobot](https://t.me/userinfobot) — он покажет ваш ID.

### 2.4 Prisma
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 2.5 Сборка
```bash
npm run build
```

---

## 3. Локальный запуск

Для локальной разработки используется polling (в production — только webhook):

```bash
npm run dev
```

> `ts-node` должен уметь читать `process.env`. Если переменные не подхватились, проверьте, что установлен пакет `dotenv` и файл `.env` находится в корне проекта.

---

## 4. Деплой на Netlify

### 4.1 Создание сайта
1. Зайдите на [app.netlify.com](https://app.netlify.com).
2. «Add new site» → «Import an existing project».
3. Подключите Git-репозиторий и выберите ветку.
4. Build command: `npm run build`
5. Publish directory: `public`
6. Functions directory: `dist/netlify/functions`

### 4.2 Переменные окружения на Netlify
В разделе **Site settings → Environment variables** добавьте все переменные из `.env.example` (BOT_TOKEN, DATABASE_URL, ADMIN_IDS, PAYMENT_*, STORAGE_*).

### 4.3 Деплой через CLI (альтернатива)
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

---

## 5. Настройка Telegram Webhook

После деплоя получите URL вашей функции. По умолчанию Netlify раздаёт функции по адресу:

```text
https://YOUR-DOMAIN/.netlify/functions/telegram-webhook
```

Мы перенаправили `/api/*` на функции, поэтому используйте:

```text
https://YOUR-DOMAIN/api/telegram-webhook
```

### 5.1 Установка webhook через curl

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR-DOMAIN/api/telegram-webhook","secret_token":"<WEBHOOK_SECRET>"}'
```

Секрет должен совпадать с переменной окружения `WEBHOOK_SECRET` на Netlify. Функция проверяет заголовок `X-Telegram-Bot-Api-Secret-Token` и отклоняет запросы без него (401), защищая бота от поддельных апдейтов.

### 5.2 Проверка webhook
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```
В ответе должно быть:

```json
{
  "ok": true,
  "result": {
    "url": "https://YOUR-DOMAIN/api/telegram-webhook",
    "pending_update_count": 0
  }
}
```

### 5.3 Удаление webhook (при необходимости)
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

---

## 6. Первые шаги в боте

1. Откройте бота и нажмите **Start**.
2. Чтобы стать администратором, добавьте свой Telegram ID в `ADMIN_IDS` (список через запятую) и перезапустите деплой.
3. В боте откройте **⚙️ Админ-панель**.

### 6.1 Создание категории
`⚙️ Админ-панель → 📁 Категории → ➕ Создать категорию` → введите название, описание, изображение → «✅ Создать».

### 6.2 Создание товара
`⚙️ Админ-панель → 📦 Товары → ➕ Добавить товар` → пошагово: название → цена → описание → категория → остаток → изображение → предпросмотр → «✅ Создать».

### 6.3 Создание готового курса
`⚙️ Админ-панель → 📚 Готовые курсы → ➕ Создать курс` → название → описание → цена → **добавить товары и количества** → изображение → «✅ Создать».

Курс — это физический комплект товаров. Цена курса задаётся отдельно (например, дешевле суммы товаров по отдельности).

### 6.4 Проверка заказа
1. Пользователь добавляет товары/курсы в корзину.
2. «💳 Перейти к оплате» → создаётся заказ, показываются реквизиты.
3. Вводятся ФИО, регион, город, адрес, телефон.
4. Подтверждение данных → отправка чека (фото/PDF).
5. Администратор получает уведомление автоматически.

### 6.5 Подтверждение оплаты
В уведомлении администратора нажмите «✅ Подтвердить оплату» (остатки товаров спишутся автоматически) или «❌ Отклонить оплату» (нужно ввести причину — клиенту придёт уведомление и он сможет отправить новый чек).

### 6.6 Очистка заказов
В «⚙️ Админ-панель → 🛒 Заказы» доступны две кнопки:
- «🧹 Очистить историю» — удаляет завершённые и отменённые заказы.
- «🗑 Удалить ВСЕ заказы» — удаляет все заказы без исключения (удобно для тестирования). Подтверждается отдельным нажатием.

---

## 7. Структура проекта

```text
src/
  bot/
    handlers/       — обработчики Telegram-сценариев
    keyboards/      — inline-клавиатуры
    middleware/     — auth, admin
    bot.ts          — сборка бота
    router.ts       — маршрутизация callback и сообщений
    helpers.ts      — утилиты отправки сообщений
  services/         — бизнес-логика (Prisma)
  utils/            — форматирование, валидация, ошибки
  db/prisma.ts      — клиент Prisma
  instance.ts       — singleton бота
netlify/functions/  — serverless-функции
prisma/schema.prisma
.env.example
netlify.toml
package.json
README.md
```

## 8. Безопасность

- Права администратора проверяются на backend при **каждом** действии (`isAdminUser`).
- `callback_data` никогда не считается доверенной: объект, владелец, активность и статус проверяются заново.
- Пользователь видит только свои заказы и корзину.
- Цены и суммы рассчитываются на сервере по данным PostgreSQL.
- Многошаговые операции защищены от повторного выполнения.
- Остатки списываются транзакцией при подтверждении оплаты (нельзя уйти в минус).
- Загрузка файлов: проверка MIME-типа, расширения и размера (макс. 10 МБ).
- Секреты — только в переменных окружения.

## 9. Netlify-ограничения

- Функции Netlify ограничены по времени (≈10 с). Тяжёлые операции (загрузка фото) уже оптимизированы.
- Для продакшена убедитесь, что Prisma engine скомпилирован под нужную платформу (см. ниже).

### 9.1 Prisma binaryTargets (если деплой падает с «Prisma Client could not locate the Query Engine»)

Добавьте в `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Затем заново `npx prisma generate`. Для Netlify также можно установить локально `prisma` в prod dependencies и использовать есbuild-бандлер.

---