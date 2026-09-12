export type Lang = "ru" | "kk";

const DICT: Record<Lang, Record<string, string>> = {
  ru: {
    // ── общие кнопки ──
    btn_catalog: "🛍 Фармакология",
    btn_courses: "📚 Готовые связки",
    btn_cart: "🛒 Корзина",
    btn_orders: "📦 Мои заказы",
    btn_consultant: "💬 Вопрос консультанту",
    btn_admin: "⚙️ Админ-панель",
    btn_back_main: "⬅️ Главное меню",
    btn_back: "⬅️ Назад",
    btn_add_cart: "➕ Добавить в корзину",
    btn_go_cart: "🛒 Перейти в корзину",
    btn_clear_cart: "🧹 Очистить корзину",
    btn_go_pay: "💳 Перейти к оплате",
    btn_del: "🗑 Удалить",
    btn_back_cart: "⬅️ Назад в корзину",
    btn_confirm_ok: "✅ Всё верно",
    btn_edit: "✏️ Изменить",
    btn_cancel: "❌ Отмена",
    btn_attach_check: "📎 Прикрепить чек",
    btn_fill_data: "📝 Заполнить данные",
    btn_add_course_cart: "🛒 Добавить в корзину",
    btn_lang_ru: "🇷🇺 Русский",
    btn_lang_kk: "🇰🇿 Қазақша",
    unit_pcs: "шт",

    // ── старт ──
    greeting_user: "🏋️ <b>MASSA TARAZ</b>\n\nПривет, {name}! Выберите раздел:",
    help: "🏋️ <b>Massa Taraz</b>\n\nМагазин спортивного питания.\n\nИспользуйте меню для покупок. По всем вопросам — напишите нам @massataraz08.",

    // ── каталог ──
    catalog_title: "🛍 <b>ФАРМАКОЛОГИЯ</b>\n\nВыберите категорию:",
    catalog_empty: "🛍 <b>ФАРМАКОЛОГИЯ</b>\n\nПока нет доступных категорий.",
    category_empty: "🛍 В этой категории пока нет товаров.",
    category_label: "📁 <b>Категория</b>",
    choose_product: "Выберите товар:",
    in_stock: "📦 В наличии: {n} шт.",
    no_stock: "❌ Нет в наличии",

    // ── товар ──
    product_not_found: "❌ Товар не найден или недоступен.",
    product_added: "✅ Товар добавлен в корзину",
    price_label: "💰 Цена: {price}",
    product_no_stock: "❌ Товара сейчас нет в наличии",
    cart_count_note: "\n\n🛒 В корзине сейчас: {n} шт.",

    // ── курсы ──
    courses_title: "📚 <b>ГОТОВЫЕ СВЯЗКИ</b>",
    courses_empty: "📚 <b>ГОТОВЫЕ СВЯЗКИ</b>\n\nПока нет доступных курсов.",
    course_not_found: "❌ Курс не найден или недоступен.",
    in_pack: "📦 <b>В комплекте:</b>",
    course_price: "💰 Цена курса: {price}",
    course_added: "✅ Курс добавлен в корзину",

    // ── корзина ──
    cart_empty: "🛒 <b>КОРЗИНА</b>\n\nВаша корзина пуста.",
    cart_title: "🛒 <b>КОРЗИНА</b>",
    cart_total: "💰 <b>Итого: {total}</b>",
    cart_hint: "Нажмите на товар, чтобы изменить количество.",
    item_not_found: "❌ Позиция не найдена.",
    item_price_subtotal: "💰 Цена: {price} × {qty} = <b>{subtotal}</b>",
    item_in_stock: "📦 В наличии: {n} шт",
    item_course_comp: "📦 Состав курса",
    item_qty: "Количество: <b>{qty}</b>",
    cart_cleared: "🧹 Корзина очищена.",

    // ── заказы ──
    orders_empty: "📦 <b>МОИ ЗАКАЗЫ</b>\n\nУ вас пока нет заказов.",
    orders_title: "📦 <b>МОИ ЗАКАЗЫ</b>",
    orders_page: "📄 Страница {a} из {b} • Всего: {n}",
    order_not_found: "❌ Заказ не найден.",
    order_denied: "❌ Заказ не найден или доступ запрещён.",
    order_title: "🧾 <b>ЗАКАЗ №{id}</b>",
    order_items: "🛍 <b>Товары:</b>",
    order_total: "💰 <b>Сумма: {total}</b>",
    order_address: "📍 <b>Адрес:</b> {addr}",
    order_postal: "🔢 <b>Индекс:</b> {code}",
    order_phone: "📞 <b>Телефон:</b> {phone}",
    order_status: "📦 <b>Статус:</b> {status}",
    order_payment: "💳 <b>Оплата:</b> {payment}",
    link_check: "📎 Чек",
    status_pending_payment: "💤 Ожидает оплаты",
    status_pending_verification: "🕐 Ожидает проверки",
    status_paid: "✅ Оплачен",
    status_processing: "🔵 В обработке",
    status_shipped: "🚚 Отправлен",
    status_completed: "✅ Завершён",
    status_cancelled: "❌ Отменён",
    payment_pending: "Ожидает оплаты",
    payment_pending_verification: "Ожидает проверки",
    payment_paid: "Оплачен",
    payment_rejected: "Отклонён",

    // ── оформление ──
    pay_not_configured: "⚠️ Реквизиты оплаты не настроены. Обратитесь к администратору.",
    order_no: "🧾 <b>ЗАКАЗ №{id}</b>",
    pay_amount: "💰 К оплате: {total}",
    pay_requisites_title: "Для оплаты используйте следующие реквизиты:",
    pay_number: "📱 Номер:",
    pay_details: "💳 Реквизиты:",
    attach_check: "⬇️ <b>Прикрепите чек</b> или нажмите «Отмена».",
    session_expired: "❌ Сессия оформления устарела. Начните заново.",
    send_receipt: "📎 Отправьте <b>чек об оплате</b> (фото или документ).\n\nПосле проверки администратором заказ будет обработан.",
    send_receipt_short: "📎 Отправьте чек об оплате (фото или документ).",
    enter_fio: "📝 Введите <b>ФИО</b>:",
    enter_fio_again: "📝 Введите <b>ФИО</b> заново:",
    enter_region: "📍 Введите <b>область/регион</b>:",
    enter_city: "🏙 Введите <b>город</b>:",
    enter_address: "🏠 Введите <b>адрес</b>:",
    enter_postal: "🔢 Введите <b>почтовый индекс</b>:",
    enter_phone: "📞 Введите <b>номер телефона</b>:",
    field_fio: "ФИО",
    field_region: "Область/регион",
    field_city: "Город",
    fio_set: "📝 <b>ФИО</b>: {v}",
    region_set: "📍 <b>Регион</b>: {v}",
    city_set: "🏙 <b>Город</b>: {v}",
    address_set: "🏠 <b>Адрес</b>: {v}",
    postal_set: "🔢 <b>Индекс</b>: {v}",
    order_not_found_restart: "❌ Заказ не найден. Начните оформление заново.",
    check_order: "📦 <b>ПРОВЕРКА ЗАКАЗА</b>",
    label_fio: "👤 <b>ФИО</b>",
    label_region: "📍 <b>Регион</b>",
    label_city: "🏙 <b>Город</b>",
    label_addr: "🏠 <b>Адрес</b>",
    label_postal: "🔢 <b>Индекс</b>",
    label_phone: "📞 <b>Телефон</b>",
    summary_items: "🛍 <b>Товары:</b>",
    summary_sum: "💰 <b>Сумма: {total}</b>",
    order_confirmed: "✅ <b>Заказ №{id} подтверждён.</b>\n\nЧек получен, данные доставки сохранены.\n\nЗаказ отправлен на проверку.",
    data_saved_send_check: "✅ Данные сохранены.\n\n📎 <b>Отправьте чек об оплате.</b>\n\nПосле проверки администратором заказ будет обработан.",
    checkout_cancelled: "❌ Оформление отменено.",

    // ── чек ──
    receipt_order_not_found: "❌ Заказ не найден. Оформите заказ заново.",
    file_fail: "❌ Не удалось получить файл. Попробуйте ещё раз.",
    file_tg_fail: "❌ Не удалось получить файл из Telegram.",
    check_received_name: "✅ <b>Чек получен.</b>\n\nЗаказ №{id} забронирован.\n\n📝 Теперь введите <b>ФИО</b> для доставки:",
    check_received: "✅ <b>Чек получен.</b>\n\nВаш заказ №{id} отправлен на проверку.",
    save_failed: "⚠️ Не удалось сохранить чек. Попробуйте позже.",

    // ── консультант ──
    assistant_client_active: "💬 <b>Консультант активен.</b>\n\nНапишите свой вопрос о товарах, ценах, наличии или составе.\n\nВернуться к меню — нажмите любую кнопку ниже или «💬 Вопрос консультанту» ещё раз.",
    assistant_stop: "💬 Режим консультанта выключен.",

    // ── ошибки ──
    err_PRODUCT_UNAVAILABLE: "❌ Товар недоступен.",
    err_PRODUCT_NO_STOCK: "❌ Товара сейчас нет в наличии.",
    err_PRODUCT_STOCK_LIMIT: "❌ Недостаточно товара на складе.",
    err_COURSE_UNAVAILABLE: "❌ Курс недоступен.",
    err_COURSE_EMPTY: "❌ Курс пуст, добавьте товары в курс.",
    err_COURSE_COMPONENT_UNAVAILABLE: "❌ Один из товаров курса недоступен.",
    err_COURSE_COMPONENT_NO_STOCK: "❌ Недостаточно товаров в составе курса на складе.",
    err_COURSE_STOCK_LIMIT: "❌ Недостаточно товаров для нужного количества курса.",
    err_CART_EMPTY: "🛒 Корзина пуста.",
    err_CART_ITEM_NOT_FOUND: "❌ Позиция в корзине не найдена.",
    err_ORDER_NOT_FOUND: "❌ Заказ не найден.",
    err_ALREADY_PAID: "✅ Оплата по этому заказу уже подтверждена.",
    err_ORDER_CANCELLED: "❌ Заказ отменён.",
    err_UPDATE_FAILED: "❌ Не удалось выполнить операцию. Попробуйте ещё раз.",
    err_STORAGE_NOT_CONFIGURED: "❌ Файловое хранилище не настроено. Обратитесь к администратору.",
    err_FILE_TOO_LARGE: "❌ Файл слишком большой (максимум 10 МБ).",
    err_INVALID_MIME_TYPE: "❌ Недопустимый тип файла.",
    err_INVALID_EXTENSION: "❌ Недопустимое расширение файла.",
    err_INVALID_FILE_TYPE: "❌ Недопустимый тип файла.",
    err_CATEGORY_HAS_PRODUCTS: "❌ Нельзя удалить категорию, в которой есть товары. Сначала удалите товары.",
    err_PRODUCT_IN_COURSE: "❌ Нельзя удалить товар, который входит в готовые связки. Сначала удалите его из связок.",
    err_PRODUCT_IN_ORDERS: "❌ Нельзя удалить товар, который есть в заказах.",
    err_COURSE_IN_ORDERS: "❌ Нельзя удалить связку, которая есть в заказах.",
    err_NOT_ADMIN: "⛔ Доступ запрещён.",
    err_GENERIC: "⚠️ Что-то пошло не так. Попробуйте ещё раз.",

    // ── валидация ──
    phone_short: "Номер телефона слишком короткий",
    phone_long: "Номер телефона слишком длинный",
    phone_invalid: "Введите корректный номер телефона",
    name_short: "Слишком короткое имя",
    name_long: "Слишком длинное имя",
    addr_short: "Слишком короткий адрес",
    addr_long: "Слишком длинный адрес",
    postal_invalid: "Введите корректный почтовый индекс",
  },

  kk: {
    // ── общие кнопки ──
    btn_catalog: "🛍 Фармакология",
    btn_courses: "📚 Дайын жиынтықтар",
    btn_cart: "🛒 Себет",
    btn_orders: "📦 Менің тапсырыстарым",
    btn_consultant: "💬 Кеңесшіге сұрақ",
    btn_admin: "⚙️ Админ-панель",
    btn_back_main: "⬅️ Басты мәзір",
    btn_back: "⬅️ Артқа",
    btn_add_cart: "➕ Себетке қосу",
    btn_go_cart: "🛒 Себетке өту",
    btn_clear_cart: "🧹 Себетті тазалау",
    btn_go_pay: "💳 Төлеуге өту",
    btn_del: "🗑 Жою",
    btn_back_cart: "⬅️ Себетке қайту",
    btn_confirm_ok: "✅ Барлығы дұрыс",
    btn_edit: "✏️ Өзгерту",
    btn_cancel: "❌ Бас тарту",
    btn_attach_check: "📎 Чек тіркеу",
    btn_fill_data: "📝 Деректерді толтыру",
    btn_add_course_cart: "🛒 Себетке қосу",
    btn_lang_ru: "🇷🇺 Орысша",
    btn_lang_kk: "🇰🇿 Қазақша",
    unit_pcs: "дана",

    // ── старт ──
    greeting_user: "🏋️ <b>MASSA TARAZ</b>\n\nСәлем, {name}! Бөлімді таңдаңыз:",
    help: "🏋️ <b>Massa Taraz</b>\n\nСпорттық тамақтану дүкені.\n\nСатып алу үшін мәзірді пайдаланыңыз. Сұрақтар бойынша — @massataraz08 хабарын жазыңыз.",

    // ── каталог ──
    catalog_title: "🛍 <b>ФАРМАКОЛОГИЯ</b>\n\nКатегорияны таңдаңыз:",
    catalog_empty: "🛍 <b>ФАРМАКОЛОГИЯ</b>\n\nӘзірге қолжетімді категориялар жоқ.",
    category_empty: "🛍 Бұл категорияда әзірге тауарлар жоқ.",
    category_label: "📁 <b>Категория</b>",
    choose_product: "Тауарды таңдаңыз:",
    in_stock: "📦 Қолда бар: {n} дана.",
    no_stock: "❌ Қолда жоқ",

    // ── товар ──
    product_not_found: "❌ Тауар табылмады немесе қолжетімсіз.",
    product_added: "✅ Тауар себетке қосылды",
    price_label: "💰 Бағасы: {price}",
    product_no_stock: "❌ Тауар қазір қолда жоқ",
    cart_count_note: "\n\n🛒 Себетте қазір: {n} дана.",

    // ── курсы ──
    courses_title: "📚 <b>ДАЙЫН ЖИЫНТЫҚТАР</b>",
    courses_empty: "📚 <b>ДАЙЫН ЖИЫНТЫҚТАР</b>\n\nӘзірге қолжетімді курстар жоқ.",
    course_not_found: "❌ Курс табылмады немесе қолжетімсіз.",
    in_pack: "📦 <b>Құрамында:</b>",
    course_price: "💰 Курс бағасы: {price}",
    course_added: "✅ Курс себетке қосылды",

    // ── корзина ──
    cart_empty: "🛒 <b>СЕБЕТ</b>\n\nСіздің себетіңіз бос.",
    cart_title: "🛒 <b>СЕБЕТ</b>",
    cart_total: "💰 <b>Барлығы: {total}</b>",
    cart_hint: "Санын өзгерту үшін тауарды басыңыз.",
    item_not_found: "❌ Позиция табылмады.",
    item_price_subtotal: "💰 Бағасы: {price} × {qty} = <b>{subtotal}</b>",
    item_in_stock: "📦 Қолда бар: {n} дана",
    item_course_comp: "📦 Курс құрамы",
    item_qty: "Саны: <b>{qty}</b>",
    cart_cleared: "🧹 Себет тазартылды.",

    // ── заказы ──
    orders_empty: "📦 <b>МЕНІҢ ТАПСЫРЫСТАРЫМ</b>\n\nСізде әзірге тапсырыс жоқ.",
    orders_title: "📦 <b>МЕНІҢ ТАПСЫРЫСТАРЫМ</b>",
    orders_page: "📄 {a} / {b} бет • Барлығы: {n}",
    order_not_found: "❌ Тапсырыс табылмады.",
    order_denied: "❌ Тапсырыс табылмады немесе қолжетімділік шектелген.",
    order_title: "🧾 <b>ТАПСЫРЫС №{id}</b>",
    order_items: "🛍 <b>Тауарлар:</b>",
    order_total: "💰 <b>Сома: {total}</b>",
    order_address: "📍 <b>Мекенжай:</b> {addr}",
    order_postal: "🔢 <b>Индекс:</b> {code}",
    order_phone: "📞 <b>Телефон:</b> {phone}",
    order_status: "📦 <b>Мәртебе:</b> {status}",
    order_payment: "💳 <b>Төлем:</b> {payment}",
    link_check: "📎 Чек",
    status_pending_payment: "💤 Төлем күтілуде",
    status_pending_verification: "🕐 Тексеру күтілуде",
    status_paid: "✅ Төленді",
    status_processing: "🔵 Өңделуде",
    status_shipped: "🚚 Жөнелтілді",
    status_completed: "✅ Аяқталды",
    status_cancelled: "❌ Бас тартылды",
    payment_pending: "Төлем күтілуде",
    payment_pending_verification: "Тексеру күтілуде",
    payment_paid: "Төленді",
    payment_rejected: "Қабылданбады",

    // ── оформление ──
    pay_not_configured: "⚠️ Төлем реквизиттері орнатылмаған. Әкімшіге хабарласыңыз.",
    order_no: "🧾 <b>ТАПСЫРЫС №{id}</b>",
    pay_amount: "💰 Төлем: {total}",
    pay_requisites_title: "Төлем үшін мына реквизиттерді пайдаланыңыз:",
    pay_number: "📱 Нөмір:",
    pay_details: "💳 Реквизиттер:",
    attach_check: "⬇️ <b>Чекті тіркеңіз</b> немесе «Бас тарту» басыңыз.",
    session_expired: "❌ Рәсімдеу сессиясы аяқталды. Қайта бастаңыз.",
    send_receipt: "📎 <b>Төлем чегін</b> жіберіңіз (фото немесе құжат).\n\nӘкімші тексергеннен кейін тапсырыс өңделеді.",
    send_receipt_short: "📎 Төлем чегін жіберіңіз (фото немесе құжат).",
    enter_fio: "📝 <b>Аты-жөніңізді</b> енгізіңіз:",
    enter_fio_again: "📝 <b>Аты-жөніңізді</b> қайта енгізіңіз:",
    enter_region: "📍 <b>Облысыңызды/аймағыңызды</b> енгізіңіз:",
    enter_city: "🏙 <b>Қалаңызды</b> енгізіңіз:",
    enter_address: "🏠 <b>Мекенжайыңызды</b> енгізіңіз:",
    enter_postal: "🔢 <b>Пошта индексін</b> енгізіңіз:",
    enter_phone: "📞 <b>Телефон нөмірін</b> енгізіңіз:",
    field_fio: "Аты-жөні",
    field_region: "Облыс/аймақ",
    field_city: "Қала",
    fio_set: "📝 <b>Аты-жөні</b>: {v}",
    region_set: "📍 <b>Аймақ</b>: {v}",
    city_set: "🏙 <b>Қала</b>: {v}",
    address_set: "🏠 <b>Мекенжай</b>: {v}",
    postal_set: "🔢 <b>Индекс</b>: {v}",
    order_not_found_restart: "❌ Тапсырыс табылмады. Рәсімдеуді қайта бастаңыз.",
    check_order: "📦 <b>ТАПСЫРЫСТЫ ТЕКСЕРУ</b>",
    label_fio: "👤 <b>Аты-жөні</b>",
    label_region: "📍 <b>Аймақ</b>",
    label_city: "🏙 <b>Қала</b>",
    label_addr: "🏠 <b>Мекенжай</b>",
    label_postal: "🔢 <b>Индекс</b>",
    label_phone: "📞 <b>Телефон</b>",
    summary_items: "🛍 <b>Тауарлар:</b>",
    summary_sum: "💰 <b>Сома: {total}</b>",
    order_confirmed: "✅ <b>№{id} тапсырыс расталды.</b>\n\nЧек алынды, жеткізу деректері сақталды.\n\nТапсырыс тексеруге жіберілді.",
    data_saved_send_check: "✅ Деректер сақталды.\n\n📎 <b>Төлем чегін жіберіңіз.</b>\n\nӘкімші тексергеннен кейін тапсырыс өңделеді.",
    checkout_cancelled: "❌ Рәсімдеуден бас тартылды.",

    // ── чек ──
    receipt_order_not_found: "❌ Тапсырыс табылмады. Тапсырысты қайта рәсімдеңіз.",
    file_fail: "❌ Файлды алу мүмкін болмады. Қайта көріңіз.",
    file_tg_fail: "❌ Телеграмнан файл алу мүмкін болмады.",
    check_received_name: "✅ <b>Чек алынды.</b>\n\n№{id} тапсырыс броньдалды.\n\n📝 Енді жеткізу үшін <b>Аты-жөніңізді</b> енгізіңіз:",
    check_received: "✅ <b>Чек алынды.</b>\n\n№{id} тапсырысыңыз тексеруге жіберілді.",
    save_failed: "⚠️ Чекті сақтау мүмкін болмады. Кейінірек қайталаңыз.",

    // ── консультант ──
    assistant_client_active: "💬 <b>Кеңесші қосылды.</b>\n\nТауарлар, бағалар, қолда бар және құрам туралы сұрағыңызды жазыңыз.\n\nМәзірге қайту үшін төмендегі кез келген батырманы немесе «💬 Кеңесшіге сұрақ» түймесін қайта басыңыз.",
    assistant_stop: "💬 Кеңесші режимі өшірілді.",

    // ── ошибки ──
    err_PRODUCT_UNAVAILABLE: "❌ Тауар қолжетімсіз.",
    err_PRODUCT_NO_STOCK: "❌ Тауар қазір қолда жоқ.",
    err_PRODUCT_STOCK_LIMIT: "❌ Қоймада тауар жеткіліксіз.",
    err_COURSE_UNAVAILABLE: "❌ Курс қолжетімсіз.",
    err_COURSE_EMPTY: "❌ Курс бос, оған тауарлар қосыңыз.",
    err_COURSE_COMPONENT_UNAVAILABLE: "❌ Курс тауарларының бірі қолжетімсіз.",
    err_COURSE_COMPONENT_NO_STOCK: "❌ Курс құрамындағы тауарлар қоймада жеткіліксіз.",
    err_COURSE_STOCK_LIMIT: "❌ Курстың қажетті саны үшін тауар жеткіліксіз.",
    err_CART_EMPTY: "🛒 Себет бос.",
    err_CART_ITEM_NOT_FOUND: "❌ Себеттегі позиция табылмады.",
    err_ORDER_NOT_FOUND: "❌ Тапсырыс табылмады.",
    err_ALREADY_PAID: "✅ Бұл тапсырыс бойынша төлем расталған.",
    err_ORDER_CANCELLED: "❌ Тапсырыстан бас тартылды.",
    err_UPDATE_FAILED: "❌ Операция орындалмады. Қайта көріңіз.",
    err_STORAGE_NOT_CONFIGURED: "❌ Файл сақтау қоймасы орнатылмаған. Әкімшіге хабарласыңыз.",
    err_FILE_TOO_LARGE: "❌ Файл тым үлкен (максимум 10 МБ).",
    err_INVALID_MIME_TYPE: "❌ Файл түрі жарамсыз.",
    err_INVALID_EXTENSION: "❌ Файл кеңейтімі жарамсыз.",
    err_INVALID_FILE_TYPE: "❌ Файл түрі жарамсыз.",
    err_CATEGORY_HAS_PRODUCTS: "❌ Тауарлары бар категорияны жою мүмкін емес. Алдымен тауарларды жойыңыз.",
    err_PRODUCT_IN_COURSE: "❌ Дайын жиынтықтарға кіретін тауарды жою мүмкін емес. Алдымен оны жиынтықтардан алып тастаңыз.",
    err_PRODUCT_IN_ORDERS: "❌ Тапсырыстарда бар тауарды жою мүмкін емес.",
    err_COURSE_IN_ORDERS: "❌ Тапсырыстарда бар жиынтықты жою мүмкін емес.",
    err_NOT_ADMIN: "⛔ Қолжетімділік шектелген.",
    err_GENERIC: "⚠️ Бірдеңе дұрыс болмады. Қайта көріңіз.",

    // ── валидация ──
    phone_short: "Телефон нөмірі тым қысқа",
    phone_long: "Телефон нөмірі тым ұзын",
    phone_invalid: "Дұрыс телефон нөмірін енгізіңіз",
    name_short: "Аты тым қысқа",
    name_long: "Аты тым ұзын",
    addr_short: "Мекенжай тым қысқа",
    addr_long: "Мекенжай тым ұзын",
    postal_invalid: "Дұрыс пошта индексін енгізіңіз",
  },
};

export function langOf(value?: string | null): Lang {
  return value === "kk" ? "kk" : "ru";
}

export function t(
  lang: Lang | string | null | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  const l = langOf(lang);
  let str = DICT[l][key] ?? DICT.ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

/** Склонение «товар/товара/товаров» (ru) и «тауар» (kk). */
export function itemsWord(lang: Lang | string | null | undefined, n: number): string {
  if (langOf(lang) === "kk") return "тауар";
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "товар";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "товара";
  return "товаров";
}