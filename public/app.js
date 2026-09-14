/* MASSA TARAZ — Telegram Mini App (стиль Wildberries) */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) {
    return (Number(n) || 0).toLocaleString("ru-RU") + " ₸";
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var IMG_PH =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#eef0f6"/><text x="50%" y="47%" font-size="56" text-anchor="middle" fill="#b9bcc9" font-family="Arial" font-weight="bold">MT</text><text x="50%" y="60%" font-size="14" text-anchor="middle" fill="#b9bcc9" font-family="Arial">MASSA TARAZ</text></svg>'
    );

  function imgHTML(src, alt) {
    var s = src || "";
    var url = s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return (
      '<img src="' + url + '" onerror="this.onerror=null;this.src=\'' + IMG_PH + '\'" loading="lazy" alt="' + esc(alt || "") + '" />'
    );
  }

  var STATUS = {
    pending_payment: "Ожидает оплаты",
    pending_verification: "Ожидает проверки чека",
    paid: "Оплачен",
    processing: "В обработке",
    shipped: "Отправлен",
    completed: "Завершён",
    cancelled: "Отменён",
  };
  var PAY = {
    pending: "Ожидает оплаты",
    pending_verification: "Ожидает проверки",
    paid: "Оплачен",
    rejected: "Отклонён",
  };

  var S = {
    tg: null,
    initData: "",
    booted: false,
    user: null,
    isAdmin: false,
    profile: { fullName: "", region: "", city: "", postalCode: "", address: "", phone: "" },
    settings: null,
    screen: "main",
    prev: "main",
    catalog: { categories: [], products: [], courses: [] },
    courses: [],
    products: [],
    total: 0,
    search: "",
    catActive: null,
    cart: { items: [], total: 0, count: 0 },
    chat: [],
    aiBusy: false,
    orders: [],
    orderId: null,
    adminOrder: false,
    adminTab: "products",
    adminStatus: "all",
    adminOrders: [],
    stats: null,
    product: null,
    checkout: null,
    receiptPreview: null,
    prodForm: { id: null, imageUrl: "" },
    catForm: { id: null, imageUrl: "" },
    courForm: { id: null, imageUrl: "" },
    courId: null,
    success: null,
    searchTimer: null,
  };

  var TG = null;

  /* ────────── API ────────── */
  async function api(path, opts) {
    opts = opts || {};
    var res;
    try {
      res = await fetch(path, {
        method: opts.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": S.initData,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      throw { error: "Сеть недоступна. Проверьте соединение." };
    }
    var j;
    try {
      j = await res.json();
    } catch (e) {
      throw { error: "Ошибка сервера" };
    }
    if (res.status === 401 || (j && j.error === "AUTH_FAILED")) {
      showAuthError();
      throw j;
    }
    if (!j || !j.ok) throw j || { error: "Ошибка" };
    return j.data;
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () {
      t.hidden = true;
    }, 2400);
  }
  function haptic() {
    try {
      if (S.tg && S.tg.HapticFeedback) S.tg.HapticFeedback.impactOccurred("light");
    } catch (e) {}
  }

  function setBadge() {
    var n = S.cart.count || 0;
    var b = $("#cart-badge");
    if (n > 0) {
      $("#cart-badge-n").textContent = n > 99 ? "99+" : String(n);
      b.hidden = false;
    } else {
      b.hidden = true;
    }
  }

  /* ────────── Рендер ────────── */
  function syncTabs() {
    var map = { main: "main", cart: "cart", ai: "ai", profile: "profile" };
    var active = map[S.screen] || S.prev;
    $$("#tabbar .tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === active);
    });
    var appEl = $("#app");
    if (S.screen === "main" || S.screen === "cart" || S.screen === "ai" || S.screen === "profile") {
      appEl.classList.remove("screen-hide-tabbar");
    } else {
      appEl.classList.add("screen-hide-tabbar");
    }
  }

  function render() {
    var el = $("#app");
    switch (S.screen) {
      case "main":
        el.innerHTML = viewMain();
        afterMain();
        break;
      case "cart":
        el.innerHTML = viewCart();
        afterCart();
        break;
      case "ai":
        el.innerHTML = viewAi();
        afterAi();
        break;
      case "profile":
        el.innerHTML = viewProfile();
        break;
      case "orders":
        el.innerHTML = viewOrders();
        break;
      case "order":
        el.innerHTML = viewOrder();
        break;
      case "admin":
        el.innerHTML = viewAdmin();
        break;
      case "checkout":
        el.innerHTML = viewCheckout();
        afterCheckout();
        break;
      default:
        el.innerHTML = "<div class='boot'>…</div>";
    }
    syncTabs();
    tgBackButton();
    if (S.screen !== "ai") window.scrollTo(0, 0);
  }

  function go(screen) {
    S.prev = S.screen;
    S.screen = screen;
    render();
  }

  function tgBackButton() {
    try {
      if (!S.tg || !S.tg.BackButton) return;
      var sub =
        S.screen === "orders" ||
        S.screen === "order" ||
        S.screen === "admin" ||
        S.screen === "checkout";
      if (sub) {
        S.tg.BackButton.show();
        S.tg.BackButton.onClick(function () {
          h("nav:back", {});
        });
      } else {
        S.tg.BackButton.hide();
      }
    } catch (e) {}
  }

  /* ────────── Карточки ────────── */
  function inCart(type, id) {
    var it = S.cart.items.find(function (i) { return i.type === type && i.id === id; });
    return it ? it.quantity : 0;
  }
  function stepperHTML(ac, type, id, qty, min, max) {
    return (
      '<div class="stepper ' + (ac === "ct" ? "sm" : "") + '">' +
      '<button data-act="' + ac + ':dec" data-type="' + type + '" data-id="' + id + '">−</button>' +
      "<b>" + qty + "</b>" +
      '<button data-act="' + ac + ':inc" data-type="' + type + '" data-id="' + id + '"' + (max != null && qty >= max ? " disabled" : "") + ">+</button>" +
      "</div>"
    );
  }
  function cardHTML(p) {
    var q = inCart("product", p.id);
    var pill = "";
    if (p.stock <= 0) pill = '<span class="stk no">Нет в наличии</span>';
    else if (p.stock <= 5) pill = '<span class="stk low">Осталось ' + p.stock + "</span>";
    return (
      '<div class="card">' +
      '<div class="ph">' + imgHTML(p.imageUrl, p.name) + pill + "</div>" +
      '<div class="bd">' +
      '<div class="nm" data-act="prod:open" data-id="' + p.id + '">' + esc(p.name) + "</div>" +
      '<div class="pr">' + fmt(p.price) + "</div>" +
      '<div class="act">' +
      (q > 0
        ? stepperHTML("prod", "product", p.id, q, null, p.stock)
        : '<button class="btn-add pink" data-act="cart:add" data-type="product" data-id="' + p.id + '"' + (p.stock <= 0 ? " disabled" : "") + ">В корзину</button>") +
      "</div></div></div>"
    );
  }

  /* ────────── Главная ────────── */
  function viewMain() {
    var cats = S.catalog.categories || [];
    var chips =
      '<div class="chip' + (S.catActive == null ? " active" : "") + '" data-act="cat:sel" data-id="">Все</div>' +
      cats
        .map(function (c) {
          return (
            '<div class="chip' + (S.catActive == c.id ? " active" : "") + '" data-act="cat:sel" data-id="' + c.id + '">' +
            esc(c.name) +
            '<span class="cnt">' + (c.count || 0) + "</span></div>"
          );
        })
        .join("");

    var roll = "";
    if (S.courses && S.courses.length) {
      roll =
        '<div class="sec-h"><h3>Готовые связки</h3><span></span></div>' +
        '<div class="roll">' +
        S.courses
          .map(function (c) {
            return (
              '<div class="roll-card" data-act="course:open" data-id="' + c.id + '">' +
              '<div class="ph">' + imgHTML(c.imageUrl, c.name) + "</div>" +
              '<div class="bd"><div class="nm">' + esc(c.name) + "</div>" +
              "<div class='pr'>" + fmt(c.price) + "</div>" +
              '<button class="btn-add pink" data-act="cart:add" data-type="course" data-id="' + c.id + '">В корзину</button>' +
              "</div></div>"
            );
          })
          .join("") +
        "</div>";
    }

    var grid;
    if (!S.products.length) {
      grid = '<div class="empty"><div class="big">🔍</div>' + (S.search ? "Ничего не найдено" : "Каталог пуст") + "</div>";
    } else {
      grid = '<div class="grid">' + S.products.map(cardHTML).join("") + "</div>";
      if (S.products.length < S.total) {
        grid +=
          '<div class="app-pad"><button class="btn-add" data-act="prod:more">Показать ещё (' + (S.total - S.products.length) + ")</button></div>";
      }
    }

    return (
      '<div class="search"><span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span>' +
      '<input id="search-txt" type="text" placeholder="Поиск в каталоге" value="' + esc(S.search) + '" autocomplete="off" />' +
      "</div>" +
      '<div class="chips">' + chips + "</div>" +
      (S.catActive != null || S.search
        ? '<div class="sec-h"><h3>' + (S.search ? "Результаты поиска" : "Категория") + "</h3><span class='hint'>" + S.total + "</span></div>"
        : '<div class="sec-h"><h3>' + (S.catalog.courses && S.catalog.courses.length ? "Новинки" : "Каталог") + "</h3></div>") +
      roll +
      (S.catActive != null || S.search ? "" : '<div class="sec-h"></div>') +
      grid
    );
  }

  function afterMain() {
    var inp = $("#search-txt");
    if (inp) {
      inp.addEventListener("input", function () {
        S.search = this.value;
        setBadge();
        clearTimeout(S.searchTimer);
        S.searchTimer = setTimeout(function () {
          loadProducts({ cat: S.catActive, q: S.search });
        }, 400);
      });
    }
  }

  /* ────────── Корзина ────────── */
  function viewCart() {
    var items = S.cart.items || [];
    if (!items.length) {
      return (
        '<div class="empty"><div class="big">🛒</div>Корзина пуста<br /><br />' +
        '<button class="btn-primary" data-act="nav:tab" data-tab="main">Перейти в каталог</button>' +
        "</div>"
      );
    }
    var list = items
      .map(function (i) {
        return (
          '<div class="cart-item"><div class="th">' + imgHTML(i.imageUrl, i.name) + "</div>" +
          '<div class="info"><div class="nm">' + esc(i.name) + "</div>" +
          '<div class="uprice">' + fmt(i.price) + " /шт</div>" +
          '<div class="btm">' +
          stepperHTML("ct", i.type, i.id, i.quantity, null, i.stockMax) +
          '<span class="sum">' + fmt(i.subtotal) + '</span></div></div>' +
          '<button class="rm" data-act="ct:rm" data-id="' + i.cartItemId + '" title="Удалить">✕</button>' +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="sec-h"><h3>Корзина · ' + items.length + "</h3>" +
      '<button style="font-size:13px;color:var(--text2)" data-act="cart:clear">Очистить</button></div>' +
      '<div class="cart-list">' + list + "</div>" +
      '<div class="total-bar"><div><div class="tt">Итого</div><div class="sum">' + fmt(S.cart.total) + "</div></div>" +
      '<button class="btn-primary" data-act="check:start">К оформлению</button></div>'
    );
  }
  function afterCart() {}

  /* ────────── ИИ ────────── */
  function viewAi() {
    var msgs = S.chat;
    var html = msgs
      .map(function (m) {
        return m.typing
          ? '<div class="bubble ai typing">…</div>'
          : '<div class="bubble ' + m.role + '">' + esc(m.text) + "</div>";
      })
      .join("");
    if (!html) {
      html =
        '<div class="bubble ai">Привет! Я ИИ-консультант <b>MASSA TARAZ</b>. Спросите про товары, наличие, связки или состав — отвечу по актуальному каталогу.</div>';
    }
    if (!(S.settings && S.settings.aiEnabled)) {
      html =
        '<div class="bubble ai">ИИ-консультант пока не подключён. Напишите нам в поддержку: <b>@massataraz08</b></div>';
    }
    return (
      '<div class="ai-chat">' +
      '<div class="ai-msgs" id="ai-msgs">' + html + "</div>" +
      '<div class="ai-input">' +
      '<input id="ai-txt" type="text" placeholder="Ваш вопрос…" autocomplete="off"' + (S.aiBusy ? " disabled" : "") + " />" +
      '<button id="ai-send" data-act="ai:send"' + (S.aiBusy ? " disabled" : "") + ">" +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>' +
      "</button></div></div>"
    );
  }
  function afterAi() {
    var msgs = $("#ai-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    var inp = $("#ai-txt");
    if (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") sendAi(this.value);
      });
    }
  }

  /* ────────── Профиль ────────── */
  function viewProfile() {
    var u = S.user || { firstName: "?", username: "" };
    var ini = (u.firstName || "MT").trim().charAt(0).toUpperCase();
    var menu =
      '<button class="menu-item" data-act="ord:list"><span class="ico">📦</span>Мои заказы<span class="arrow">›</span></button>' +
      '<button class="menu-item" data-act="sett:open"><span class="ico">⚙️</span>Настройки<span class="arrow">›</span></button>' +
      '<button class="menu-item" data-act="deliv:open"><span class="ico">📍</span>Данные доставки<span class="arrow">›</span></button>' +
      '<button class="menu-item" data-act="about:open"><span class="ico">💬</span>О магазине<span class="arrow">›</span></button>';
    if (S.isAdmin) {
      menu += '<button class="menu-item admin" data-act="admin:open"><span class="ico">⚙️</span>Админ-панель<span class="arrow">›</span></button>';
    }
    return (
      '<div class="prof-card"><div class="avatar">' + ini + "</div>" +
      "<div><div class='nm'>" + esc(u.firstName || "MASSA TARAZ") + "</div>" +
      "<div class='id'>" + (u.username ? "@" + esc(u.username) : "id " + esc(u.telegramId)) + "</div></div></div>" +
      '<div class="menu">' + menu + "</div>" +
      "<div class='hint' style='text-align:center;margin-top:14px'>MASSA TARAZ · магазин спортивного питания</div>"
    );
  }

  /* ────────── Заказы ────────── */
  function viewOrders() {
    if (!S.orders.length) {
      return (
        '<div class="page-h"><button class="btn-back" data-act="nav:back">‹</button><h2>Мои заказы</h2></div>' +
        '<div class="empty"><div class="big">📦</div>Заказов пока нет</div>'
      );
    }
    var list = S.orders
      .map(function (o) {
        var cnt = o.items.reduce(function (s, i) { return s + i.quantity; }, 0);
        return (
          '<div class="order-card" data-act="ord:open" data-id="' + o.id + '">' +
          '<div class="o-top"><span>Заказ №' + o.id + "</span><span>" + fmt(o.total) + "</span></div>" +
          '<div class="o-date">' + esc(fmtDate(o.createdAt)) + " · " + cnt + " шт.</div>" +
          '<span class="o-status st-' + o.status + '">' + esc(o.statusLabel) + "</span>" +
          (o.trackNumber ? '<div class="track-num" style="margin-top:8px;font-size:12.5px">📦 ' + esc(o.trackNumber) + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="page-h"><button class="btn-back" data-act="nav:back">‹</button><h2>Мои заказы</h2></div>' +
      '<div style="height:8px"></div>' + list
    );
  }

  function viewOrder() {
    var d = S.orderData;
    if (!d) return '<div class="boot">Загрузка…</div>';
    var o = d.order;
    var back = S.adminOrder ? "admin:open" : "nav:back";
    var title = S.adminOrder ? "Заказ №" + o.id : "Заказ №" + o.id;

    var items = (o.items || [])
      .map(function (i) {
        return "<div class='row'><div class='inf'><div class='nm'>" + esc(i.productName) +
          "</div><div class='sub'>" + i.quantity + " × " + fmt(i.price) + "</div></div><b>" + fmt(i.subtotal) + "</b></div>";
      })
      .join("");

    var track = "";
    if (d.tracking) {
      var t = d.tracking;
      var evs = (t.events || [])
        .map(function (e, idx) {
          return (
            "<div class='ev" + (idx === 0 ? " first" : "") + "'>" +
            "<div class='d'>" + esc(e.description || "…") + "</div>" +
            "<div class='t'>" + esc(e.location || "") + (e.time ? " · " + esc(e.time.slice(0, 10)) : "") + "</div>" +
            "</div>"
          );
        })
        .join("");
      track =
        '<div class="track-box"><div class="t-title">📦 Отслеживание посылки</div>' +
        '<div class="track-num">' + esc(t.trackingNumber) + "</div>" +
        '<div style="margin:6px 0 10px;font-size:13px">' + esc(t.statusDescription || (t.events.length ? "" : "Трек зарегистрирован. Статусы появятся автоматически.")) + "</div>" +
        (evs ? '<div class="tl">' + evs + "</div>" : "") +
        '<a class="link-btn" target="_blank" rel="noopener" href="' + esc(t.link) + '">Открыть на 17track</a>' +
        "</div>";
    }

    var adm = "";
    if (S.adminOrder) {
      var stBtns = ["pending_payment", "pending_verification", "paid", "processing", "shipped", "completed", "cancelled"]
        .map(function (st) {
          var active = o.status === st ? " active" : "";
          return '<button class="chip' + active + '" data-act="aorder:status" data-st="' + st + '">' + esc(STATUS[st] || st) + "</button>";
        })
        .join("");
      var pay =
        o.paymentStatus !== "paid"
          ? '<div class="track-box"><div class="t-title">💳 Оплата</div>' +
            '<button class="btn-add pink" data-act="aorder:pay" data-act2="confirm">Подтвердить оплату</button>' +
            '<div style="height:8px"></div>' +
            '<button class="btn-add" data-act="aorder:pay" data-act2="reject">Отклонить (указать причину)</button></div>'
          : "";
      adm =
        "<div style='height:8px'></div>" +
        pay +
        '<div class="track-box"><div class="t-title">🔄 Статус заказа</div>' +
        '<div class="chips" style="flex-wrap:wrap">' + stBtns + "</div>" +
        (o.status === "shipped"
          ? '<div style="height:10px"></div>' +
            '<div class="field"><label>Трек-номер посылки</label><input id="aorder-track" value="' + esc(o.trackNumber || "") + '" placeholder="Введите трек-номер СДЭК" /></div>' +
            '<button class="btn-add" data-act="aorder:track-save">Сохранить трек-номер</button>'
          : "") +
        '<div style="height:10px"></div>' +
        '<div class="field"><label>Данные клиента</label><div style="font-size:13px">' + esc(o.fullName || "-") + "<br />" + esc([o.region, o.city, o.address].filter(Boolean).join(", ") || "-") + "<br />тел: " + esc(o.phone || "-") + "</div></div>" +
        "</div>";
    }

    return (
      '<div class="page-h"><button class="btn-back" data-act="' + back + '">‹</button><h2>' + esc(title) + "</h2></div>" +
      '<div class="order-card"><div class="o-top"><span>№' + o.id + "</span><span>" + fmt(o.total) + "</span></div>" +
      '<div class="o-date">' + esc(fmtDate(o.createdAt)) + "</div>" +
      '<span class="o-status st-' + o.status + '">' + esc(o.statusLabel) + "</span>" +
      '<div style="margin-top:6px;font-size:12.5px;color:var(--text2)">Оплата: ' + esc(o.paymentLabel) + "</div></div>" +
      track + adm +
      '<div style="height:8px"></div>' + items +
      '<div class="app-pad">' +
      (S.adminOrder
        ? '<button class="btn-ghost" style="width:100%" data-act="admin:orders">К списку заказов</button>'
        : '<button class="btn-ghost" style="width:100%" data-act="ord:list">Все заказы</button>') +
      "</div>"
    );
  }

  /* ────────── Оформление ────────── */
  function viewCheckout() {
    var c = S.checkout;
    if (!c) return '<div class="boot">…</div>';
    var prof = c.profile || {};
    var reqs = "";
    if (c.paymentPhone) reqs += "<div>Перевод на номер:<br /><b>" + esc(c.paymentPhone) + "</b></div>";
    if (c.paymentDetails) reqs += "<div style='margin-top:6px'>Реквизиты:<br /><b>" + esc(c.paymentDetails) + "</b></div>";
    var chq = S.receiptPreview
      ? '<div class="cheque-box">Чек прикреплён ✓<br />' + imgHTML(S.receiptPreview, "чек") + "</div>"
      : '<div class="cheque-box" id="chq" data-act="chq:pick">📎 Прикрепить чек об оплате после перевода</div>';
    return (
      '<div class="page-h"><button class="btn-back" data-act="nav:back">‹</button><h2>Оформление заказа №' + c.orderId + "</h2></div>" +
      '<div style="height:8px"></div>' +
      '<div class="pay-card"><div class="lbl">К оплате</div><div class="amt">' + fmt(c.total) + "</div>" +
      '<div class="reqs">' + reqs + "</div></div>" +
      chq +
      '<div class="sec-h"><h3>Доставка</h3></div>' +
      '<div class="app-pad">' +
      field("fullName", "ФИО получателя", prof.fullName || "", true) +
      '<div class="grid" style="grid-template-columns:1fr 1fr;padding:0">' +
      field("region", "Регион", prof.region || "", true) +
      field("city", "Город", prof.city || "", true) +
      "</div>" +
      field("postalCode", "Индекс", prof.postalCode || "", false) +
      field("address", "Адрес (улица, дом, квартира)", prof.address || "", true) +
      field("phone", "Телефон", prof.phone || "", true) +
      "</div>" +
      '<div class="app-pad"><button class="btn-primary btn-big" data-act="check:submit">Я оплатил, подтвердить заказ</button></div>'
    );
  }
  function afterCheckout() {}
  function field(name, label, val, req) {
    return (
      '<div class="field"><label>' +
      esc(label) +
      (req ? ' <span class="req">*</span>' : "") +
      '</label><input id="f-' + name + '" value="' + esc(val || "") + '" autocomplete="off" /></div>'
    );
  }

  /* ────────── Админка ────────── */
  function viewAdmin() {
    var tabs =
      '<div class="admin-tabs">' +
      ["products", "courses", "categories", "orders", "stats"]
        .map(function (t) {
          var l = { products: "Товары", courses: "Связки", categories: "Категории", orders: "Заказы", stats: "Статистика" }[t];
          return '<button class="chip' + (S.adminTab === t ? " active" : "") + '" data-act="admin:tab" data-tab="' + t + '">' + l + "</button>";
        })
        .join("") +
      "</div>";
    var body = "";
    var prefix = "";
    if (S.adminTab === "products") {
      prefix =
        '<div class="app-pad"><button class="btn-primary" data-act="prod:new">＋ Добавить товар</button></div>' +
        '<div style="height:6px"></div>';
      body = (S.prods || [])
        .map(function (p) {
          return (
            '<div class="row"><div class="th">' + imgHTML(p.imageUrl, p.name) + "</div>" +
            '<div class="inf"><div class="nm">' + esc(p.name) + "</div>" +
            "<div class='sub'>" + fmt(p.price) + " · остаток " + p.stock + (p.isActive ? "" : " · скрыт") + "</div></div>" +
            '<div class="acts">' +
            '<button class="icon-btn' + (p.isActive ? "" : " off") + '" data-act="prod:tgl" data-id="' + p.id + '" title="Вкл/выкл">👁</button>' +
            '<button class="icon-btn" data-act="prod:edit" data-id="' + p.id + '">✏️</button>' +
            '<button class="icon-btn" data-act="prod:del" data-id="' + p.id + '">🗑</button>' +
            "</div></div>"
          );
        })
        .join("") || '<div class="empty">Товаров нет</div>';
    } else if (S.adminTab === "courses") {
      prefix =
        '<div class="app-pad"><button class="btn-primary" data-act="cour:new">＋ Добавить связку</button></div><div style="height:6px"></div>';
      body = (S.courses || [])
        .map(function (c) {
          return (
            '<div class="row"><div class="th">' + imgHTML(c.imageUrl, c.name) + "</div>" +
            '<div class="inf"><div class="nm">' + esc(c.name) + "</div>" +
            "<div class='sub'>" + fmt(c.price) + " · товаров: " + (c.itemsCount || 0) + (c.isActive ? "" : " · скрыт") + "</div></div>" +
            '<div class="acts">' +
            '<button class="icon-btn" data-act="cour:items" data-id="' + c.id + '">📦</button>' +
            '<button class="icon-btn' + (c.isActive ? "" : " off") + '" data-act="cour:tgl" data-id="' + c.id + '">👁</button>' +
            '<button class="icon-btn" data-act="cour:edit" data-id="' + c.id + '">✏️</button>' +
            '<button class="icon-btn" data-act="cour:del" data-id="' + c.id + '">🗑</button>' +
            "</div></div>"
          );
        })
        .join("") || '<div class="empty">Связок нет</div>';
    } else if (S.adminTab === "categories") {
      prefix =
        '<div class="app-pad"><button class="btn-primary" data-act="cat:new">＋ Добавить категорию</button></div><div style="height:6px"></div>';
      body = (S.cats || [])
        .map(function (c) {
          return (
            '<div class="row"><div class="th">' + imgHTML(c.imageUrl, c.name) + "</div>" +
            '<div class="inf"><div class="nm">' + esc(c.name) + "</div>" +
            "<div class='sub'>" + (c.count || 0) + " товаров" + (c.isActive ? "" : " · скрыта") + "</div></div>" +
            '<div class="acts">' +
            '<button class="icon-btn' + (c.isActive ? "" : " off") + '" data-act="cat:tgl" data-id="' + c.id + '">👁</button>' +
            '<button class="icon-btn" data-act="cat:edit" data-id="' + c.id + '">✏️</button>' +
            '<button class="icon-btn" data-act="cat:del" data-id="' + c.id + '">🗑</button>' +
            "</div></div>"
          );
        })
        .join("") || '<div class="empty">Категорий нет</div>';
    } else if (S.adminTab === "orders") {
      var filters = ["all", "pending_verification", "processing", "shipped", "completed", "cancelled", "paid", "pending_payment"];
      prefix =
        '<div class="filter-chips">' +
        filters
          .map(function (f) {
            var l = { all: "Все", pending_verification: "Чеки", processing: "В обработке", shipped: "Отправлены", completed: "Завершённые", cancelled: "Отменённые", paid: "Оплаченные", pending_payment: "Без оплаты" }[f];
            return '<button class="chip' + (S.adminStatus === f ? " active" : "") + '" data-act="aorders:filter" data-f="' + f + '">' + l + "</button>";
          })
          .join("") +
        "</div>";
      body = (S.adminOrders || [])
        .map(function (o) {
          return (
            '<div class="order-card" data-act="aorder:open" data-id="' + o.id + '">' +
            '<div class="o-top"><span>№' + o.id + ' · ' + esc(o.fullName || "-") + "</span><span>" + fmt(o.total) + "</span></div>" +
            '<div class="o-date">' + esc(fmtDate(o.createdAt)) + " · " + rowsCount(o) + " поз.</div>" +
            '<span class="o-status st-' + o.status + '">' + esc(o.statusLabel) + "</span>" +
            (o.trackNumber ? "<div class='track-num' style='margin-top:6px;font-size:12px'>📦 " + esc(o.trackNumber) + "</div>" : "") +
            "</div>"
          );
        })
        .join("") || '<div class="empty">Заказов нет</div>';
    } else {
      var st = S.stats || {};
      var cts = S.counts || {};
      var low = (st.lowStockProducts || [])
        .map(function (p) {
          return "<div class='it'><span>" + esc(p.name) + "</span><b>" + p.stock + " шт</b></div>";
        })
        .join("");
      var top = (st.topProducts || [])
        .slice(0, 5)
        .map(function (p) {
          return "<div class='it'><span>" + esc(p.name) + "</span><b>" + p.quantity + "</b></div>";
        })
        .join("");
      body =
        '<div class="stat-grid">' +
        statCard(st.usersCount, "Клиентов") +
        statCard(st.ordersCount, "Заказов всего") +
        statCard(fmt(Math.round(st.totalSales || 0)), "Продажи") +
        statCard(st.activeProductsCount, "Активных товаров") +
        statCard(cts.pendingVerification || 0, "Чеки на проверке") +
        statCard(st.lowStockProductsCount || 0, "Заканчиваются") +
        "</div>" +
        (top ? '<div class="stat-list"><div class="t-title" style="padding:8px 2px 2px;font-weight:800">Топ товаров</div>' + top + "</div>" : "") +
        (low ? '<div class="stat-list"><div class="t-title" style="padding:8px 2px 2px;font-weight:800">Мало на складе</div>' + low + "</div>" : "");
    }
    return (
      '<div class="page-h"><button class="btn-back" data-act="nav:back">‹</button><h2>Админ-панель</h2></div>' +
      tabs + prefix + "<div style='height:6px'></div>" + body
    );
  }
  function rowsCount(o) {
    return (o.items || []).reduce(function (s, i) { return s + i.quantity; }, 0);
  }
  function statCard(v, l) {
    return '<div class="stat-card"><div class="v">' + v + "</div><div class='l'>" + l + "</div></div>";
  }

  /* ────────── Модалы ────────── */
  function modal(title, inner, onClose) {
    var m = document.createElement("div");
    m.className = "modal";
    m.innerHTML =
      '<div class="m-card"><div class="m-h"><h4>' + esc(title) + "</h4>" +
      '<button class="icon-btn" data-act="modal:close">✕</button></div>' + inner + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (e) {
      if (e.target === m) closeModal();
    });
    modalStack._last = m;
    return m;
  }
  var modalStack = [];
  function closeModal() {
    var last = modalStack._last;
    if (last) {
      last.remove();
      modalStack._last = null;
    }
  }
  function mField(name, label, val, ph) {
    return (
      '<div class="field"><label>' + esc(label) + '</label><input id="' + name + '" value="' + esc(val || "") + '" placeholder="' + esc(ph || "") + '" autocomplete="off" /></div>'
    );
  }
  function uploadBox(id, img, previewId) {
    return (
      '<div class="img-upload" data-act="upload:pick" data-target="' + id + '">' +
      '<span id="' + previewId + '">' + (img ? imgHTML(img, "image") : "📷 Загрузить фото") + "</span></div>"
    );
  }

  /* ────────── Данные ────────── */
  async function loadCatalog() {
    var d = await api("/api/app/catalog");
    S.catalog.categories = d.categories;
    S.products = d.products;
    S.total = d.products.length;
    S.catalog.courses = d.courses;
    S.cart = d.cart;
    setBadge();
    try {
      var cc = await api("/api/app/courses");
      S.courses = cc.courses;
      S.catalog.courses = S.courses;
    } catch (e) {}
  }
  async function loadProducts(opts) {
    opts = opts || {};
    var qp = new URLSearchParams();
    if (opts.cat != null && opts.cat !== "" && opts.cat !== "null") qp.set("categoryId", opts.cat);
    if (opts.q) qp.set("q", opts.q);
    qp.set("page", opts.page || 0);
    qp.set("pageSize", 30);
    var d = await api("/api/app/products?" + qp.toString());
    S.products = opts.page ? S.products.concat(d.products) : d.products;
    S.total = d.total;
    S.cart = d.cart;
    setBadge();
    render();
  }
  async function loadCart() {
    S.cart = await api("/api/app/cart");
    S.cart.count = S.cart.count || 0;
    setBadge();
  }
  async function loadOrders() {
    S.orders = (await api("/api/app/orders")).orders;
  }
  async function loadOrder() {
    S.orderData = await api("/api/app/orders/" + S.orderId);
  }

  /* ────────── Обработчики ────────── */
  function h(act, args, ev) {
    var parts = act.split(":");
    var a = parts[0];
    var b = parts[1];
    switch (a) {
      case "nav":
        if (b === "tab") {
          haptic();
          S.screen = args.tab;
          render();
          refreshTab(args.tab);
        } else if (b === "back") {
          S.screen = S.prev || "main";
          render();
        }
        break;
      case "prod":
        if (b === "open") openProduct(args.id);
        else if (b === "inc") cartInc("product", args.id);
        else if (b === "dec") cartDec("product", args.id);
        else if (b === "more") loadProducts({ cat: S.catActive, q: S.search, page: Math.floor(S.products.length / 30) });
        else if (b === "new") openProdForm(null);
        else if (b === "edit") openProdForm(args.id);
        else if (b === "del") prodDel(args.id);
        else if (b === "tgl") prodTgl(args.id);
        break;
      case "cat":
        if (b === "sel") {
          haptic();
          S.catActive = args.id ? Number(args.id) : null;
          S.search = "";
          loadProducts({ cat: S.catActive, q: "" });
        } else if (b === "new") openCatForm(null);
        else if (b === "edit") openCatForm(args.id);
        else if (b === "del") catDel(args.id);
        else if (b === "tgl") catTgl(args.id);
        break;
      case "course":
        if (b === "open") openCourse(args.id);
        break;
      case "cart":
        if (b === "add") cartAdd(args.type, args.id);
        else if (b === "clear") cartClear();
        break;
      case "ct":
        if (b === "inc") ctInc(args.id);
        else if (b === "dec") ctDec(args.id);
        else if (b === "rm") ctRm(args.id);
        break;
      case "check":
        if (b === "start") startCheckout();
        else if (b === "submit") submitCheckout();
        break;
      case "chq":
        if (b === "pick") pickReceipt();
        break;
      case "ai":
        if (b === "send") {
          var inp = $("#ai-txt");
          sendAi(inp ? inp.value : "");
        }
        break;
      case "ord":
        if (b === "list") {
          go("orders");
          loadOrders().then(render);
        } else if (b === "open") {
          S.orderId = Number(args.id);
          S.adminOrder = false;
          go("order");
          loadOrder().then(render);
        }
        break;
      case "sett":
        if (b === "open") openSettings();
        break;
      case "deliv":
        if (b === "open") openDelivery();
        break;
      case "about":
        if (b === "open") openAbout();
        break;
      case "admin":
        if (b === "open") {
          S.adminOrder = false;
          go("admin");
          loadAdminProducts();
        } else if (b === "tab") {
          S.adminTab = args.tab;
          render();
          if (args.tab === "products") loadAdminProducts();
          else if (args.tab === "courses") loadAdminCourses();
          else if (args.tab === "categories") loadAdminCats();
          else if (args.tab === "orders") loadAdminOrders();
          else if (args.tab === "stats") loadStats();
        } else if (b === "orders") {
          S.adminTab = "orders";
          go("admin");
          loadAdminOrders();
        }
        break;
      case "aorder":
        if (b === "open") {
          S.orderId = Number(args.id);
          S.adminOrder = true;
          go("order");
          loadOrder().then(function () { render(); });
        } else if (b === "status") aorderStatus(args.st);
        else if (b === "track-save") aorderSaveTrack();
        else if (b === "pay") aorderPay(args.act2);
        break;
      case "aorders":
        if (b === "filter") {
          S.adminStatus = args.f;
          loadAdminOrders();
        }
        break;
      case "modal":
        if (b === "close") closeModal();
        break;
      case "upload":
        if (b === "pick") pickUpload(args.target);
        break;
      case "prodform":
        if (b === "save") saveProdForm();
        break;
      case "catform":
        if (b === "save") saveCatForm();
        break;
      case "courform":
        if (b === "save") saveCourForm();
        break;
      case "cour":
        if (b === "new") openCourForm(null);
        else if (b === "edit") openCourForm(args.id);
        else if (b === "del") courDel(args.id);
        else if (b === "tgl") courTgl(args.id);
        else if (b === "items") openCourItems(args.id);
        break;
      case "couritem":
        if (b === "add") addCourItem();
        else if (b === "rm") rmCourItem(args.pid);
        break;
      default:
        break;
    }
  }

  /* ────────── Экшены ────────── */
  function refreshTab(tab) {
    if (tab === "main") loadCatalog().then(render);
    else if (tab === "cart") loadCart().then(render);
    else if (tab === "ai") { /* nothing heavy */ }
    else if (tab === "profile") { /* fresh enough */ }
  }

  async function openProduct(id) {
    try {
      var d = await api("/api/app/products/" + id);
      S.product = d.product;
      S.cart = d.cart;
      setBadge();
    } catch (e) {
      return toast(e.error || "Ошибка");
    }
    var p = S.product;
    var q = inCart("product", p.id);
    var ov = $("#overlay");
    ov.innerHTML =
      '<div class="o-close" data-act="prod:close">✕</div>' +
      '<div class="o-ph">' + imgHTML(p.imageUrl, p.name) + "</div>" +
      '<div class="o-bd">' +
      '<div class="o-cat">' + esc(p.categoryName || "") + "</div>" +
      '<div class="o-nm">' + esc(p.name) + "</div>" +
      '<div class="o-pr">' + fmt(p.price) + "</div>" +
      '<div class="o-desc">' + esc(p.description || "") + "</div>" +
      '<div class="o-actions">' +
      (q > 0
        ? stepperHTML("prod", "product", p.id, q, null, p.stock)
        : '<button class="btn-add pink" style="flex:1" data-act="cart:add" data-type="product" data-id="' + p.id + '"' + (p.stock <= 0 ? " disabled" : "") + ">В корзину</button>") +
      "</div></div>";
    ov.hidden = false;
    tgOverlayBack();
  }

  async function openCourse(id) {
    try {
      var d = await api("/api/app/courses/" + id);
      var c = d.course;
      S.cart = d.cart;
      setBadge();
      var ov = $("#overlay");
      var items = (c.items || [])
        .map(function (i) {
          return (
            "<div class='row'><div class='th'>" + imgHTML(i.product.imageUrl, i.product.name) + "</div>" +
            "<div class='inf'><div class='nm'>" + esc(i.product.name) + "</div>" +
            "<div class='sub'>× " + i.quantity + "</div></div></div>"
          );
        })
        .join("");
      ov.innerHTML =
        '<div class="o-close" data-act="prod:close">✕</div>' +
        '<div class="o-ph">' + imgHTML(c.imageUrl, c.name) + "</div>" +
        '<div class="o-bd">' +
        '<div class="o-cat">Готовые связки</div>' +
        '<div class="o-nm">' + esc(c.name) + "</div>" +
        '<div class="o-pr">' + fmt(c.price) + "</div>" +
        '<div class="o-desc">' + esc(c.description || "") + "</div>" +
        items +
        '<div class="o-actions">' +
        '<button class="btn-add pink" style="flex:1" data-act="cart:add" data-type="course" data-id="' + c.id + '">В корзину</button>' +
        "</div></div>";
      ov.hidden = false;
      tgOverlayBack();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }

  function closeOverlay() {
    $("#overlay").hidden = true;
    S.product = null;
  }
  function tgOverlayBack() {
    try {
      if (S.tg && S.tg.BackButton) {
        S.tg.BackButton.show();
        S.tg.BackButton.onClick(function () { closeOverlay(); });
      }
    } catch (e) {}
  }

  async function cartAdd(type, id) {
    haptic();
    try {
      S.cart = await api("/api/app/cart/add", { method: "POST", body: { type: type, id: Number(id), quantity: 1 } });
      setBadge();
      toast("Добавлено в корзину ✓");
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function cartInc(type, id) {
    try {
      S.cart = await api("/api/app/cart/add", { method: "POST", body: { type: type, id: Number(id), quantity: 1 } });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function cartDec(type, id) {
    try {
      var it = S.cart.items.find(function (i) { return i.type === type && i.id === Number(id); });
      if (!it) return;
      S.cart = await api("/api/app/cart/update", { method: "POST", body: { itemId: it.cartItemId, delta: -1 } });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function ctInc(id) {
    try {
      S.cart = await api("/api/app/cart/update", { method: "POST", body: { itemId: Number(id), delta: 1 } });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function ctDec(id) {
    try {
      S.cart = await api("/api/app/cart/update", { method: "POST", body: { itemId: Number(id), delta: -1 } });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function ctRm(id) {
    try {
      S.cart = await api("/api/app/cart/remove", { method: "POST", body: { itemId: Number(id) } });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function cartClear() {
    if (!confirm("Очистить корзину?")) return;
    try {
      S.cart = await api("/api/app/cart/clear", { method: "POST" });
      setBadge();
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }

  async function startCheckout() {
    haptic();
    try {
      S.checkout = await api("/api/app/checkout/create", { method: "POST" });
      S.receiptPreview = null;
      go("checkout");
    } catch (e) {
      toast(e.error || "Невозможно оформить заказ");
    }
  }

  function getField(name) {
    var el = $("#f-" + name);
    return el ? el.value.trim() : "";
  }
  async function submitCheckout() {
    var c = S.checkout;
    if (!c) return;
    var body = {
      orderId: c.orderId,
      fullName: getField("fullName"),
      region: getField("region"),
      city: getField("city"),
      postalCode: getField("postalCode"),
      address: getField("address"),
      phone: getField("phone"),
    };
    if (!body.fullName || !body.region || !body.city || !body.address || !body.phone) {
      return toast("Заполните обязательные поля: ФИО, регион, город, адрес, телефон.");
    }
    try {
      var d = await api("/api/app/checkout/submit", { method: "POST", body: body });
      S.profile = { fullName: body.fullName, region: body.region, city: body.city, postalCode: body.postalCode, address: body.address, phone: body.phone };
      if (d.submitted) {
        S.cart = { items: [], total: 0, count: 0 };
        setBadge();
        S.success = { id: c.orderId, total: c.total };
        S.orderId = c.orderId;
        S.adminOrder = false;
        go("order");
        loadOrder().then(render);
      } else if (d.needReceipt) {
        toast("Прикрепите чек об оплате, чтобы завершить заказ.");
      }
    } catch (e) {
      toast(e.error || "Ошибка оформления");
    }
  }

  function pickReceipt() {
    var fp = $("#file-proxy");
    fp.onchange = async function () {
      var f = fp.files && fp.files[0];
      fp.value = "";
      if (!f) return;
      if (f.size > 6 * 1024 * 1024) return toast("Файл слишком большой (макс. 6 МБ).");
      var reader = new FileReader();
      reader.onload = async function () {
        try {
          var d = await api("/api/app/checkout/receipt", {
            method: "POST",
            body: { orderId: S.checkout.orderId, dataUrl: reader.result },
          });
          S.receiptPreview = d.order && d.order.receiptUrl ? d.order.receiptUrl : reader.result;
          toast("Чек получен ✓");
          if (d.submitted) {
            S.cart = { items: [], total: 0, count: 0 };
            setBadge();
            S.orderId = S.checkout.orderId;
            S.adminOrder = false;
            go("order");
            loadOrder().then(render);
          } else {
            render();
          }
        } catch (e) {
          toast(e.error || "Не удалось загрузить чек");
        }
      };
      reader.readAsDataURL(f);
    };
    fp.click();
  }

  async function sendAi(text) {
    text = (text || "").trim();
    if (!text || S.aiBusy) return;
    if (!(S.settings && S.settings.aiEnabled)) return toast("ИИ-консультант пока не подключён.");
    S.chat.push({ role: "user", text: text });
    S.aiBusy = true;
    render();
    S.chat.push({ role: "ai", text: "", typing: true });
    render();
    try {
      var d = await api("/api/app/ai", { method: "POST", body: { message: text } });
      S.chat.pop();
      S.chat.push({ role: "ai", text: d.reply || "…" });
    } catch (e) {
      S.chat.pop();
      S.chat.push({ role: "ai", text: e && e.error ? "⚠️ " + e.error : "⚠️ Не удалось получить ответ." });
    }
    S.aiBusy = false;
    render();
  }

  /* ────────── Настройки / модалы ────────── */
  function openSettings() {
    var m = modal(
      "Настройки",
      '<div class="field"><label>Язык / Тіл</label><select id="m-lang">' +
        '<option value="ru"' + (S.user.lang === "kk" ? "" : " selected") + ">Русский</option>" +
        '<option value="kk"' + (S.user.lang === "kk" ? " selected" : "") + ">Қазақша</option>" +
        "</select></div>" +
        '<div class="row" style="margin:0"><div class="inf"><div class="nm">ИИ-консультант</div>' +
        '<div class="sub">Отвечает на вопросы о товарах</div></div>' +
        '<label class="switch"><input type="checkbox" id="m-ai"' + (S.user.aiMode ? " checked" : "") + '><span class="tr"></span></label></div>' +
        '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
        '<button class="btn-primary" id="m-save">Сохранить</button></div>'
    );
    $("#m-save").onclick = async function () {
      var lang = $("#m-lang").value;
      var aiMode = $("#m-ai").checked;
      try {
        var d = await api("/api/app/settings", { method: "POST", body: { lang: lang, aiMode: aiMode } });
        S.user = d.user;
        closeModal();
        toast("Сохранено ✓");
        render();
      } catch (e) {
        toast(e.error || "Ошибка");
      }
    };
  }

  function openDelivery() {
    var p = S.profile || {};
    var inner =
      mField("d-fullName", "ФИО", p.fullName, "Иванов Иван Иванович") +
      mField("d-region", "Регион", p.region, "Казахстан") +
      mField("d-city", "Город", p.city, "Тараз") +
      mField("d-postalCode", "Индекс", p.postalCode, "080000") +
      mField("d-address", "Адрес", p.address, "ул. Абая, 10, кв. 5") +
      mField("d-phone", "Телефон", p.phone, "+7 7XX XXX XX XX") +
      '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
      '<button class="btn-primary" id="d-save">Сохранить</button></div>';
    modal("Данные доставки", inner);
    $("#d-save").onclick = async function () {
      var profile = {
        fullName: $("#d-fullName").value.trim(),
        region: $("#d-region").value.trim(),
        city: $("#d-city").value.trim(),
        postalCode: $("#d-postalCode").value.trim(),
        address: $("#d-address").value.trim(),
        phone: $("#d-phone").value.trim(),
      };
      try {
        var d = await api("/api/app/settings", { method: "POST", body: { profile: profile } });
        S.profile = d.profile;
        closeModal();
        toast("Сохранено ✓");
      } catch (e) {
        toast(e.error || "Ошибка");
      }
    };
  }

  function openAbout() {
    var s = S.settings || {};
    var inner =
      "<div class='m-card-desc'>MASSA TARAZ — магазин спортивного питания. Оплата переводом, доставка СДЭК по Казахстану.</div>" +
      '<div class="stat-list" style="margin:12px 0 0;padding-top:4px">' +
      (s.paymentPhone ? "<div class='it'><span>Номер перевода</span><b>" + esc(s.paymentPhone) + "</b></div>" : "") +
      (s.paymentDetails ? "<div class='it'><span>Реквизиты</span><b>" + esc(s.paymentDetails) + "</b></div>" : "") +
      '<div class="it"><span>Поддержка</span><b>@massataraz08</b></div>' +
      "</div>" +
      '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Закрыть</button></div>';
    modal("О магазине", inner);
  }

  /* ────────── Админ-данные ────────── */
  async function loadAdminProducts() {
    try {
      var d = await api("/api/app/admin/products");
      S.prods = d.products;
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function loadAdminCourses() {
    try {
      var d = await api("/api/app/admin/courses");
      S.courses = d.courses;
      render();
    } catch (e) {}
  }
  async function loadAdminCats() {
    try {
      var d = await api("/api/app/admin/categories");
      S.cats = d.categories;
      render();
    } catch (e) {}
  }
  async function loadAdminOrders() {
    try {
      var q = S.adminStatus === "all" ? "" : "?status=" + S.adminStatus;
      var d = await api("/api/app/admin/orders" + q);
      S.adminOrders = d.orders;
      render();
    } catch (e) {}
  }
  async function loadStats() {
    try {
      var d = await api("/api/app/admin/statistics");
      S.stats = d.statistics;
      S.counts = d.counts;
      render();
    } catch (e) {}
  }

  function catSelect(id, cats) {
    var opts =
      '<option value="">— выберите категорию —</option>' +
      (cats || S.cats || [])
        .map(function (c) {
          return '<option value="' + c.id + '"' + (Number(id) === Number(c.id) ? " selected" : "") + ">" + esc(c.name) + "</option>";
        })
        .join("");
    return '<div class="field"><label>Категория *</label><select id="' + "f-cat" + '">' + opts + "</select></div>";
  }

  function pickUpload(target) {
    var fp = $("#file-proxy");
    fp.accept = "image/jpeg,image/png,image/webp,image/heic";
    fp.onchange = async function () {
      var f = fp.files && fp.files[0];
      fp.value = "";
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) return toast("Файл слишком большой.");
      var reader = new FileReader();
      reader.onload = async function () {
        try {
          var d = await api("/api/app/admin/upload", {
            method: "POST",
            body: { dataUrl: reader.result, prefix: target === "f-prod-img" ? "products" : target === "f-cat-img" ? "categories" : "courses" },
          });
          var fieldId = target.replace("-img", "Img");
          if (target === "f-prod-img") S.prodForm.imageUrl = d.imageUrl;
          else if (target === "f-cat-img") S.catForm.imageUrl = d.imageUrl;
          else if (target === "f-cour-img") S.courForm.imageUrl = d.imageUrl;
          var wrap = document.getElementById(target);
          var el = document.getElementById(target + "-preview");
          if (wrap && el) {
            el.innerHTML = imgHTML(d.imageUrl, "image");
          }
          toast("Фото загружено ✓");
        } catch (e) {
          toast(e.error || "Ошибка загрузки");
        }
      };
      reader.readAsDataURL(f);
    };
    fp.click();
  }

  function openProdForm(id) {
    var p = null;
    if (id) p = (S.prods || []).find(function (x) { return x.id === Number(id); });
    S.prodForm = { id: p ? p.id : null, imageUrl: p ? p.imageUrl : "" };
    var inner =
      (id ? "" : '<div style="font-size:12.5px;color:var(--text2);margin-bottom:10px">После создания фото можно загрузить кнопкой ниже.</div>') +
      mField("f-prod-name", "Название *", p ? p.name : "", "Название товара") +
      '<div class="grid" style="grid-template-columns:1fr 1fr;padding:0">' +
      mField("f-prod-price", "Цена (₸) *", p ? p.price : "", "10000") +
      mField("f-prod-stock", "Остаток", p != null ? p.stock : "", "0") +
      "</div>" +
      catSelect(p ? p.categoryId : null) +
      '<div class="field"><label>Описание</label><textarea id="f-prod-desc" rows="3">' + esc(p ? p.description || "" : "") + "</textarea></div>" +
      '<div class="field"><label>Фото</label>' +
      '<div class="img-upload" data-act="upload:pick" data-target="f-prod-img">' +
      '<span id="f-prod-img-preview">' + (p && p.imageUrl ? imgHTML(p.imageUrl, "image") : "📷 Загрузить фото") + "</span>" +
      "</div></div>" +
      '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
      '<button class="btn-primary" id="f-prod-save">' + (id ? "Сохранить" : "Создать") + "</button></div>";
    modal(id ? "Редактировать товар" : "Новый товар", inner);
    $("#f-prod-save").onclick = async function () {
      var name = $("#f-prod-name").value.trim();
      var price = Number(String($("#f-prod-price").value || "").replace(",", "."));
      var stock = Number($("#f-prod-stock").value || 0);
      var categoryId = Number($("#f-cat").value);
      if (!name || !(price > 0) || !categoryId) return toast("Заполните: название, цена, категория.");
      var body = {
        name: name,
        price: price,
        stock: stock,
        categoryId: categoryId,
        description: $("#f-prod-desc").value,
        imageUrl: S.prodForm.imageUrl,
      };
      try {
        if (S.prodForm.id) await api("/api/app/admin/products/" + S.prodForm.id, { method: "PATCH", body: body });
        else await api("/api/app/admin/products", { method: "POST", body: body });
        closeModal();
        toast("Сохранено ✓");
        loadAdminProducts();
      } catch (e) {
        toast(e.error || "Ошибка сохранения");
      }
    };
  }
  async function prodDel(id) {
    if (!confirm("Удалить товар?")) return;
    try {
      await api("/api/app/admin/products/" + id, { method: "DELETE" });
      toast("Удалено");
      loadAdminProducts();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function prodTgl(id) {
    try {
      await api("/api/app/admin/products/" + id + "/toggle", { method: "POST" });
      loadAdminProducts();
    } catch (e) {}
  }

  function openCatForm(id) {
    var c = null;
    if (id) c = (S.cats || []).find(function (x) { return x.id === Number(id); });
    S.catForm = { id: c ? c.id : null, imageUrl: c ? c.imageUrl : "" };
    var inner =
      mField("f-cat-name", "Название *", c ? c.name : "", "Название категории") +
      mField("f-cat-desc", "Описание", c ? c.description || "" : "", "") +
      '<div class="field"><label>Фото</label>' +
      '<div class="img-upload" data-act="upload:pick" data-target="f-cat-img">' +
      '<span id="f-cat-img-preview">' + (c && c.imageUrl ? imgHTML(c.imageUrl, "image") : "📷 Загрузить фото") + "</span>" +
      "</div></div>" +
      '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
      '<button class="btn-primary" id="f-cat-save">' + (id ? "Сохранить" : "Создать") + "</button></div>";
    modal(id ? "Редактировать категорию" : "Новая категория", inner);
    $("#f-cat-save").onclick = async function () {
      var name = $("#f-cat-name").value.trim();
      if (!name) return toast("Введите название");
      var body = { name: name, description: $("#f-cat-desc").value, imageUrl: S.catForm.imageUrl };
      try {
        if (S.catForm.id) await api("/api/app/admin/categories/" + S.catForm.id, { method: "PATCH", body: body });
        else await api("/api/app/admin/categories", { method: "POST", body: body });
        closeModal();
        toast("Сохранено ✓");
        loadAdminCats();
      } catch (e) {
        toast(e.error || "Ошибка");
      }
    };
  }
  async function catDel(id) {
    if (!confirm("Удалить категорию?")) return;
    try {
      await api("/api/app/admin/categories/" + id, { method: "DELETE" });
      toast("Удалено");
      loadAdminCats();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function catTgl(id) {
    try {
      await api("/api/app/admin/categories/" + id + "/toggle", { method: "POST" });
      loadAdminCats();
    } catch (e) {}
  }

  function openCourForm(id) {
    var c = null;
    if (id) c = (S.courses || []).find(function (x) { return x.id === Number(id); });
    S.courForm = { id: c ? c.id : null, imageUrl: c ? c.imageUrl : "" };
    var inner =
      mField("f-cour-name", "Название *", c ? c.name : "", "Название связки") +
      '<div class="grid" style="grid-template-columns:1fr 1fr;padding:0">' +
      mField("f-cour-price", "Цена (₸) *", c ? c.price : "", "20000") +
      "</div>" +
      '<div class="field"><label>Описание</label><textarea id="f-cour-desc" rows="3">' + esc(c ? c.description || "" : "") + "</textarea></div>" +
      '<div class="field"><label>Фото</label>' +
      '<div class="img-upload" data-act="upload:pick" data-target="f-cour-img">' +
      '<span id="f-cour-img-preview">' + (c && c.imageUrl ? imgHTML(c.imageUrl, "image") : "📷 Загрузить фото") + "</span>" +
      "</div></div>" +
      '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
      '<button class="btn-primary" id="f-cour-save">' + (id ? "Сохранить" : "Создать") + "</button></div>";
    modal(id ? "Редактировать связку" : "Новая связка", inner);
    $("#f-cour-save").onclick = async function () {
      var name = $("#f-cour-name").value.trim();
      var price = Number(String($("#f-cour-price").value || "").replace(",", "."));
      if (!name || !(price > 0)) return toast("Заполните: название, цена.");
      var body = { name: name, price: price, description: $("#f-cour-desc").value, imageUrl: S.courForm.imageUrl };
      try {
        if (S.courForm.id) await api("/api/app/admin/courses/" + S.courForm.id, { method: "PATCH", body: body });
        else await api("/api/app/admin/courses", { method: "POST", body: body });
        closeModal();
        toast("Сохранено ✓");
        loadAdminCourses();
      } catch (e) {
        toast(e.error || "Ошибка");
      }
    };
  }
  async function courDel(id) {
    if (!confirm("Удалить связку?")) return;
    try {
      await api("/api/app/admin/courses/" + id, { method: "DELETE" });
      toast("Удалено");
      loadAdminCourses();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function courTgl(id) {
    try {
      await api("/api/app/admin/courses/" + id + "/toggle", { method: "POST" });
      loadAdminCourses();
    } catch (e) {}
  }
  function openCourItems(id) {
    var c = (S.courses || []).find(function (x) { return x.id === Number(id); });
    if (!c) return;
    S.courId = id;
    var items = (c.items || [])
      .map(function (i) {
        return (
          "<div class='row'><div class='th'>" + imgHTML(i.product.imageUrl, i.product.name) + "</div>" +
          "<div class='inf'><div class='nm'>" + esc(i.product.name) + "</div><div class='sub'>× " + i.quantity + "</div></div>" +
          '<button class="icon-btn" data-act="couritem:rm" data-pid="' + i.productId + '">🗑</button></div>'
        );
      })
      .join("") || '<div class="empty">Товаров в связке нет</div>';
    var sel =
      '<div class="grid" style="grid-template-columns:1.6fr 1fr;padding:0">' +
      '<div class="field"><select id="ci-prod">' +
      '<option value="">— товар —</option>' +
      (S.prods || [])
        .filter(function (p) { return p.isActive; })
        .map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; })
        .join("") +
      "</select></div>" +
      '<div class="field"><input id="ci-qty" type="number" value="1" min="1" max="100" /></div>' +
      "</div>" +
      '<button class="btn-add" data-act="couritem:add">Добавить в связку</button>';
    var inner = items + "<div style='height:12px'></div>" + sel + '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Готово</button></div>';
    modal("Связка: " + c.name, inner);
  }
  async function addCourItem() {
    var pid = Number($("#ci-prod").value);
    var qty = Number($("#ci-qty").value || 1);
    if (!pid) return toast("Выберите товар");
    try {
      await api("/api/app/admin/courses/" + S.courId + "/items", { method: "POST", body: { productId: pid, quantity: qty } });
      closeModal();
      await loadAdminCourses();
      openCourItems(S.courId);
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function rmCourItem(pid) {
    try {
      await api("/api/app/admin/courses/" + S.courId + "/items/remove", { method: "POST", body: { productId: Number(pid) } });
      closeModal();
      await loadAdminCourses();
      openCourItems(S.courId);
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }

  async function aorderStatus(st) {
    try {
      if (st === "shipped") {
        var d = await api("/api/app/admin/orders/" + S.orderId + "/status", { method: "POST", body: { status: st } });
        S.orderData = d;
        render();
        var inp = $("#aorder-track");
        if (inp) setTimeout(function () { inp.focus(); }, 60);
        toast("Статус «Отправлен». Введите трек-номер ниже.");
        return;
      }
      var d = await api("/api/app/admin/orders/" + S.orderId + "/status", { method: "POST", body: { status: st } });
      S.orderData = d;
      toast("Статус обновлён ✓");
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  async function aorderSaveTrack() {
    var tn = $("#aorder-track").value.trim();
    try {
      var d = await api("/api/app/admin/orders/" + S.orderId + "/status", {
        method: "POST",
        body: { status: "shipped", trackNumber: tn },
      });
      S.orderData = d;
      toast(tn ? "Трек сохранён ✓" : "Сохранено");
      render();
    } catch (e) {
      toast(e.error || "Ошибка");
    }
  }
  function aorderPay(act2) {
    if (act2 === "reject") {
      var m = modal(
        "Отклонить оплату",
        '<div class="field"><label>Причина</label><input id="rej-reason" placeholder="причина отклонения" /></div>' +
          '<div class="m-actions"><button class="btn-ghost" data-act="modal:close">Отмена</button>' +
          '<button class="btn-primary" id="rej-go">Отклонить</button></div>'
      );
      $("#rej-go").onclick = async function () {
        var reason = $("#rej-reason").value.trim();
        if (!reason) return toast("Укажите причину");
        try {
          var d = await api("/api/app/admin/orders/" + S.orderId + "/payment", { method: "POST", body: { action: "reject", reason: reason } });
          closeModal();
          S.orderData = d;
          toast("Оплата отклонена");
          render();
        } catch (e) {
          toast(e.error || "Ошибка");
        }
      };
      return;
    }
    api("/api/app/admin/orders/" + S.orderId + "/payment", { method: "POST", body: { action: "confirm" } })
      .then(function (d) {
        S.orderData = d;
        toast("Оплата подтверждена ✓");
        render();
      })
      .catch(function (e) {
        toast(e.error || "Ошибка");
      });
  }

  /* ────────── Авторизация / boot ────────── */
  function showAuthError() {
    var el = $("#app");
    el.innerHTML =
      '<div class="empty"><div class="big">🔒</div><h3>Сессия истекла</h3>' +
      "<p>Перезапустите Mini App из бота MASSA TARAZ.</p><br />" +
      '<button class="btn-primary" data-act="auth:retry">Обновить</button></div>';
    $("#tabbar").style.display = "none";
  }
  function showUnavailable() {
    var el = $("#app");
    el.innerHTML =
      '<div class="empty"><div class="big">💬</div><h3>Откройте в Telegram</h3>' +
      "<p>Mini App работает внутри бота <b>@massashop_bot</b>.</p>" +
      '<br /><a class="btn-primary" style="display:inline-block;text-decoration:none" href="https://t.me/massashop_bot">Открыть бота</a></div>';
    $("#tabbar").style.display = "none";
    $("#top").style.display = "none";
  }

  function fmtDate(v) {
    if (!v) return "";
    var d = new Date(v);
    return (
      d.getDate().toString().padStart(2, "0") +
      "." +
      (d.getMonth() + 1).toString().padStart(2, "0") +
      "." +
      d.getFullYear()
    );
  }

  /* ────────── Init ────────── */
  async function init() {
    try {
      S.tg = window.Telegram && window.Telegram.WebApp;
      if (!S.tg || !S.tg.initData) {
        showUnavailable();
        return;
      }
      S.initData = S.tg.initData;
      S.tg.ready();
      S.tg.expand();
      try {
        S.tg.setHeaderColor("#481173");
        S.tg.setBackgroundColor("#f7f7fa");
      } catch (e) {}
      var me = await api("/api/app/me");
      S.user = me.user;
      S.isAdmin = me.isAdmin;
      S.profile = me.profile || S.profile;
      S.settings = me.settings;
      S.booted = true;
      $("#tabbar").style.display = "";
      render();
      try {
        await loadCatalog();
        render();
      } catch (e) {}
    } catch (e) {
      var el = $("#app");
      el.innerHTML =
        '<div class="empty"><div class="big">😕</div><h3>Не удалось загрузить</h3>' +
        "<p>" + esc((e && e.error) || "Попробуйте позже") + "</p><br />" +
        '<button class="btn-primary" data-act="auth:retry">Повторить</button></div>';
      $("#tabbar").style.display = "none";
    }
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!el) return;
    var act = el.getAttribute("data-act");
    h(act, el.dataset, ev);
    if (!["prod:open", "course:open", "ord:open"].some(function (x) { return act.indexOf(x) === 0; })) {
      if (act === "prevent") ev.preventDefault();
    }
  });
  // закрытие оверлея кнопкой ✕
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-act='prod:close']") : null;
    if (el) closeOverlay();
  });
  // qty steppers в попапе товара рендерят оверлей заново
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-act^='prod:inc'],[data-act^='prod:dec'],[data-act='cart:add']") : null;
    if (el && !$("#overlay").hidden && el.dataset.type !== "course") {
      var wasProductOpen = !$("#overlay").hidden;
      if (wasProductOpen && S.product) {
        setTimeout(function () {
          // перерисовать содержание оверлея после обновления корзины
          var p = S.product;
          var q = inCart("product", p.id);
          var actEl = $("#overlay .o-actions");
          if (actEl) {
            actEl.outerHTML =
              '<div class="o-actions">' +
              (q > 0
                ? stepperHTML("prod", "product", p.id, q, null, p.stock)
                : '<button class="btn-add pink" style="flex:1" data-act="cart:add" data-type="product" data-id="' + p.id + '">В корзину</button>') +
              "</div>";
            $("#overlay").hidden = false;
          }
        }, 50);
      }
    }
  });

  window.addEventListener("load", init);
  window.closeOverlay = closeOverlay;
})();