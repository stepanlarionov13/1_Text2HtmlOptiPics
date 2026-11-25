/**
 * ==========================================================================
 * Text2Html — Модуль преобразования текста и DOCX в чистый HTML
 * Версия: 0.2 (Этап 2)
 * ==========================================================================
 * 
 * ПОЯСНЕНИЕ ДЛЯ НАЧИНАЮЩИХ:
 * Этот файл — "движок" обработки текста. Он решает 4 главные задачи:
 * 
 * 1. Ввод данных (Парсинг):
 *    - Из обычного текста делает разметку абзацев (<p>), списков (<ul>, <ol>)
 *      и ссылок (<a>).
 *    - Из файлов DOCX через библиотеку mammoth.js извлекает разметку Word.
 * 
 * 2. Очистка (Sanitization & Cleaning):
 *    - Удаляет мусорные стили Word (шрифты, цвета, кегль, отступы).
 *    - Удаляет "красную строку" (как отступы в стилях, так и пробелы в начале).
 *    - Удаляет пустые теги и лишние обёртки <span>.
 *    - Сохраняет только важное: жирный (<strong>), курсив (<em>), 
 *      подчёркивание (<u>), списки и ссылки.
 * 
 * 3. Типографика (Typograf):
 *    - Превращает прямые кавычки "" в русские «ёлочки».
 *    - Превращает дефис в длинное тире « — ».
 *    - Ставит неразрывные пробелы (&nbsp;) после коротких предлогов и союзов.
 * 
 * 4. Красивое форматирование:
 *    - Выстраивает HTML построчно — тег за тегом, чтобы человеку было
 *      удобно прочитать и проверить код перед вставкой на сайт.
 */

