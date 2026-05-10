export const MESSAGING_WIDGET_JS = `
(function () {
  if (window.__pgmuMessagingWidgetLoaded) return;
  window.__pgmuMessagingWidgetLoaded = true;

  var script = document.currentScript;
  var apiBase = new URL(script && script.src ? script.src : "/api/v1/messaging/widget.js", window.location.href);
  apiBase.pathname = apiBase.pathname.replace(/\\/widget\\.js$/, "");
  var storageKey = "pgmu.messaging.chatId";
  var localeKey = "pgmu.messaging.locale";
  var savedLocale = window.localStorage.getItem(localeKey);
  var themeMedia = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var state = {
    chatId: window.localStorage.getItem(storageKey) || "",
    busy: false,
    locale: savedLocale === "en" ? "en" : "ru",
  };

  var STRINGS = {
    ru: {
      region: "Помощник ФАЦ ПГМУ",
      placeholder: "Введите вопрос",
      inputLabel: "Сообщение",
      sendAria: "Отправить сообщение",
      menuAria: "Меню",
      loadingAria: "Загрузка",
      hintEnter: "отправить",
      hintShift: "новая строка",
      greeting:
        "Здравствуйте! Подскажу по работе Федерального аккредитационного центра ПГМУ.\\n\\nМогу рассказать про:\\n• виды аккредитации и кому она нужна\\n• курсы повышения квалификации\\n• МАСЦ и УМЦ Learn&Training\\n• контакты, адреса и график работы\\n• сотрудников центра\\n\\nСпросите своими словами — или выберите пример ниже.",
      suggestionsLabel: "Примеры вопросов",
      followUpsLabel: "Связанные вопросы",
      suggestions: [
        "Какие виды аккредитации проводит ФАЦ ПГМУ?",
        "Какие курсы повышения квалификации доступны?",
        "Где находится центр и как связаться?",
      ],
      typingAria: "Помощник печатает ответ",
      menuLanguage: "Язык интерфейса",
      menuClear: "Очистить чат",
      errorOpen: "Не удалось открыть чат. Обновите страницу.",
      errorSend: "Не удалось отправить сообщение. Попробуйте еще раз.",
      errorNoResponse: "Не удалось получить ответ.",
      errorClear: "Не удалось очистить чат.",
    },
    en: {
      region: "PSMU Accreditation Assistant",
      placeholder: "Type your question",
      inputLabel: "Message",
      sendAria: "Send message",
      menuAria: "Menu",
      loadingAria: "Loading",
      hintEnter: "to send",
      hintShift: "new line",
      greeting:
        "Hello! I help with questions about the Federal Accreditation Center of PSMU.\\n\\nI can tell you about:\\n• types of accreditation and who needs them\\n• professional development courses\\n• MASC and the Learn&Training UMC\\n• contacts, addresses and working hours\\n• the center's specialists\\n\\nAsk in your own words — or pick an example below.",
      suggestionsLabel: "Example questions",
      followUpsLabel: "Related questions",
      suggestions: [
        "What types of accreditation does the center provide?",
        "What professional development courses are available?",
        "Where is the center located and how do I contact it?",
      ],
      typingAria: "Assistant is typing",
      menuLanguage: "Interface language",
      menuClear: "Clear chat",
      errorOpen: "Could not open the chat. Please refresh the page.",
      errorSend: "Could not send the message. Please try again.",
      errorNoResponse: "Could not get a response.",
      errorClear: "Could not clear the chat.",
    },
  };

  function t(key) {
    return (STRINGS[state.locale] || STRINGS.ru)[key];
  }

  function endpoint(path) {
    return new URL(apiBase.pathname + path, apiBase.origin).toString();
  }

  function ensureBootStyles() {
    if (document.querySelector('style[data-messaging-widget="boot-styles"]')) return;
    var style = document.createElement("style");
    style.dataset.messagingWidget = "boot-styles";
    style.textContent = ".pgmu-widget[data-loading=\\"true\\"]{width:100%;height:100%;min-height:320px;display:grid;place-items:center;background:#fff;color:#b5121b;font-family:Arial,sans-serif}.pgmu-widget[data-loading=\\"true\\"] .pgmu-widget__panel{visibility:hidden}.pgmu-widget__loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px}.pgmu-widget__loader span{width:7px;height:7px;border-radius:50%;background:currentColor;animation:pgmu-boot 1s infinite ease-in-out}.pgmu-widget__loader span:nth-child(2){animation-delay:.12s}.pgmu-widget__loader span:nth-child(3){animation-delay:.24s}@media (prefers-color-scheme:dark){.pgmu-widget[data-loading=\\"true\\"]{background:#15181d;color:#e03b45}}@keyframes pgmu-boot{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}";
    document.head.appendChild(style);
  }

  function ensureStyles() {
    var existing = document.querySelector('link[data-messaging-widget="styles"]');
    if (existing) {
      return existing.dataset.loaded === "true"
        ? Promise.resolve()
        : new Promise(function (resolve) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", resolve, { once: true });
          });
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = endpoint("/widget.css");
    link.dataset.messagingWidget = "styles";
    var ready = new Promise(function (resolve) {
      link.addEventListener("load", function () {
        link.dataset.loaded = "true";
        resolve();
      }, { once: true });
      link.addEventListener("error", resolve, { once: true });
    });
    document.head.appendChild(link);
    return ready;
  }

  function createWidget() {
    var root = document.createElement("section");
    root.className = "pgmu-widget";
    root.dataset.messagingWidget = "root";
    root.dataset.loading = "true";
    root.innerHTML = [
      '<div class="pgmu-widget__loader" data-role="loader" aria-live="polite">',
      '  <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>',
      '</div>',
      '<div class="pgmu-widget__panel" id="pgmu-widget-region" role="region" data-role="region" aria-labelledby="pgmu-widget-title">',
      '  <h2 class="pgmu-widget__sr-only" id="pgmu-widget-title" data-role="title"></h2>',
      '  <div class="pgmu-widget__messages" id="pgmu-widget-messages" data-role="messages" role="log" aria-live="polite" aria-relevant="additions text" aria-atomic="false"></div>',
      '  <form class="pgmu-widget__form" data-role="form" autocomplete="off">',
      '    <div class="pgmu-widget__row">',
      '      <div class="pgmu-widget__menu" data-role="menu">',
      '        <button class="pgmu-widget__menu-button" type="button" data-role="menu-button" aria-haspopup="menu" aria-controls="pgmu-widget-menu" aria-expanded="false"></button>',
      '        <div class="pgmu-widget__menu-popup" id="pgmu-widget-menu" data-role="menu-popup" role="menu" aria-hidden="true">',
      '          <div class="pgmu-widget__menu-section" data-role="menu-language-label"></div>',
      '          <button class="pgmu-widget__menu-item" type="button" role="menuitemradio" data-action="locale" data-locale="ru" aria-checked="false">',
      '            <span class="pgmu-widget__menu-flag" aria-hidden="true">RU</span>',
      '            <span>Русский</span>',
      '            <span class="pgmu-widget__menu-check" aria-hidden="true"></span>',
      '          </button>',
      '          <button class="pgmu-widget__menu-item" type="button" role="menuitemradio" data-action="locale" data-locale="en" aria-checked="false">',
      '            <span class="pgmu-widget__menu-flag" aria-hidden="true">EN</span>',
      '            <span>English</span>',
      '            <span class="pgmu-widget__menu-check" aria-hidden="true"></span>',
      '          </button>',
      '          <div class="pgmu-widget__menu-divider" role="separator"></div>',
      '          <button class="pgmu-widget__menu-item pgmu-widget__menu-item--danger" type="button" role="menuitem" data-action="clear" data-role="menu-clear">',
      '            <span class="pgmu-widget__menu-icon pgmu-widget__menu-icon--trash" aria-hidden="true"></span>',
      '            <span data-role="menu-clear-label"></span>',
      '          </button>',
      '        </div>',
      '      </div>',
      '      <div class="pgmu-widget__field">',
      '        <label class="pgmu-widget__sr-only" id="pgmu-widget-input-label" data-role="input-label" for="pgmu-widget-input"></label>',
      '        <textarea class="pgmu-widget__input" id="pgmu-widget-input" data-role="input" rows="1" autocomplete="off" autocapitalize="sentences" spellcheck="true" aria-labelledby="pgmu-widget-input-label" aria-controls="pgmu-widget-messages"></textarea>',
      '        <button class="pgmu-widget__send" data-role="send" type="submit" aria-controls="pgmu-widget-messages" aria-disabled="true" disabled></button>',
      '      </div>',
      '    </div>',
      '    <div class="pgmu-widget__hint" aria-hidden="true">',
      '      <span><kbd>Enter</kbd> <span data-role="hint-enter"></span></span>',
      '      <span><kbd>Shift</kbd> + <kbd>Enter</kbd> <span data-role="hint-shift"></span></span>',
      '    </div>',
      '  </form>',
      '</div>'
    ].join("");
    if (script && script.parentNode) {
      script.parentNode.insertBefore(root, script.nextSibling);
    } else {
      document.body.appendChild(root);
    }
    return root;
  }

  function setLoading(root, loading) {
    root.dataset.loading = loading ? "true" : "false";
    var loader = root.querySelector('[data-role="loader"]');
    if (loader) loader.hidden = !loading;
  }

  function isDarkTheme() {
    return !!(themeMedia && themeMedia.matches);
  }

  function applyTheme(root) {
    root.dataset.theme = isDarkTheme() ? "dark" : "light";
  }

  function bindTheme(root) {
    if (!themeMedia) return;
    var update = function () { applyTheme(root); };
    if (typeof themeMedia.addEventListener === "function") {
      themeMedia.addEventListener("change", update);
    } else if (typeof themeMedia.addListener === "function") {
      themeMedia.addListener(update);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSafeUrl(url) {
    var trimmed = String(url).trim();
    return /^(https?:\\/\\/|mailto:|tel:)/i.test(trimmed);
  }

  function renderInline(text) {
    var out = escapeHtml(text);
    out = out.replace(/\`([^\`\\n]+)\`/g, function (_, code) {
      return '<code>' + code + '</code>';
    });
    out = out.replace(/\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)/g, function (full, label, url) {
      if (!isSafeUrl(url)) return full;
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    out = out.replace(/(^|[\\s(])(https?:\\/\\/[^\\s<)]+)/g, function (_, lead, url) {
      return lead + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
    out = out.replace(/\\*\\*([^*\\n]+)\\*\\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>');
    out = out.replace(/(^|[^_])_([^_\\n]+)_/g, '$1<em>$2</em>');
    return out;
  }

  function renderMarkdown(text) {
    var lines = String(text).replace(/\\r\\n?/g, "\\n").split("\\n");
    var html = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i += 1; continue; }
      var heading = /^(#{1,3})\\s+(.+)$/.exec(line);
      if (heading) {
        var level = Math.min(heading[1].length + 2, 4);
        html.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
        i += 1; continue;
      }
      if (/^[-*]\\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^[-*]\\s+/.test(lines[i])) {
          items.push('<li>' + renderInline(lines[i].replace(/^[-*]\\s+/, '')) + '</li>');
          i += 1;
        }
        html.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      var paragraph = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3})\\s+/.test(lines[i]) && !/^[-*]\\s+/.test(lines[i])) {
        paragraph.push(renderInline(lines[i]));
        i += 1;
      }
      html.push('<p>' + paragraph.join('<br>') + '</p>');
    }
    return html.join('');
  }

  function appendMessage(root, text, kind) {
    var messages = root.querySelector('[data-role="messages"]');
    var node = document.createElement("div");
    node.className = "pgmu-widget__message pgmu-widget__message--" + kind;
    if (kind === "assistant") {
      node.classList.add("pgmu-widget__message--md");
      node.innerHTML = renderMarkdown(text);
    } else {
      node.textContent = text;
    }
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function appendSuggestions(root) {
    var messages = root.querySelector('[data-role="messages"]');
    var items = (STRINGS[state.locale] || STRINGS.ru).suggestions || [];
    if (items.length === 0) return null;
    var container = document.createElement("div");
    container.className = "pgmu-widget__suggestions";
    container.dataset.role = "suggestions";
    container.setAttribute("aria-label", t("suggestionsLabel"));
    items.forEach(function (text) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pgmu-widget__suggestion";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        var input = root.querySelector('[data-role="input"]');
        if (!input || state.busy) return;
        input.value = text;
        autosize(input);
        refreshSendState(root);
        send(root);
      });
      container.appendChild(chip);
    });
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
    return container;
  }

  function removeSuggestions(root) {
    var node = root.querySelector('[data-role="suggestions"]');
    if (node) node.remove();
  }

  function removeFollowUps(root) {
    var nodes = root.querySelectorAll('[data-role="follow-ups"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].remove();
  }

  function appendFollowUps(root, followUps) {
    if (!followUps || !followUps.length) return null;
    var messages = root.querySelector('[data-role="messages"]');
    var container = document.createElement("div");
    container.className = "pgmu-widget__suggestions pgmu-widget__suggestions--followups";
    container.dataset.role = "follow-ups";
    container.setAttribute("aria-label", t("followUpsLabel"));
    followUps.forEach(function (chip) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pgmu-widget__suggestion";
      button.textContent = chip.label;
      button.addEventListener("click", function () {
        var input = root.querySelector('[data-role="input"]');
        if (!input || state.busy) return;
        input.value = chip.query || chip.label;
        autosize(input);
        refreshSendState(root);
        send(root);
      });
      container.appendChild(button);
    });
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
    return container;
  }

  function appendWelcome(root) {
    appendMessage(root, t("greeting"), "assistant");
    appendSuggestions(root);
  }

  function appendTyping(root) {
    var messages = root.querySelector('[data-role="messages"]');
    var node = document.createElement("div");
    node.className = "pgmu-widget__typing";
    node.setAttribute("aria-label", t("typingAria"));
    node.innerHTML = '<span class="pgmu-widget__typing-dot"></span><span class="pgmu-widget__typing-dot"></span><span class="pgmu-widget__typing-dot"></span>';
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function setBusy(root, busy) {
    state.busy = busy;
    var input = root.querySelector('[data-role="input"]');
    input.disabled = busy;
    refreshSendState(root);
  }

  function refreshSendState(root) {
    var input = root.querySelector('[data-role="input"]');
    var send = root.querySelector('[data-role="send"]');
    var hasText = input.value.trim().length > 0;
    send.disabled = state.busy || !hasText;
    send.setAttribute("aria-disabled", send.disabled ? "true" : "false");
  }

  function autosize(input) {
    input.style.height = "auto";
    var next = Math.min(input.scrollHeight, 140);
    input.style.height = next + "px";
  }

  function applyLocale(root) {
    root.setAttribute("lang", state.locale === "en" ? "en" : "ru");
    root.dataset.locale = state.locale;
    root.setAttribute("aria-label", t("region"));
    var region = root.querySelector('[data-role="region"]');
    if (region) region.setAttribute("aria-label", t("region"));
    var loader = root.querySelector('[data-role="loader"]');
    if (loader) loader.setAttribute("aria-label", t("loadingAria"));
    var title = root.querySelector('[data-role="title"]');
    if (title) title.textContent = t("region");
    var input = root.querySelector('[data-role="input"]');
    if (input) input.placeholder = t("placeholder");
    var inputLabel = root.querySelector('[data-role="input-label"]');
    if (inputLabel) inputLabel.textContent = t("inputLabel");
    var send = root.querySelector('[data-role="send"]');
    if (send) send.setAttribute("aria-label", t("sendAria"));
    var menuButton = root.querySelector('[data-role="menu-button"]');
    if (menuButton) menuButton.setAttribute("aria-label", t("menuAria"));
    var menuPopup = root.querySelector('[data-role="menu-popup"]');
    if (menuPopup) menuPopup.setAttribute("aria-label", t("menuLanguage"));
    var langLabel = root.querySelector('[data-role="menu-language-label"]');
    if (langLabel) langLabel.textContent = t("menuLanguage");
    var clearLabel = root.querySelector('[data-role="menu-clear-label"]');
    if (clearLabel) clearLabel.textContent = t("menuClear");
    var hintEnter = root.querySelector('[data-role="hint-enter"]');
    if (hintEnter) hintEnter.textContent = t("hintEnter");
    var hintShift = root.querySelector('[data-role="hint-shift"]');
    if (hintShift) hintShift.textContent = t("hintShift");
    var localeItems = root.querySelectorAll('[data-action="locale"]');
    for (var i = 0; i < localeItems.length; i++) {
      var item = localeItems[i];
      item.setAttribute("aria-checked", item.dataset.locale === state.locale ? "true" : "false");
    }
  }

  function setMenuOpen(root, open) {
    var menu = root.querySelector('[data-role="menu"]');
    var button = root.querySelector('[data-role="menu-button"]');
    var popup = root.querySelector('[data-role="menu-popup"]');
    if (!menu || !button) return;
    menu.classList.toggle("pgmu-widget__menu--open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (popup) popup.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function isMenuOpen(root) {
    var menu = root.querySelector('[data-role="menu"]');
    return !!menu && menu.classList.contains("pgmu-widget__menu--open");
  }

  function setLocale(root, locale) {
    if (locale !== "ru" && locale !== "en") return;
    if (state.locale === locale) return;
    state.locale = locale;
    window.localStorage.setItem(localeKey, locale);
    applyLocale(root);
    resetMessagesUi(root);
    appendWelcome(root);
    var input = root.querySelector('[data-role="input"]');
    if (input) {
      input.value = "";
      autosize(input);
      input.focus();
    }
    refreshSendState(root);
  }

  function resetMessagesUi(root) {
    var messages = root.querySelector('[data-role="messages"]');
    if (messages) messages.innerHTML = "";
  }

  async function clearChat(root) {
    if (!state.chatId || state.busy) return;
    setBusy(root, true);
    try {
      await postJson("/clear", { chatId: state.chatId });
      resetMessagesUi(root);
      appendWelcome(root);
    } catch (error) {
      appendMessage(root, t("errorClear"), "status");
    } finally {
      setBusy(root, false);
      var input = root.querySelector('[data-role="input"]');
      if (input) input.focus();
    }
  }

  async function postJson(path, body) {
    var response = await fetch(endpoint(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function start(root) {
    var data = await postJson("/session");
    state.chatId = data.chatId;
    window.localStorage.setItem(storageKey, state.chatId);
    var messages = data.messages || [];
    if (messages.length === 0) {
      appendWelcome(root);
      return;
    }
    messages.forEach(function (item) {
      var kind = String(item.messageId || "").indexOf(":assistant") > -1 ? "assistant" : "user";
      if (item.content) appendMessage(root, item.content, kind);
      if (item.response) appendMessage(root, item.response, "assistant");
    });
  }

  async function send(root) {
    var input = root.querySelector('[data-role="input"]');
    var content = input.value.trim();
    if (!content || state.busy) return;
    input.value = "";
    autosize(input);
    refreshSendState(root);
    removeSuggestions(root);
    removeFollowUps(root);
    appendMessage(root, content, "user");
    setBusy(root, true);
    var pending = appendTyping(root);
    try {
      var result = await postJson("/messages", { chatId: state.chatId, content: content, locale: state.locale });
      pending.remove();
      appendMessage(root, result.response || t("errorNoResponse"), "assistant");
      appendFollowUps(root, result.followUps);
    } catch (error) {
      pending.remove();
      appendMessage(root, t("errorSend"), "status");
    } finally {
      setBusy(root, false);
      input.focus();
    }
  }

  function boot() {
    ensureBootStyles();
    var stylesReady = ensureStyles();
    var root = createWidget();
    var form = root.querySelector('[data-role="form"]');
    var input = root.querySelector('[data-role="input"]');
    var menuButton = root.querySelector('[data-role="menu-button"]');
    var menuPopup = root.querySelector('[data-role="menu-popup"]');

    applyTheme(root);
    applyLocale(root);
    bindTheme(root);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      send(root);
    });

    input.addEventListener("input", function () {
      autosize(input);
      refreshSendState(root);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send(root);
      }
    });

    menuButton.addEventListener("click", function (event) {
      event.stopPropagation();
      setMenuOpen(root, !isMenuOpen(root));
    });

    menuPopup.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action]");
      if (!target) return;
      var action = target.dataset.action;
      if (action === "locale") {
        setLocale(root, target.dataset.locale);
        setMenuOpen(root, false);
      } else if (action === "clear") {
        setMenuOpen(root, false);
        clearChat(root);
      }
    });

    document.addEventListener("click", function (event) {
      if (!isMenuOpen(root)) return;
      var menu = root.querySelector('[data-role="menu"]');
      if (menu && !menu.contains(event.target)) setMenuOpen(root, false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isMenuOpen(root)) {
        setMenuOpen(root, false);
        menuButton.focus();
      }
    });

    autosize(input);
    refreshSendState(root);

    var sessionReady = start(root)
      .catch(function () {
        appendMessage(root, t("errorOpen"), "status");
      });

    Promise.all([stylesReady, sessionReady]).then(function () {
      setLoading(root, false);
      input.focus();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`.trim();