(function (global) {
  'use strict';

  // Создаём главный объект модуля
  const Text2Html = {};

  // ==========================================================================
  // 1. НАСТРОЙКИ ПО УМОЛЧАНИЮ
  // ==========================================================================
  const DEFAULT_OPTIONS = {
    cleanIndents: true,    // Удалять красную строку и начальные пробелы
    cleanFonts: true,      // Удалять font-family, font-size, color, background
    detectHeadings: true,  // Распознавать заголовки H2-H4 (по жирному начертанию или markdown)
    typography: true       // Применять типографику (кавычки «», тире —, неразрывные пробелы)
  };

  /**
   * Список коротких русских предлогов, союзов и частиц, после которых
   * нельзя делать разрыв строки (правило русской типографики).
   */
  const RU_PREPOSITIONS = [
    'в', 'во', 'к', 'ко', 'с', 'со', 'у', 'о', 'об', 'обо',
    'на', 'за', 'из', 'до', 'по', 'от', 'без', 'для', 'под',
    'над', 'при', 'про', 'через', 'и', 'а', 'но', 'или', 'да',
    'не', 'ни', 'как', 'так', 'же', 'то'
  ];

  // ==========================================================================
  // 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ==========================================================================

  /**
   * Объединяет пользовательские настройки с настройками по умолчанию
   */
  function resolveOptions(userOptions) {
    return Object.assign({}, DEFAULT_OPTIONS, userOptions || {});
  }

  /**
   * Экранирует спецсимволы HTML (<, >, &, ", ') в обычном тексте,
   * чтобы текст случайно не сломал разметку страницы.
   */
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Проверяет, похожа ли строка на заголовок (для простого текста)
   * Условия: короткая (до 90 симв), начинается с заглавной, без точки на конце.
   */
  function looksLikeHeading(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length > 90) return false;
    // Если заканчивается точкой, запятой, двоеточием — это вряд ли заголовок
    if (/[.,;:!?]$/.test(trimmed)) return false;
    // Должна начинаться с буквы в верхнем регистре
    const firstChar = trimmed.charAt(0);
    return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  }

  // ==========================================================================
  // 3. ПРЕОБРАЗОВАНИЕ ОБЫЧНОГО ТЕКСТА В БАЗОВЫЙ HTML
  // ==========================================================================

  /**
   * Преобразует вставленный сырой текст (включая Markdown) в первичный HTML
   * @param {string} rawText — текст из буфера обмена или файла .md / .txt
   * @param {object} options — настройки обработки
   * @returns {string} — первичная HTML-разметка
   */
  Text2Html.rawTextToHtml = function (rawText, options) {
    if (!rawText || !rawText.trim()) return '';
    const opts = resolveOptions(options);

    // 1. Нормализуем переносы строк (Windows \r\n -> Unix \n)
    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const lines = text.split('\n');
    const htmlBlocks = [];

    let currentList = null; // { type: 'ul' | 'ol', items: [] }
    let currentParagraph = [];

    function flushList() {
      if (!currentList) return;
      const tag = currentList.type;
      const itemsHtml = currentList.items.map(item => `  <li>${item}</li>`).join('\n');
      htmlBlocks.push(`<${tag}>\n${itemsHtml}\n</${tag}>`);
      currentList = null;
    }

    function flushParagraph() {
      if (currentParagraph.length === 0) return;
      const content = currentParagraph.join('<br>');
      currentParagraph = [];
      if (content.trim()) {
        htmlBlocks.push(`<p>${content}</p>`);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      let rawLine = lines[i];
      let line = rawLine.trim();

      // А. Если включена очистка отступов — убираем пробелы/табы красной строки
      if (opts.cleanIndents) {
        line = line.replace(/^[ \t\u00A0]+/, '');
      }

      // Б. Пустая строка
      if (!line) {
        flushParagraph();
        continue;
      }

      // В. Пустая разметка Markdown (строки, содержащие только ## или ** без текста)
      // Игнорируем их, чтобы они не превращались в паразитные теги вроде <p>##</p>
      if (/^#{1,6}\s*$/.test(line) || /^(\*\*|__)\s*$/.test(line)) {
        flushParagraph();
        flushList();
        continue;
      }

      // Г. Заголовки Markdown (# H1 ... ###### H6)
      const mdHeadingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (mdHeadingMatch && opts.detectHeadings) {
        flushList();
        flushParagraph();
        const level = Math.min(6, Math.max(1, mdHeadingMatch[1].length));
        const headingText = formatInlineText(mdHeadingMatch[2].trim(), opts);
        htmlBlocks.push(`<h${level}>${headingText}</h${level}>`);
        continue;
      }

      // Д. Заголовок из одной строки жирным (**Заголовок**)
      const boldHeadingMatch = line.match(/^\*\*(.+?)\*\*$/) || line.match(/^__(.+?)__$/);
      if (boldHeadingMatch && opts.detectHeadings && !/[.!?]$/.test(boldHeadingMatch[1].trim())) {
        flushList();
        flushParagraph();
        const hText = formatInlineText(boldHeadingMatch[1].trim(), opts);
        htmlBlocks.push(`<h2>${hText}</h2>`);
        continue;
      }

      // Е. Маркированные списки (- , * , + , • , — , –)
      const bulletMatch = line.match(/^[-*+•—–]\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(formatInlineText(bulletMatch[1].trim(), opts));
        continue;
      }

      // Ж. Нумерованные списки (1. , 1) )
      const numberMatch = line.match(/^\d+[\.\)]\s+(.+)$/);
      if (numberMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(formatInlineText(numberMatch[1].trim(), opts));
        continue;
      }

      // З. Продолжение элемента списка (строка с отступом внутри списка)
      if (currentList && (/^\s{2,}\S/.test(rawLine) || rawLine.startsWith('\t'))) {
        const lastIdx = currentList.items.length - 1;
        currentList.items[lastIdx] += ' ' + formatInlineText(line, opts);
        continue;
      }

      // И. Обычный абзац
      flushList();
      currentParagraph.push(formatInlineText(line, opts));
    }

    flushList();
    flushParagraph();

    return htmlBlocks.join('\n');
  };

  /**
   * Форматирует строчные элементы внутри строки текста:
   * ссылки (https://...), markdown-ссылки [текст](url), жирный (**текст**), курсив (*текст*)
   */
  function formatInlineText(str, opts) {
    if (!str) return '';

    // Экранируем HTML-символы
    let escaped = escapeHtml(str);

    // 1. Поддержка Markdown-ссылок: [Текст ссылки](https://...) -> <a href="...">Текст ссылки</a>
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s<>"'()]+)\)/g, '<a href="$2">$1</a>');

    // 2. Автоматическое распознавание прямых ссылок (URL -> <a>)
    // Исключаем уже обёрнутые в href="...", проверяя перед ссылкой
    escaped = escaped.replace(/(^|[^">])(https?:\/\/[^\s<>"'()]+)/g, '$1<a href="$2">$2</a>');

    // 3. Базовая поддержка Markdown-выделений для простого текста
    // **жирный** или __жирный__ -> <strong>жирный</strong>
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // *курсив* или _курсив_ -> <em>курсив</em>
    escaped = escaped.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
    escaped = escaped.replace(/(^|[^_])_([^_]+?)_(?!_)/g, '$1<em>$2</em>');

    return escaped;
  }

  // ==========================================================================
  // 4. ПРЕОБРАЗОВАНИЕ DOCX ЧЕРЕЗ MAMMOTH.JS
  // ==========================================================================

  /**
   * Преобразует бинарный файл DOCX (ArrayBuffer) в HTML с помощью библиотеки mammoth.js
   * @param {ArrayBuffer} arrayBuffer — содержимое файла docx
   * @param {object} options — настройки
   * @returns {Promise<string>} — сырой HTML из файла
   */
  Text2Html.docxToHtml = async function (arrayBuffer, options) {
    if (!arrayBuffer) {
      throw new Error('Файл DOCX пуст или не передан');
    }

    // Проверяем, подключена ли библиотека mammoth.js
    const mammothLib = typeof mammoth !== 'undefined' ? mammoth : (global.mammoth || null);

    if (!mammothLib) {
      throw new Error(
        'Библиотека mammoth.js не найдена. Убедитесь, что подключение к интернету активно, ' +
        'или скопируйте текст из Word вручную и вставьте его в поле ввода.'
      );
    }

    // Настраиваем правила сопоставления стилей Word со стандартными тегами HTML
    const mammothOptions = {
      styleMap: [
        // Заголовки Word преобразуем в H1-H6
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Заголовок 1'] => h1:fresh",
        "p[style-name='Заголовок 2'] => h2:fresh",
        "p[style-name='Заголовок 3'] => h3:fresh",
        "p[style-name='Заголовок 4'] => h4:fresh",
        // Подчёркнутый текст
        "u => u",
        // Зачёркнутый текст
        "strike => s"
      ]
    };

    try {
      const result = await mammothLib.convertToHtml({ arrayBuffer: arrayBuffer }, mammothOptions);
      if (result.messages && result.messages.length > 0) {
        console.warn('Предупреждения mammoth.js при чтении DOCX:', result.messages);
      }
      return result.value || '';
    } catch (err) {
      console.error('Ошибка mammoth.js:', err);
      throw new Error('Не удалось прочитать файл DOCX. Возможно, файл повреждён или защищён паролем.');
    }
  };

  // ==========================================================================
  // 5. ОЧИСТКА HTML (САНИТИЗАЦИЯ И УДАЛЕНИЕ МУСОРА)
  // ==========================================================================

  /**
   * Чистит HTML от мусорных атрибутов Word, стилей шрифтов, пустых тегов и красной строки
   * @param {string} html — сырой HTML
   * @param {object} options — настройки очистки
   * @returns {string} — очищенный и валидный HTML
   */
  Text2Html.cleanHtml = function (html, options) {
    if (!html || !html.trim()) return '';
    const opts = resolveOptions(options);

    // Шаг 1: Предварительная строковая очистка от мусора Word
    let clean = html
      // Удаляем XML-объявления и мета-теги Office
      .replace(/<\?xml[^>]*>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      // Удаляем условные комментарии Word: <!--[if ...]>...<![endif]-->
      .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
      // Удаляем псевдо-теги списков Word: <![if !supportLists]> и <![endif]>
      .replace(/<!\[if[\s\S]*?\]>/gi, '')
      .replace(/<!\[endif\]>/gi, '')
      // Удаляем обычные HTML-комментарии: <!-- ... -->
      .replace(/<!--[\s\S]*?-->/g, '')
      // Удаляем теги <o:p>...</o:p>
      .replace(/<\/?[a-z0-9]+:[a-z0-9]+[^>]*>/gi, '');

    // Шаг 2: Парсинг через DOMParser (браузерный парсер HTML)
    // Это надёжнее любых регулярных выражений, так как браузер создаёт дерево элементов
    let doc;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      doc = parser.parseFromString(clean, 'text/html');
    } else {
      // Для сред без браузерного DOM (например, тесты в Node.js без JSDOM)
      return fallbackCleanRegex(clean, opts);
    }

    const body = doc.body;

    // Шаг 2А: Преобразуем «фальшивые» списки Microsoft Word (<p class="MsoListParagraph">·   текст</p>)
    // в настоящие <ul><li> и <ol><li> ДО того, как cleanNode удалит классы MsoList и стили!
    convertWordFakeLists(body);

    // Шаг 2Б: Запоминаем размеры шрифтов (font-size) у абзацев ДО удаления inline-стилей,
    // чтобы позже корректно различить уровни заголовков H2, H3 и H4
    if (opts.detectHeadings) {
      annotateFontSizes(body);
    }

    // Шаг 2В: Рекурсивно обходим и очищаем DOM-дерево
    cleanNode(body, opts);

    // Шаг 2Г: Интеллектуальное распознавание иерархии заголовков H2–H4 по жирному начертанию
    // с учётом контекста всего документа (нумерации, уже имеющихся H2/H3 и размеров шрифта)
    if (opts.detectHeadings) {
      promoteBoldHeadings(body);
    }

    // Извлекаем очищенный HTML из <body>
    let result = body.innerHTML;

    // Шаг 3: Постобработка строк (форматирование тегов построчно)
    result = formatHtmlLines(result);

    return result;
  };

  /**
   * Извлекает размер шрифта в пунктах (pt) из CSS-строки style="..."
   */
  function parseFontSizePt(styleStr) {
    if (!styleStr) return null;
    const match = styleStr.match(/font-size\s*:\s*([\d.]+)\s*(pt|px|em|rem)\b/i);
    if (!match) return null;
    const val = parseFloat(match[1]);
    if (isNaN(val) || val <= 0) return null;
    const unit = match[2].toLowerCase();
    if (unit === 'pt') return Math.round(val * 2) / 2;
    if (unit === 'px') return Math.round(val * 0.75 * 2) / 2;
    return Math.round(val * 12 * 2) / 2;
  }

  /**
   * Рекурсивно сохраняет исходный размер шрифта на <p> и <div> (в служебном поле _detectedFontSizePt)
   * до того, как cleanNode удалит все атрибуты style
   */
  function annotateFontSizes(root) {
    if (!root || root.nodeType !== 1) return;
    const tag = root.tagName.toLowerCase();

    if (tag === 'p' || tag === 'div') {
      let pt = parseFontSizePt(root.getAttribute('style') || '');
      if (pt === null) {
        // Ищем font-size на первом дочернем элементе (например <p><span style="font-size:16pt">...</span></p>)
        const descendants = root.querySelectorAll ? root.querySelectorAll('span, b, strong, font') : Array.from(root.children);
        for (const el of descendants) {
          const childPt = parseFontSizePt(el.getAttribute('style') || '');
          if (childPt !== null) {
            pt = childPt;
            break;
          }
        }
      }
      if (pt !== null) {
        root._detectedFontSizePt = pt;
      }
    }

    for (const ch of Array.from(root.children)) {
      annotateFontSizes(ch);
    }
  }

  /**
   * Проверяет, является ли очищенный абзац <p> кандидатом на заголовок по жирному начертанию
   */
  function isBoldHeadingCandidate(node) {
    if (!node || node.nodeType !== 1 || node.tagName.toLowerCase() !== 'p') return false;

    // НЕ трогаем абзацы внутри таблиц, списков и цитат
    if (typeof node.closest === 'function' && node.closest('table, td, th, li, blockquote')) {
      return false;
    }

    const textOnly = node.textContent.trim();
    if (textOnly.length === 0 || textOnly.length > 100) return false;

    // Не считаем заголовком обычные предложения (точка/вопрос/восклицание/двоеточие в конце)
    // и строки метаданных с разделителем " | " (например: "Срок: 21–22 ноября | Результат: ...")
    if (/[.!?;,:]$/.test(textOnly) || /\s\|\s/.test(textOnly)) {
      return false;
    }

    // Не превращаем в заголовок одиночную ссылку
    if (node.querySelector && node.querySelector('a')) {
      return false;
    }

    // Весь текст абзаца должен находиться внутри единственного <strong>/<b> (без обычного текста рядом)
    const firstEl = node.children.length === 1 ? node.children[0] : null;
    const isBoldTag = firstEl && ['strong', 'b'].includes(firstEl.tagName.toLowerCase());
    return Boolean(isBoldTag && firstEl.textContent.trim() === textOnly);
  }

  /**
   * Определяет уровень нумерации в тексте заголовка:
   * - "1.1.1. Детали" -> 4 (H4)
   * - "1.1. Подраздел" -> 3 (H3)
   * - "1. Раздел" или "2) Раздел" -> 2 (H2)
   * - без нумерации -> null
   */
  function getNumberedHeadingLevel(text) {
    if (/^\d+\.\d+\.\d+\.?\s+/.test(text)) return 4;
    if (/^\d+\.\d+\.?\s+/.test(text)) return 3;
    if (/^\d+[.)]\s+/.test(text)) return 2;
    return null;
  }

  /**
   * Интеллектуально преобразует жирные абзацы <p><strong>...</strong></p> в заголовки <h2>, <h3> или <h4>
   * с учётом иерархии всего документа:
   * 1) Многоуровневая нумерация (1. -> H2, 1.1. -> H3, 1.1.1. -> H4).
   * 2) Контекст документа: ненумерованные жирные подзаголовки после H2 (или раздела «1. ...») становятся H3,
   *    а после H3 — становятся H4.
   * 3) Размер шрифта (font-size): если среди подзаголовков одного контекста есть разные кегли
   *    (разница >= 1.5pt), более крупный получает более высокий уровень (H2 -> H3 -> H4).
   */
  function promoteBoldHeadings(body) {
    if (!body) return;

    // Собираем в порядке следования в документе все явные заголовки (H1–H4) и жирных кандидатов
    const flowItems = [];

    function collectFlow(container) {
      for (const ch of Array.from(container.children)) {
        const tag = ch.tagName.toLowerCase();
        if (['table', 'ul', 'ol', 'blockquote'].includes(tag)) {
          continue;
        }
        if (/^h[1-6]$/.test(tag)) {
          flowItems.push({ kind: 'explicit', level: parseInt(tag.charAt(1), 10), node: ch });
        } else if (isBoldHeadingCandidate(ch)) {
          const text = ch.textContent.trim();
          flowItems.push({
            kind: 'candidate',
            node: ch,
            text: text,
            numberedLevel: getNumberedHeadingLevel(text),
            fontSizePt: typeof ch._detectedFontSizePt === 'number' ? ch._detectedFontSizePt : null
          });
        } else if (['div', 'section', 'article'].includes(tag)) {
          collectFlow(ch);
        }
      }
    }

    collectFlow(body);

    // 1. Первый проход: вычисляем базовый контекстный уровень (baseLevel) для каждого ненумерованного кандидата
    let currentExplicitLevel = null; // уровень последнего явного <h2> или <h3>
    let insideNumberedH2 = false;    // находимся ли мы внутри нумерованного раздела (1. ..., 2. ...)

    for (const item of flowItems) {
      if (item.kind === 'explicit') {
        if (item.level === 1) {
          currentExplicitLevel = null;
          insideNumberedH2 = false;
        } else if (item.level === 2) {
          currentExplicitLevel = 2;
          insideNumberedH2 = false;
        } else if (item.level === 3) {
          currentExplicitLevel = 3;
        } else if (item.level >= 4) {
          currentExplicitLevel = 4;
        }
        continue;
      }

      if (item.numberedLevel !== null) {
        item.finalLevel = item.numberedLevel;
        if (item.numberedLevel === 2) {
          insideNumberedH2 = true;
          currentExplicitLevel = null;
        }
        continue;
      }

      // Ненумерованный жирный подзаголовок: определяем базовый уровень по контексту
      if (currentExplicitLevel === 3 || currentExplicitLevel === 4) {
        item.baseLevel = 4;
      } else if (currentExplicitLevel === 2 || insideNumberedH2) {
        item.baseLevel = 3;
      } else {
        item.baseLevel = 2;
      }
    }

    // 2. Второй проход: учитываем разницу размеров шрифта среди ненумерованных кандидатов одного baseLevel
    const byBaseLevel = {};
    for (const item of flowItems) {
      if (item.kind === 'candidate' && item.finalLevel === undefined) {
        if (!byBaseLevel[item.baseLevel]) byBaseLevel[item.baseLevel] = [];
        byBaseLevel[item.baseLevel].push(item);
      }
    }

    for (const baseKey of Object.keys(byBaseLevel)) {
      const baseLevel = parseInt(baseKey, 10);
      const group = byBaseLevel[baseKey];

      // Собираем уникальные размеры шрифта (с шагом не меньше 1.5pt, чтобы игнорировать погрешность 0.5pt)
      const rawSizes = group
        .map(it => it.fontSizePt)
        .filter(sz => sz !== null)
        .sort((a, b) => b - a);

      const distinctSizes = [];
      for (const sz of rawSizes) {
        if (distinctSizes.length === 0 || distinctSizes[distinctSizes.length - 1] - sz >= 1.5) {
          distinctSizes.push(sz);
        }
      }

      for (const item of group) {
        if (distinctSizes.length >= 2 && item.fontSizePt !== null) {
          // Находим ближайший ранг размера шрифта (0 = самый крупный -> baseLevel, 1 -> baseLevel+1, 2 -> H4)
          let rank = 0;
          let bestDiff = Infinity;
          for (let r = 0; r < distinctSizes.length; r++) {
            const diff = Math.abs(distinctSizes[r] - item.fontSizePt);
            if (diff < bestDiff) {
              bestDiff = diff;
              rank = r;
            }
          }
          item.finalLevel = Math.min(4, baseLevel + rank);
        } else {
          item.finalLevel = baseLevel;
        }
      }
    }

    // 3. Третий проход: заменяем кандидатов на <h2>, <h3> или <h4>
    for (const item of flowItems) {
      if (item.kind !== 'candidate') continue;
      const level = Math.min(4, Math.max(2, item.finalLevel || 2));
      const heading = item.node.ownerDocument.createElement(`h${level}`);
      heading.textContent = item.text;
      item.node.replaceWith(heading);
    }
  }

  /**
   * Распознаёт, является ли абзац <p> элементом «фальшивого» списка Microsoft Word
   * (при копировании через Ctrl+C Word отдаёт <p class="MsoListParagraph">·&nbsp;&nbsp;Текст</p>
   * вместо настоящих <ul><li> или <ol><li>).
   */
  function detectWordFakeListItem(el) {
    if (!el || el.nodeType !== 1 || el.tagName.toLowerCase() !== 'p') return null;

    const cls = el.getAttribute('class') || '';
    const style = el.getAttribute('style') || '';
    const isWordListMarked = /MsoList/i.test(cls) || /mso-list\s*:/i.test(style);

    const text = el.textContent || '';
    if (!text.trim()) return null;

    // 1. Нумерованный список Word: "1.   Текст" или "1)   Текст"
    const numMatch = text.match(/^[ \t\r\n\u00A0]*\d+[\.\)][ \t\r\n\u00A0]+/);
    if (numMatch) {
      const afterNum = numMatch[0].replace(/^[ \t\r\n\u00A0]*\d+[\.\)]/, '');
      if (isWordListMarked || /[\t\u00A0]/.test(afterNum) || afterNum.length >= 2) {
        return { type: 'ol', prefixLength: numMatch[0].length, strongSignal: true };
      }
      return { type: 'ol', prefixLength: numMatch[0].length, strongSignal: false };
    }

    // 2. Явные символы маркеров списка (Word Symbol ·, •, ▪, ●, ○, ◦, ‣, ⁃, ■, □, ◆, ◇, ❖, ➢, ➤)
    const strongBulletMatch = text.match(/^[ \t\r\n\u00A0]*[·•▪▫●○◦‣⁃■□◆◇❖➢➤][ \t\r\n\u00A0]+/);
    if (strongBulletMatch) {
      return { type: 'ul', prefixLength: strongBulletMatch[0].length, strongSignal: true };
    }

    // 3. Специфические маркеры Word вложенных уровней (o в Courier New, §/ü/þ/Ø в Wingdings) — только при MsoList
    if (isWordListMarked) {
      const wordSpecialBullet = text.match(/^[ \t\r\n\u00A0]*[o§üþØv][ \t\r\n\u00A0]+/);
      if (wordSpecialBullet) {
        return { type: 'ul', prefixLength: wordSpecialBullet[0].length, strongSignal: true };
      }
    }

    // 4. Дефис / тире в начале абзаца (- , – , — )
    const dashBulletMatch = text.match(/^[ \t\r\n\u00A0]*[-–—][ \t\r\n\u00A0]+/);
    if (dashBulletMatch) {
      const afterDash = dashBulletMatch[0].replace(/^[ \t\r\n\u00A0]*[-–—]/, '');
      if (isWordListMarked || /[\t\u00A0]{2,}/.test(afterDash) || afterDash.length >= 3) {
        return { type: 'ul', prefixLength: dashBulletMatch[0].length, strongSignal: true };
      }
      // Слабый сигнал: превращаем в список только если подряд 2+ таких абзаца (чтобы не ломать реплики диалогов)
      return { type: 'ul', prefixLength: dashBulletMatch[0].length, strongSignal: false };
    }

    // 5. Если Word пометил абзац как MsoList, но маркер уже отсутствует
    if (isWordListMarked) {
      return { type: 'ul', prefixLength: 0, strongSignal: true };
    }

    return null;
  }

  /**
   * Удаляет ровно count первых символов из ведущих текстовых узлов элемента,
   * не повреждая идущие следом теги <strong>, <em>, <a> и др.
   */
  function stripLeadingChars(element, count) {
    let remaining = count;
    function walk(node) {
      if (remaining <= 0) return;
      if (node.nodeType === 3 /* TEXT_NODE */) {
        const val = node.nodeValue || '';
        if (val.length <= remaining) {
          remaining -= val.length;
          node.nodeValue = '';
        } else {
          node.nodeValue = val.slice(remaining);
          remaining = 0;
        }
        return;
      }
      if (node.nodeType === 1 /* ELEMENT_NODE */) {
        const children = Array.from(node.childNodes);
        for (const ch of children) {
          walk(ch);
          if (remaining <= 0) break;
        }
      }
    }
    walk(element);
  }

  /**
   * Рекурсивно находит подряд идущие «фальшивые» пункты списков Word (<p>)
   * внутри контейнера и собирает их в настоящие <ul><li>...</li></ul> и <ol><li>...</li></ol>.
   */
  function convertWordFakeLists(container) {
    if (!container || container.nodeType !== 1) return;

    // Сначала рекурсивно обходим вложенные контейнеры (таблицы, ячейки, цитаты, div, обёртки)
    const initialChildren = Array.from(container.children);
    for (const ch of initialChildren) {
      const t = ch.tagName.toLowerCase();
      if (['div', 'td', 'th', 'blockquote', 'section', 'article', 'b', 'table', 'tbody', 'thead', 'tr'].includes(t)) {
        convertWordFakeLists(ch);
      }
    }

    // Собираем значимые дочерние узлы и группируем подряд идущие фальшивые пункты списков
    const doc = container.ownerDocument;
    const nodes = Array.from(container.childNodes);
    let i = 0;

    while (i < nodes.length) {
      const info = detectWordFakeListItem(nodes[i]);
      if (!info) {
        i++;
        continue;
      }

      // Собираем серию подряд идущих пунктов одного типа ('ul' или 'ol')
      const group = [];
      let hasStrongSignal = false;
      let j = i;

      while (j < nodes.length) {
        const cur = nodes[j];
        // Пробельные текстовые узлы между <p> не разрывают список
        if (cur.nodeType === 3 && !cur.nodeValue.trim()) {
          j++;
          continue;
        }
        const curInfo = detectWordFakeListItem(cur);
        if (curInfo && curInfo.type === info.type) {
          group.push({ el: cur, info: curInfo });
          if (curInfo.strongSignal) hasStrongSignal = true;
          j++;
        } else {
          break;
        }
      }

      // Преобразуем группу в <ul> / <ol>, если есть явный маркер Word ИЛИ минимум 2 пункта подряд
      if (hasStrongSignal || group.length >= 2) {
        const listEl = doc.createElement(info.type);
        const firstEl = group[0].el;
        container.insertBefore(listEl, firstEl);

        for (const item of group) {
          if (item.info.prefixLength > 0) {
            stripLeadingChars(item.el, item.info.prefixLength);
          }
          const li = doc.createElement('li');
          while (item.el.firstChild) {
            li.appendChild(item.el.firstChild);
          }
          listEl.appendChild(li);
          item.el.remove();
        }
      }

      i = j;
    }
  }

  /**
   * Рекурсивная функция очистки узла DOM
   */
  function cleanNode(node, opts) {
    if (!node) return;

    // Обходим дочерние узлы в обратном порядке (чтобы безопасно удалять элементы)
    const children = Array.from(node.childNodes);
    for (let i = children.length - 1; i >= 0; i--) {
      cleanNode(children[i], opts);
    }

    // Если это текстовый узел — схлопываем технические переносы строк из буфера Word (\r\n, \n, \t)
    // в обычный пробел (не трогая неразрывные пробелы \u00A0 и явные теги <br>)
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      if (node.nodeValue) {
        node.nodeValue = node.nodeValue
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/ {2,}/g, ' ');
      }
      return;
    }

    // Если это узел-элемент (тег)
    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const tagName = node.tagName.toLowerCase();

      // 1. Удаляем полностью запрещённые и служебные теги (скрипты, стили, мета)
      const FORBIDDEN_TAGS = ['script', 'style', 'meta', 'link', 'title', 'iframe', 'object', 'embed', 'applet', 'font', 'center', 'marquee', 'blink'];
      if (FORBIDDEN_TAGS.includes(tagName)) {
        // Если это устаревший презентационный тег (font, center) — сохраняем его текст
        if (['font', 'center', 'marquee', 'blink'].includes(tagName)) {
          unwrapNode(node);
        } else {
          node.remove();
        }
        return;
      }

      // 1.5. Сохраняем семантическое форматирование из inline-стилей (Google Docs, Word, Notion)
      // ДО того как удалим атрибут style и развернём <span>!
      const rawStyle = node.getAttribute('style') || '';

      // Google Docs оборачивает весь скопированный документ в <b style="font-weight:normal;">...</b>.
      // Если не развернуть этот тег, весь документ ошибочно станет жирным!
      if ((tagName === 'b' || tagName === 'strong') && /font-weight\s*:\s*(normal|400)\b/i.test(rawStyle)) {
        unwrapNode(node);
        return;
      }

      // Если <span> задаёт жирность, курсив, подчёркивание или зачёркивание через CSS —
      // переводим это в чистые HTML-теги <strong>, <em>, <u>, <s>
      if (tagName === 'span' && rawStyle) {
        const isBold = /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(rawStyle);
        const isItalic = /font-style\s*:\s*(italic|oblique)\b/i.test(rawStyle);
        const isInsideLink = typeof node.closest === 'function' && Boolean(node.closest('a'));
        const isUnderline = !isInsideLink && /text-decoration(?:-line)?\s*:[^;]*\bunderline\b/i.test(rawStyle);
        const isLineThrough = /text-decoration(?:-line)?\s*:[^;]*\bline-through\b/i.test(rawStyle);

        if (isBold || isItalic || isUnderline || isLineThrough) {
          wrapChildrenWithTag(node, isLineThrough ? 's' : null);
          wrapChildrenWithTag(node, isUnderline ? 'u' : null);
          wrapChildrenWithTag(node, isItalic ? 'em' : null);
          wrapChildrenWithTag(node, isBold ? 'strong' : null);
        }
      }

      // 2. Обработка <div> (из contenteditable, Gmail, Notion, Google Docs):
      // если внутри <div> есть блочные теги — это просто обёртка, разворачиваем её;
      // если внутри только текст/строчные теги — превращаем в обычный абзац <p>
      if (tagName === 'div') {
        const BLOCK_CHILD_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'div', 'hr'];
        const hasBlockChild = Array.from(node.children).some(ch =>
          BLOCK_CHILD_TAGS.includes(ch.tagName.toLowerCase())
        );
        if (hasBlockChild) {
          unwrapNode(node);
          return;
        }
        // Пустой div (например с одним <br>) удаляем
        const divText = node.textContent.replace(/[\s\u00A0]+/g, '');
        if (divText.length === 0) {
          node.remove();
          return;
        }
        const pNode = renameElement(node, 'p');
        cleanNode(pNode, opts);
        return;
      }

      // 3. Удаляем паразитные абзацы, содержащие только символы Markdown-разметки (<p>##</p> или <p>**</p>)
      // (Распознавание заголовков H2–H4 по жирному начертанию выполняется после полной очистки в promoteBoldHeadings)
      if (tagName === 'p') {
        const textOnly = node.textContent.trim();
        if (/^#{1,6}$/.test(textOnly) || /^(\*\*|__)$/.test(textOnly)) {
          node.remove();
          return;
        }
      }

      // 4. Строгий «белый список» атрибутов (удаляем ВСЁ лишнее: valign, width, bgcolor,
      // border, cellpadding, cellspacing, class, id, style, dir, lang, data-*, on* и т.д.)
      if (tagName === 'a') {
        const href = (node.getAttribute('href') || '').trim();
        // Защита: удаляем опасные ссылки javascript:...
        if (/^javascript:/i.test(href) || !href || href === '#') {
          unwrapNode(node);
          return;
        }
        // На ссылках сохраняем ТОЛЬКО href
        const safeHref = node.getAttribute('href');
        Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
        node.setAttribute('href', safeHref);
      } else if (tagName === 'td' || tagName === 'th') {
        // На ячейках таблиц сохраняем ТОЛЬКО colspan и rowspan (если они > 1)
        const colspan = parseInt(node.getAttribute('colspan'), 10);
        const rowspan = parseInt(node.getAttribute('rowspan'), 10);
        Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
        if (colspan > 1) node.setAttribute('colspan', String(colspan));
        if (rowspan > 1) node.setAttribute('rowspan', String(rowspan));
      } else if (tagName === 'img') {
        const src = (node.getAttribute('src') || '').trim();
        const alt = node.getAttribute('alt');
        Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
        if (src && !/^javascript:/i.test(src)) node.setAttribute('src', src);
        if (alt !== null) node.setAttribute('alt', alt);
      } else {
        // На всех остальных тегах (table, tr, p, h1-h6, ul, ol, li, strong, em, u, s, blockquote)
        // удаляем все атрибуты (style остаётся только если обе галочки очистки выключены)
        Array.from(node.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === 'style' && !opts.cleanFonts && !opts.cleanIndents) {
            return;
          }
          node.removeAttribute(attr.name);
        });
      }

      // 7.5. Внутри ячейки таблицы (<td>, <th>) и пункта списка (<li>) убираем лишнюю обёртку <p>,
      // если внутри ровно один абзац (без других абзацев, списков или цитат).
      // Если абзацев 2 и более (или есть список/цитата) — теги <p> сохраняем.
      if (tagName === 'td' || tagName === 'th' || tagName === 'li') {
        const meaningfulChildren = Array.from(node.childNodes).filter(child => {
          if (child.nodeType === 3 /* Node.TEXT_NODE */) {
            return child.nodeValue.trim().length > 0;
          }
          return true;
        });

        if (
          meaningfulChildren.length === 1 &&
          meaningfulChildren[0].nodeType === 1 &&
          meaningfulChildren[0].tagName.toLowerCase() === 'p'
        ) {
          Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 3 && child.nodeValue.trim().length === 0) {
              child.remove();
            }
          });
          unwrapNode(meaningfulChildren[0]);
        }
      }

      // 8. Разворачивание пустых обёрток <span>
      if (tagName === 'span') {
        unwrapNode(node);
        return;
      }

      // 9. Нормализация тегов начертания: <b> -> <strong>, <i> -> <em>, <strike>/<del> -> <s>
      if (tagName === 'b') {
        node = renameElement(node, 'strong');
      } else if (tagName === 'i') {
        node = renameElement(node, 'em');
      } else if (tagName === 'strike') {
        node = renameElement(node, 's');
      }

      // Убираем дублирующую вложенность (например <strong><strong>текст</strong></strong>)
      const normalizedTag = node.tagName.toLowerCase();
      if (['strong', 'em', 'u', 's'].includes(normalizedTag) &&
          node.parentNode && node.parentNode.nodeType === 1 &&
          node.parentNode.tagName.toLowerCase() === normalizedTag) {
        unwrapNode(node);
        return;
      }

      // 10. Очистка красной строки и начальных пробелов (opt-clean-indents)
      if (opts.cleanIndents && ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(normalizedTag)) {
        trimLeadingIndents(node);
      }

      // 11. Удаление пустых тегов
      // Теги вроде <p></p>, <strong></strong>, <em></em>, <u></u>, не несущие текста.
      // Пустые ячейки <td>/<th> НЕ удаляем, чтобы не сместить столбцы таблицы.
      const CAN_BE_EMPTY_SAFELY = ['br', 'hr', 'img', 'input', 'td', 'th'];
      if (!CAN_BE_EMPTY_SAFELY.includes(normalizedTag)) {
        const textContent = node.textContent.replace(/[\s\u00A0]+/g, '');
        const hasMedia = node.querySelector('img, video, audio, table');
        if (textContent.length === 0 && !hasMedia) {
          node.remove();
          return;
        }
      }
    }
  }

  /**
   * Оборачивает все дочерние узлы элемента в новый тег (например <strong> или <em>)
   */
  function wrapChildrenWithTag(element, tagName) {
    if (!tagName) return;
    const doc = element.ownerDocument;
    const wrapper = doc.createElement(tagName);
    while (element.firstChild) {
      wrapper.appendChild(element.firstChild);
    }
    element.appendChild(wrapper);
  }

  /**
   * Заменяет узел его дочерними элементами (убирает тег-обёртку)
   */
  function unwrapNode(node) {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    node.remove();
  }

  /**
   * Переименовывает тег (например <b> в <strong>)
   */
  function renameElement(element, newTagName) {
    const doc = element.ownerDocument;
    const newElement = doc.createElement(newTagName);
    if (typeof element._detectedFontSizePt === 'number') {
      newElement._detectedFontSizePt = element._detectedFontSizePt;
    }
    while (element.firstChild) {
      newElement.appendChild(element.firstChild);
    }
    element.replaceWith(newElement);
    return newElement;
  }

  /**
   * Удаляет начальные и конечные пробелы, табуляции, неразрывные пробелы и пустые <br>
   * у текстового блока (ликвидация «красной строки» и висячих пробелов из Word)
   */
  function trimLeadingIndents(element) {
    // 1. Убираем ведущие пробелы и пустые <br> в начале блока
    let walker = element.ownerDocument.createTreeWalker(
      element,
      1 /* NodeFilter.SHOW_ELEMENT */ | 4 /* NodeFilter.SHOW_TEXT */
    );

    const allNodes = [];
    let current = walker.nextNode();
    while (current) {
      allNodes.push(current);
      current = walker.nextNode();
    }

    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      if (!node.parentNode) continue;
      if (node.nodeType === 3 /* Node.TEXT_NODE */) {
        node.nodeValue = node.nodeValue.replace(/^[ \t\u00A0]+/, '');
        if (node.nodeValue.length > 0) break;
      } else if (node.nodeType === 1 && node.tagName.toLowerCase() === 'br') {
        node.remove();
      }
    }

    // 2. Убираем висячие пробелы и пустые <br> в конце блока
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const node = allNodes[i];
      if (!node.parentNode) continue;
      if (node.nodeType === 3 /* Node.TEXT_NODE */) {
        node.nodeValue = node.nodeValue.replace(/[ \t\u00A0]+$/, '');
        if (node.nodeValue.length > 0) break;
      } else if (node.nodeType === 1 && node.tagName.toLowerCase() === 'br') {
        node.remove();
      }
    }
  }

  /**
   * Запасная строковая очистка регулярными выражениями (для тестовых сред без полного DOM)
   */
  function fallbackCleanRegex(html, opts) {
    let res = html;
    if (opts.cleanFonts) {
      res = res.replace(/\s*style="[^"]*"/gi, '');
      res = res.replace(/<\/?font[^>]*>/gi, '');
    }
    res = res.replace(/\s*class="[^"]*"/gi, '');
    res = res.replace(/\s*id="[^"]*"/gi, '');
    res = res.replace(/<\/?span[^>]*>/gi, '');

    // Обезвреживаем опасные javascript-ссылки (разворачиваем в чистый текст)
    res = res.replace(/<a\s+[^>]*href=["']javascript:[^"']*["'][^>]*>(.*?)<\/a>/gi, '$1');
    // Очищаем оставшиеся теги <a> от любых посторонних атрибутов (style, target, id), сохраняя только href
    res = res.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
      const hrefMatch = attrs.match(/href=(["'][^"']*["'])/i);
      return hrefMatch ? `<a href=${hrefMatch[1]}>` : '<a>';
    });

    res = res.replace(/<b>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
    res = res.replace(/<i>/gi, '<em>').replace(/<\/i>/gi, '</em>');
    if (opts.cleanIndents) {
      res = res.replace(/<p>[ \t\u00A0]+/gi, '<p>');
      res = res.replace(/<li>[ \t\u00A0]+/gi, '<li>');
    }
    // Удаляем пустые теги в цикле (чтобы удалить <p><strong></strong></p> и паразитные <p>##</p>)
    let prev = '';
    while (prev !== res) {
      prev = res;
      res = res.replace(/<p>[\s\u00A0]*(#{1,6}|\*\*|__)[\s\u00A0]*<\/p>/gi, '');
      res = res.replace(/<p>[\s\u00A0]*(&nbsp;)*[\s\u00A0]*<\/p>/gi, '');
      res = res.replace(/<([a-z0-9]+)[^>]*>[\s\u00A0]*(&nbsp;)*[\s\u00A0]*<\/\1>/gi, (match, tag) => {
        if (['br', 'hr', 'img'].includes(tag.toLowerCase())) return match;
        return '';
      });
    }
    return formatHtmlLines(res);
  }

  // ==========================================================================
  // 6. ТИПОГРАФИКА (TYPOGRAF + ВСТРОЕННЫЙ FALLBACK)
  // ==========================================================================

  /**
   * Применяет правила типографики:
   * Если доступна библиотека Typograf — использует её.
   * Если библиотека недоступна (например, оффлайн) — использует встроенный движок типографики.
   * 
   * @param {string} html — HTML-код
   * @param {object} options — настройки
   * @returns {string} — типографированный HTML
   */
  Text2Html.applyTypography = function (html, options) {
    if (!html || !html.trim()) return '';
    const opts = resolveOptions(options);

    if (!opts.typography) {
      return html;
    }

    // Проверяем наличие библиотеки Typograf
    const TypografLib = typeof Typograf !== 'undefined' ? Typograf : (global.Typograf || null);
    let result = html;

    if (TypografLib) {
      try {
        const tp = new TypografLib({
          locale: ['ru', 'en-US'],
          htmlEntity: { type: 'name' } // Генерирует читаемые &nbsp; вместо невидимых спецсимволов
        });

        // Настройка безопасного выполнения по HTML
        result = tp.execute(html);
      } catch (e) {
        console.warn('Ошибка выполнения Typograf, переключаемся на встроенный модуль:', e);
        result = builtInTypography(html);
      }
    } else {
      result = builtInTypography(html);
    }

    // Защита многозначных чисел и валют:
    // склеиваем группы разрядов чисел (1 780 000 -> 1&nbsp;780&nbsp;000),
    // знаки валют (1 780 000&nbsp;₽) и единицы измерения (1,5&nbsp;млн),
    // чтобы число ни при каких условиях не разрывалось при переносе строки.
    result = protectNumbersAndCurrencies(result);

    return result;
  };

  /**
   * Преобразует дефис между числами в среднее тире (2020-2025 -> 2020–2025),
   * не затрагивая URL, многосоставные даты (2026-11-25) и телефонные номера.
   */
  function replaceNumericRanges(text) {
    if (!text) return '';
    return text.replace(
      /(https?:\/\/[^\s<]+)|(^|[^\dA-Za-zА-Яа-яЁё_-])(\d{1,4})\s*-\s*(\d{1,4})(?=[^\dA-Za-zА-Яа-яЁё_-]|$)/g,
      (match, url, prefix, num1, num2) => {
        if (url) return url;
        return `${prefix}${num1}–${num2}`;
      }
    );
  }

  /**
   * Защищает разряды многозначных чисел и привязывает валюты к числу:
   * 1 780 000 -> 1&nbsp;780&nbsp;000
   * 180 000 ₽ -> 180&nbsp;000&nbsp;₽
   * 1,5 млн -> 1,5&nbsp;млн
   */
  function protectNumbersAndCurrencies(html) {
    if (!html) return '';
    const parts = html.split(/(<[^>]+>)/g);

    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('<')) continue;
      let t = parts[i];
      if (!t) continue;

      // 0. Короткое тире в числовых диапазонах (2020-2025 -> 2020–2025)
      t = replaceNumericRanges(t);

      // 1. Разряды чисел: заменяем пробелы между группами по 3 цифры на неразрывные
      // Например: 1 780 000 -> 1&nbsp;780&nbsp;000
      t = t.replace(/\b\d{1,3}(?:[ \u00A0]\d{3})+\b/g, (match) => {
        return match.replace(/[ \u00A0]+/g, '&nbsp;');
      });

      // 2. Число и знак валюты (₽, $, €, ¥, £, ₸) или проценты (%, ‰)
      t = t.replace(/(\d)\s+([₽$€¥£₸%‰])(?=[\s,.:;!?)]|$)/gu, '$1&nbsp;$2');

      // 3. Число и единицы измерения / сокращения (руб, коп, млн, млрд, тыс, кг, шт, м, см, г.)
      t = t.replace(/(\d+)\s+([а-яёa-z]{1,5}\.?)(?=[\s,.:;!?)]|$)/gi, '$1&nbsp;$2');

      parts[i] = t;
    }

    return parts.join('');
  }

  /**
   * Встроенный алгоритм базовой типографики:
   * Безопасно обрабатывает ТОЛЬКО текстовые фрагменты вне HTML-тегов.
   */
  function builtInTypography(html) {
    // Разбиваем HTML на теги и текст: чётные элементы — текст, нечётные — теги
    const parts = html.split(/(<[^>]+>)/g);

    for (let i = 0; i < parts.length; i++) {
      // Если это HTML-тег (начинается с <) — пропускаем его, чтобы не сломать атрибуты!
      if (parts[i].startsWith('<')) {
        continue;
      }

      let t = parts[i];
      if (!t) continue;

      // Нормализуем экранированные кавычки &quot; обратно в "
      t = t.replace(/&quot;/g, '"');

      // 1. Кавычки «ёлочки»
      // Заменяем парные прямые кавычки "..." на «...»
      t = t.replace(/(^|[\s(\[«])"([^"]+?)"([,.:;!?\s)\]»]|$)/g, '$1«$2»$3');
      // Вторичная замена оставшихся открывающих и закрывающих кавычек
      t = t.replace(/(^|[\s(«])"/g, '$1«');
      t = t.replace(/"([,.:;!?\s»)]|$)/g, '»$1');

      // Вложенные кавычки: заменяем внутренние «...» на „...“
      t = t.replace(/«([^»]*?)«([^»]+?)»/g, '«$1„$2“');

      // 2. Многоточие (... -> …)
      t = t.replace(/\.{3}/g, '…');

      // 3. Длинное тире (слово - слово -> слово — слово)
      t = t.replace(/(\s)-(\s)/g, '$1—$2');
      t = t.replace(/(\s)--(\s)/g, '$1—$2');

      // 4. Короткое тире в числовых диапазонах (2020-2025 -> 2020–2025)
      t = replaceNumericRanges(t);

      // 5. Неразрывный пробел после коротких предлогов и союзов
      const prepRegex = new RegExp(`(^|[\\s(«])(${RU_PREPOSITIONS.join('|')})\\s+`, 'gi');
      t = t.replace(prepRegex, '$1$2&nbsp;');

      // 6. Неразрывный пробел перед частицами (бы, ли, же)
      t = t.replace(/\s+(ли|же|бы|ка)(?=[\s,.:;!?)]|$)/gi, '&nbsp;$1');

      // 7. Неразрывный пробел между числом и единицей измерения / словом (10 руб, 2026 г., 15 кг)
      t = t.replace(/(\d+)\s+([а-яёa-z]{1,4}\.?)(?=[\s,.:;!?)]|$)/gi, '$1&nbsp;$2');

      // 8. Удаление повторяющихся обычных пробелов
      t = t.replace(/[ \t]{2,}/g, ' ');

      parts[i] = t;
    }

    return parts.join('');
  }

  // ==========================================================================
  // 7. ПОСТРОЧНОЕ ФОРМАТИРОВАНИЕ ДЛЯ CMS (PRETTY-PRINT)
  // ==========================================================================

  /**
   * Форматирует HTML так, чтобы каждый блочный тег (<p>, <h2>, <ul>, <li>)
   * находился на своей строке с аккуратными отступами.
   * Идеально для вставки в WordPress, Битрикс, Tilda и чтения человеком.
   * 
   * @param {string} html — сырой HTML
   * @returns {string} — красиво отформатированный фрагмент
   */
  function formatHtmlLines(html) {
    if (!html) return '';

    // Нормализуем пробелы между тегами
    let formatted = html.trim();

    // 1. Убираем случайные переносы строк и лишние пробелы между структурными/блочными тегами
    // (при этом пробелы между строчными тегами вроде </strong> <em> сохраняются!)
    formatted = formatted.replace(/>\s*\n\s*</g, '><');
    formatted = formatted.replace(
      /(<\/?(?:table|thead|tbody|tr|td|th|ul|ol|li|p|h[1-6]|blockquote)(?=[\s>])[^>]*>)[ \t]+(?=<\/?(?:table|thead|tbody|tr|td|th|ul|ol|li|p|h[1-6]|blockquote)(?=[\s>]))/gi,
      '$1'
    );

    // 2. Блочные теги, перед которыми ВСЕГДА должна быть новая строка
    const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'div'];

    for (const tag of BLOCK_TAGS) {
      // Новая строка перед открывающим тегом (?=[\s>] проверяет границу имени тега, чтобы <p> не совпал с <pre>)
      const openRegex = new RegExp(`(<${tag}(?=[\\s>])[^>]*>)`, 'gi');
      formatted = formatted.replace(openRegex, '\n$1');

      // Новая строка после закрывающего тега
      const closeRegex = new RegExp(`(</${tag}>)`, 'gi');
      formatted = formatted.replace(closeRegex, '$1\n');
    }

    // 3. Форматируем элементы списков <li> и ячейки таблиц <td>/<th> (отступ в 2 пробела)
    // Важно: (?=[\s>]) не даёт <th> случайно зацепить <thead>, а $1 сохраняет атрибуты (например colspan)
    formatted = formatted.replace(/(<li(?=[\s>])[^>]*>)/gi, '\n  $1');
    formatted = formatted.replace(/<\/li>/gi, '</li>');

    formatted = formatted.replace(/(<(?:td|th)(?=[\s>])[^>]*>)/gi, '\n  $1');
    formatted = formatted.replace(/\s*<\/(tr|table|thead|tbody)>/gi, '\n</$1>');

    // Перенос строки перед закрывающим </ul> и </ol>
    formatted = formatted.replace(/\s*<\/(ul|ol)>/gi, '\n</$1>');

    // 4. Очищаем лишние пустые строки (более двух подряд)
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();

    return formatted;
  }

  Text2Html.formatHtml = formatHtmlLines;

  // ==========================================================================
  // 8. ГЛАВНЫЕ МЕТОДЫ ОБРАБОТКИ (PIPELINE)
  // ==========================================================================

  /**
   * Безопасно подготавливает HTML из буфера обмена (Word, Google Docs, браузер)
   * для вставки в поле ввода, СОХРАНЯЯ всё визуальное форматирование
   * (жирный, курсив, цвета, заголовки, списки, таблицы, ссылки),
   * но удаляя опасные или ломающие страницу теги (<script>, <style>, <meta>, комментарии Word).
   * 
   * @param {string} rawHtml — HTML из буфера обмена (clipboardData)
   * @returns {string} — безопасный HTML с сохранённым исходным оформлением
   */
  Text2Html.sanitizeForEditor = function (rawHtml) {
    if (!rawHtml || !rawHtml.trim()) return '';

    let clean = rawHtml
      .replace(/<\?xml[^>]*>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
      .replace(/<!\[if[\s\S]*?\]>/gi, '')
      .replace(/<!\[endif\]>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?[a-z0-9]+:[a-z0-9]+[^>]*>/gi, '');

    if (typeof DOMParser === 'undefined') {
      return clean
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');
    const body = doc.body;

    // Удаляем теги, которые могут сломать стили/скрипты нашей страницы
    const DANGEROUS_TAGS = ['script', 'style', 'meta', 'link', 'title', 'iframe', 'object', 'embed', 'applet', 'base'];
    DANGEROUS_TAGS.forEach(tag => {
      body.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Убираем опасные обработчики событий и фиксированную ширину таблиц (чтобы не распирали колонку)
    body.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });

      if (el.tagName.toLowerCase() === 'a') {
        const href = (el.getAttribute('href') || '').trim();
        if (/^javascript:/i.test(href)) {
          el.removeAttribute('href');
        }
      }

      if (el.tagName.toLowerCase() === 'table') {
        el.removeAttribute('width');
        if (el.style) {
          el.style.width = '';
          el.style.maxWidth = '100%';
        }
      }
    });

    return body.innerHTML;
  };

  /**
   * Полный цикл обработки готового форматированного HTML (вставленного из Word, Google Docs и др.):
   * HTML -> Очистка (сохраняя жирный, курсив, списки, таблицы, ссылки) -> Типографика -> Красивый HTML
   * 
   * @param {string} rawHtml — HTML из поля ввода с сохранением форматирования
   * @param {object} options — опции
   * @returns {string} — итоговый чистый HTML для CMS
   */
  Text2Html.processHtml = function (rawHtml, options) {
    const opts = resolveOptions(options);

    // 1. Очищаем разметку от мусора редакторов, шрифтов, цветов и красной строки
    const cleanedHtml = Text2Html.cleanHtml(rawHtml, opts);

    // 2. Применяем типографику
    const typographedHtml = Text2Html.applyTypography(cleanedHtml, opts);

    // 3. Финальное построчное форматирование
    return Text2Html.formatHtml(typographedHtml);
  };

  /**
   * Полный цикл обработки обычного текста:
   * Текст -> HTML -> Очистка -> Типографика -> Красивый HTML
   * 
   * @param {string} rawText — текст от пользователя
   * @param {object} options — опции (cleanIndents, cleanFonts, detectHeadings, typography)
   * @returns {string} — итоговый чистый HTML для CMS
   */
  Text2Html.processText = function (rawText, options) {
    const opts = resolveOptions(options);

    // 1. Превращаем текст в базовые теги (<p>, списки, заголовки)
    const rawHtml = Text2Html.rawTextToHtml(rawText, opts);

    // 2. Очищаем разметку
    const cleanedHtml = Text2Html.cleanHtml(rawHtml, opts);

    // 3. Применяем типографику (кавычки «», тире —, неразрывные пробелы)
    const typographedHtml = Text2Html.applyTypography(cleanedHtml, opts);

    // 4. Финальное построчное форматирование
    return Text2Html.formatHtml(typographedHtml);
  };

  /**
   * Полный цикл обработки файла DOCX:
   * DOCX (ArrayBuffer) -> mammoth.js -> HTML -> Очистка -> Типографика -> Красивый HTML
   * 
   * @param {ArrayBuffer} arrayBuffer — бинарные данные docx
   * @param {object} options — опции
   * @returns {Promise<string>} — итоговый чистый HTML для CMS
   */
  Text2Html.processDocx = async function (arrayBuffer, options) {
    const opts = resolveOptions(options);

    // 1. Читаем DOCX через mammoth.js
    const rawHtml = await Text2Html.docxToHtml(arrayBuffer, opts);

    // 2. Очищаем разметку от Word-мусора, шрифтов и красной строки
    const cleanedHtml = Text2Html.cleanHtml(rawHtml, opts);

    // 3. Применяем типографику
    const typographedHtml = Text2Html.applyTypography(cleanedHtml, opts);

    // 4. Финальное построчное форматирование
    return Text2Html.formatHtml(typographedHtml);
  };

  // Экспорт для браузера (window.Text2Html) и для Node.js / тестов
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Text2Html;
  } else {
    global.Text2Html = Text2Html;
  }

})(typeof window !== 'undefined' ? window : globalThis);
