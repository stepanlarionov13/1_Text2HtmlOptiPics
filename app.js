/**
 * ==========================================================================
 * Text2Html + OptiPics — Основной JavaScript приложения (Этап 2)
 * Управление интерфейсом, связывание модулей и обработка событий
 * ==========================================================================
 * 
 * ПОЯСНЕНИЕ ДЛЯ НАЧИНАЮЩИХ:
 * Этот файл — "дирижёр" нашего веб-приложения:
 * 1. Слушает клики по кнопкам, ввод текста и перетаскивание файлов.
 * 2. Передаёт введённый текст или DOCX в модуль `text2html.js` на обработку.
 * 3. Выводит готовый чистый HTML в текстовое поле и область предпросмотра.
 * 4. Управляет копированием кода в буфер обмена одной кнопкой.
 * 5. Показывает понятные подсказки, предупреждения и сообщения об ошибках.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Инициализация Text2Html + OptiPics (Этап 2: Текст → HTML)...');

  // ==========================================================================
  // 1. УПРАВЛЕНИЕ ГЛАВНЫМИ ВКЛАДКАМИ ("Текст в HTML" и "Оптимизация изображений")
  // ==========================================================================

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  /**
   * Переключение между вкладками сервиса
   * @param {string} targetTabId — ID панели (например, 'tab-text' или 'tab-images')
   */
  function switchTab(targetTabId) {
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });

    tabPanes.forEach(pane => {
      pane.classList.remove('active');
    });

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${targetTabId}"]`);
    const activePane = document.getElementById(targetTabId);

    if (activeBtn && activePane) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-selected', 'true');
      activePane.classList.add('active');
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTabId = button.getAttribute('data-tab');
      switchTab(targetTabId);
    });

    // Навигация стрелками клавиатуры
    button.addEventListener('keydown', (e) => {
      let targetBtn = null;
      if (e.key === 'ArrowRight') {
        targetBtn = button.nextElementSibling || tabButtons[0];
      } else if (e.key === 'ArrowLeft') {
        targetBtn = button.previousElementSibling || tabButtons[tabButtons.length - 1];
      }

      if (targetBtn && targetBtn.classList.contains('tab-btn')) {
        targetBtn.focus();
        targetBtn.click();
      }
    });
  });


  // ==========================================================================
  // 2. СИСТЕМА УВЕДОМЛЕНИЙ И СООБЩЕНИЙ ПОЛЬЗОВАТЕЛЮ (STATUS BANNERS)
  // ==========================================================================

  const textStatusBanner = document.getElementById('text-status-banner');
  let statusTimeoutId = null;

  /**
   * Отображает цветное сообщение над рабочей областью
   * @param {string} message — текст сообщения
   * @param {'success'|'error'|'warning'|'info'} type — тип сообщения
   * @param {number} autoHideMs — через сколько мс скрыть (0 — не скрывать)
   */
  function showStatus(message, type = 'info', autoHideMs = 6000) {
    if (!textStatusBanner) return;

    if (statusTimeoutId) {
      clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }

    // Иконки для каждого типа сообщения
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    textStatusBanner.className = `status-banner status-${type}`;
    textStatusBanner.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
    textStatusBanner.classList.remove('hidden');

    if (autoHideMs > 0) {
      statusTimeoutId = setTimeout(() => {
        hideStatus();
      }, autoHideMs);
    }
  }

  /**
   * Скрывает плашку с сообщением
   */
  function hideStatus() {
    if (!textStatusBanner) return;
    textStatusBanner.classList.add('hidden');
    textStatusBanner.textContent = '';
  }


  // ==========================================================================
  // 3. ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ВВОДА: ТЕКСТ ИЛИ ФАЙЛ
  // ==========================================================================

  const btnModeText = document.getElementById('btn-input-mode-text');
  const btnModeFile = document.getElementById('btn-input-mode-file');
  const modeTextBox = document.getElementById('mode-text-box');
  const modeFileBox = document.getElementById('mode-file-box');

  // Хранит текущий активный режим: 'text' (вставка) или 'file' (загрузка)
  let currentInputMode = 'text';

  // Хранит выбранный пользователем файл DOCX / TXT
  let currentSelectedFile = null;

  if (btnModeText && btnModeFile && modeTextBox && modeFileBox) {
    btnModeText.addEventListener('click', () => {
      currentInputMode = 'text';
      btnModeText.classList.add('active');
      btnModeFile.classList.remove('active');
      modeTextBox.classList.remove('hidden');
      modeFileBox.classList.add('hidden');
    });

    btnModeFile.addEventListener('click', () => {
      currentInputMode = 'file';
      btnModeFile.classList.add('active');
      btnModeText.classList.remove('active');
      modeFileBox.classList.remove('hidden');
      modeTextBox.classList.add('hidden');
    });
  }


  // ==========================================================================
  // 4. ПЕРЕКЛЮЧЕНИЕ ПРОСМОТРА РЕЗУЛЬТАТА: "HTML-КОД" ИЛИ "ПРЕДПРОСМОТР"
  // ==========================================================================

  const btnViewCode = document.getElementById('btn-view-code');
  const btnViewPreview = document.getElementById('btn-view-preview');
  const viewCodeBox = document.getElementById('view-code-box');
  const viewPreviewBox = document.getElementById('view-preview-box');

  if (btnViewCode && btnViewPreview && viewCodeBox && viewPreviewBox) {
    btnViewCode.addEventListener('click', () => {
      btnViewCode.classList.add('active');
      btnViewPreview.classList.remove('active');
      viewCodeBox.classList.remove('hidden');
      viewPreviewBox.classList.add('hidden');
    });

    btnViewPreview.addEventListener('click', () => {
      btnViewPreview.classList.add('active');
      btnViewCode.classList.remove('active');
      viewPreviewBox.classList.remove('hidden');
      viewCodeBox.classList.add('hidden');
    });
  }


  // ==========================================================================
  // 5. ПОЛЕ ВВОДА ТЕКСТА (С СОХРАНЕНИЕМ ФОРМАТИРОВАНИЯ) И СЧЁТЧИКИ
  // ==========================================================================

  const rawTextInput = document.getElementById('raw-text-input');
  const statChars = document.getElementById('stat-chars');
  const statWords = document.getElementById('stat-words');

  // Флаг: вставлялся ли форматированный HTML из Word / Google Docs / браузера
  let hasPastedRichHtml = false;

  /**
   * Возвращает обычный текст из поля ввода (для счётчика слов и Markdown-режима)
   */
  function getEditorPlainText() {
    if (!rawTextInput) return '';
    return (rawTextInput.innerText || rawTextInput.textContent || '').trim();
  }

  /**
   * Возвращает HTML-содержимое поля ввода (со всем вставленным форматированием)
   */
  function getEditorHtml() {
    if (!rawTextInput) return '';
    return rawTextInput.innerHTML || '';
  }

  /**
   * Проверяет, пустое ли поле ввода
   */
  function isEditorEmpty() {
    if (!rawTextInput) return true;
    const text = (rawTextInput.innerText || rawTextInput.textContent || '').trim();
    const hasTableOrMedia = Boolean(rawTextInput.querySelector('table, img'));
    return text.length === 0 && !hasTableOrMedia;
  }

  /**
   * Очищает поле ввода и возвращает подсказку (placeholder)
   */
  function clearEditor() {
    if (!rawTextInput) return;
    rawTextInput.innerHTML = '';
    hasPastedRichHtml = false;
  }

  /**
   * Безопасно вставляет HTML в текущую позицию курсора внутри contenteditable
   * (сохраняя поддержку отмены Ctrl+Z)
   */
  function insertHtmlAtCursor(html) {
    if (!rawTextInput) return;
    rawTextInput.focus();

    let inserted = false;
    try {
      if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
        inserted = document.execCommand('insertHTML', false, html);
      }
    } catch (err) {
      inserted = false;
    }

    if (!inserted) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(html);
        const lastNode = fragment.lastChild;
        range.insertNode(fragment);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else {
        rawTextInput.innerHTML += html;
      }
    }
  }

  /**
   * Определяет, нужно ли обрабатывать содержимое поля как форматированный HTML
   * (из Word, Google Docs, Notion, браузера) или как обычный текст / Markdown
   */
  function shouldProcessAsRichHtml() {
    if (!rawTextInput) return false;

    // 1. Есть ли явные теги форматирования (жирный, курсив, списки, ссылки, заголовки, таблицы)
    const richTagsSelector = 'h1, h2, h3, h4, h5, h6, strong, b, em, i, u, s, strike, del, ul, ol, li, a, table, blockquote';
    if (rawTextInput.querySelector(richTagsSelector)) {
      return true;
    }

    // 2. Есть ли <span> с CSS-жирностью, курсивом или подчёркиванием (как в Google Docs)
    const styledSpans = rawTextInput.querySelectorAll('span[style]');
    for (const span of styledSpans) {
      const st = span.getAttribute('style') || '';
      if (
        /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(st) ||
        /font-style\s*:\s*(italic|oblique)\b/i.test(st) ||
        /text-decoration(?:-line)?\s*:[^;]*\b(underline|line-through)\b/i.test(st)
      ) {
        return true;
      }
    }

    // 3. Если вставляли HTML из редактора (например, абзацы <p> без выделений),
    // но текст НЕ является сырой разметкой Markdown (# Заголовок, * список) — чистим как HTML
    if (hasPastedRichHtml) {
      const plain = getEditorPlainText();
      const looksLikeRawMarkdown = /^(#{1,6}\s+|[-*+]\s+|\d+\.\s+)/m.test(plain);
      if (!looksLikeRawMarkdown && rawTextInput.querySelector('p')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Обновляет индикаторы количества символов и слов
   * @param {string} text — текст для подсчёта
   */
  function updateTextStats(text) {
    if (!statChars || !statWords) return;
    const str = text || '';
    statChars.textContent = str.length;

    // Считаем слова, разбивая по пробелам и переносам строк
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    statWords.textContent = words;
  }

  if (rawTextInput) {
    // При вставке из буфера обмена (Ctrl+V) сохраняем ВСЁ исходное форматирование
    // (жирный, курсив, списки, таблицы, ссылки, заголовки, цвета)
    rawTextInput.addEventListener('paste', (e) => {
      const clipboard = e.clipboardData || window.clipboardData;
      if (!clipboard) return;

      const pastedHtml = clipboard.getData('text/html');
      if (pastedHtml && typeof Text2Html !== 'undefined' && typeof Text2Html.sanitizeForEditor === 'function') {
        e.preventDefault();
        const safeRichHtml = Text2Html.sanitizeForEditor(pastedHtml);
        insertHtmlAtCursor(safeRichHtml);
        hasPastedRichHtml = true;
        updateTextStats(getEditorPlainText());
      } else {
        setTimeout(() => {
          updateTextStats(getEditorPlainText());
        }, 0);
      }
    });

    rawTextInput.addEventListener('input', () => {
      // Убираем «висячий» <br>, если поле очищено вручную — чтобы вернулась подсказка
      if (isEditorEmpty()) {
        rawTextInput.innerHTML = '';
        hasPastedRichHtml = false;
      }
      updateTextStats(getEditorPlainText());
    });
  }


  // ==========================================================================
  // 6. ЗАГРУЗКА И ВАЛИДАЦИЯ ФАЙЛОВ DOCX (DRAG & DROP И ВЫБОР)
  // ==========================================================================

  const textFileInput = document.getElementById('text-file-input');
  const textFileDropzone = document.getElementById('text-file-dropzone');
  const textFileInfo = document.getElementById('text-file-info');

  /**
   * Отрисовывает карточку выбранного файла с кнопкой удаления
   * @param {File} file — объект файла
   */
  function renderSelectedFile(file) {
    currentSelectedFile = file;
    textFileInput.value = ''; // Сбрасываем значение input, чтобы можно было выбрать тот же файл снова

    if (!textFileInfo) return;

    const sizeKb = (file.size / 1024).toFixed(1);
    textFileInfo.className = 'selected-file-info';
    textFileInfo.innerHTML = `
      <div class="selected-file-card">
        <div class="file-meta-group">
          <span class="file-card-icon">📄</span>
          <div>
            <div class="file-card-name" title="${escapeString(file.name)}">${escapeString(file.name)}</div>
            <div class="file-card-size">${sizeKb} КБ</div>
          </div>
        </div>
        <button type="button" class="btn-remove-file" id="btn-remove-selected-file" title="Убрать этот файл">✕</button>
      </div>
    `;
    textFileInfo.classList.remove('hidden');

    // Кнопка удаления файла из карточки
    const btnRemove = document.getElementById('btn-remove-selected-file');
    if (btnRemove) {
      btnRemove.addEventListener('click', (e) => {
        e.stopPropagation(); // Не открывать окно выбора файлов при клике на крестик
        clearSelectedFile();
        showStatus('Файл удалён из очереди загрузки.', 'info', 3000);
      });
    }

    showStatus(`Файл «${file.name}» готов к обработке. Нажмите «Преобразовать в HTML».`, 'info', 5000);
  }

  /**
   * Очищает выбранный файл
   */
  function clearSelectedFile() {
    currentSelectedFile = null;
    if (textFileInput) textFileInput.value = '';
    if (textFileInfo) {
      textFileInfo.classList.add('hidden');
      textFileInfo.innerHTML = '';
    }
  }

  /**
   * Проверяет и обрабатывает выбранный файл
   * @param {File} file — выбранный файл
   */
  function handleFileSelection(file) {
    if (!file) return;

    const fileName = file.name.toLowerCase();

    // 1. Проверка на старый формат Word (.doc) — Критерий T3
    if (fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
      showStatus(
        'Формат .doc (Word 97–2003) не поддерживается в браузере. ' +
        'Пожалуйста, откройте документ в Microsoft Word или Google Docs и пересохраните его в формате .docx, затем загрузите снова.',
        'error',
        10000
      );
      clearSelectedFile();
      return;
    }

    // 2. Проверка поддерживаемых расширений (.docx, .txt, .md)
    const isSupported = fileName.endsWith('.docx') || fileName.endsWith('.txt') || fileName.endsWith('.md');
    if (!isSupported) {
      showStatus(
        'Неподдерживаемый формат файла. Поддерживаются только документы Word (.docx), а также текстовые файлы .txt и .md.',
        'error',
        7000
      );
      clearSelectedFile();
      return;
    }

    // 3. Проверка на конфликт с введённым текстом (по решению из плана)
    if (!isEditorEmpty()) {
      const confirmReplace = confirm(
        'В текстовом поле уже есть введённый текст.\n' +
        'Хотите очистить поле ввода и работать с выбранным файлом "' + file.name + '"?'
      );
      if (confirmReplace) {
        clearEditor();
        updateTextStats('');
      } else {
        clearSelectedFile();
        return;
      }
    }

    renderSelectedFile(file);
  }

  // Настройка Drag & Drop для файла текста
  if (textFileDropzone && textFileInput) {
    textFileDropzone.addEventListener('click', (e) => {
      // Кликаем по невидимому input только если клик не был по кнопке удаления крестика
      if (!e.target.closest('#btn-remove-selected-file')) {
        textFileInput.click();
      }
    });

    textFileInput.addEventListener('change', () => {
      if (textFileInput.files && textFileInput.files.length > 0) {
        handleFileSelection(textFileInput.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      textFileDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        textFileDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      textFileDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        textFileDropzone.classList.remove('dragover');
      });
    });

    textFileDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFileSelection(dt.files[0]);
      }
    });
  }


  // ==========================================================================
  // 7. КНОПКА "ПРЕОБРАЗОВАТЬ В HTML" (ГЛАВНАЯ ЛОГИКА ЭТАПА 2)
  // ==========================================================================

  const btnConvertText = document.getElementById('btn-convert-text');
  const btnClearText = document.getElementById('btn-clear-text');
  const btnCopyHtml = document.getElementById('btn-copy-html');
  const outputHtmlCode = document.getElementById('output-html-code');
  const previewRenderArea = document.getElementById('preview-render-area');

  // Чекбоксы настроек
  const optCleanIndents = document.getElementById('opt-clean-indents');
  const optCleanFonts = document.getElementById('opt-clean-fonts');
  const optDetectHeadings = document.getElementById('opt-detect-headings');
  const optTypography = document.getElementById('opt-typography');

  /**
   * Считывает текущие настройки из чекбоксов интерфейса
   */
  function getConversionOptions() {
    return {
      cleanIndents: optCleanIndents ? optCleanIndents.checked : true,
      cleanFonts: optCleanFonts ? optCleanFonts.checked : true,
      detectHeadings: optDetectHeadings ? optDetectHeadings.checked : true,
      typography: optTypography ? optTypography.checked : true
    };
  }

  if (btnConvertText) {
    btnConvertText.addEventListener('click', async () => {
      // 1. Проверяем наличие модуля Text2Html
      if (typeof Text2Html === 'undefined') {
        showStatus('Ошибка: модуль text2html.js не загружен. Обновите страницу.', 'error');
        return;
      }

      const options = getConversionOptions();

      // 2. В зависимости от выбранного режима ввода определяем источник данных
      const isFileMode = currentInputMode === 'file';

      // --- Режим А: Вставка текста (обычного, Markdown или форматированного из Word / Google Docs) ---
      if (!isFileMode) {
        if (isEditorEmpty()) {
          showStatus('Пожалуйста, вставьте текст в поле ввода или переключитесь на загрузку файла.', 'warning');
          if (rawTextInput) rawTextInput.focus();
          return;
        }

        try {
          setButtonLoading(btnConvertText, true);

          let cleanHtml = '';
          if (shouldProcessAsRichHtml()) {
            // Поле содержит форматированный HTML из редактора — чистим с сохранением структуры
            cleanHtml = Text2Html.processHtml(getEditorHtml(), options);
          } else {
            // Обычный текст или Markdown — разбираем строчным парсером
            cleanHtml = Text2Html.processText(getEditorPlainText(), options);
          }

          displayResult(cleanHtml);
          showStatus('✅ Текст успешно преобразован в аккуратный HTML с типографикой!', 'success');
        } catch (err) {
          console.error('Ошибка при обработке текста:', err);
          showStatus(`Ошибка при обработке текста: ${err.message}`, 'error');
        } finally {
          setButtonLoading(btnConvertText, false);
        }
        return;
      }

      // --- Режим Б: Загрузка файла DOCX / TXT ---
      if (isFileMode) {
        if (!currentSelectedFile) {
          showStatus('Пожалуйста, выберите или перетащите файл DOCX для обработки.', 'warning');
          return;
        }

        const file = currentSelectedFile;
        const fileName = file.name.toLowerCase();

        setButtonLoading(btnConvertText, true);

        try {
          let cleanHtml = '';

          // 1. Если это текстовый файл (.txt, .md)
          if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            const text = await readFileAsText(file);
            cleanHtml = Text2Html.processText(text, options);
          } 
          // 2. Если это документ Word (.docx)
          else if (fileName.endsWith('.docx')) {
            const arrayBuffer = await readFileAsArrayBuffer(file);
            cleanHtml = await Text2Html.processDocx(arrayBuffer, options);
          }

          displayResult(cleanHtml);
          showStatus(`✅ Файл «${file.name}» успешно прочитан и очищен!`, 'success');
        } catch (err) {
          console.error('Ошибка при обработке файла:', err);
          showStatus(`Ошибка обработки файла: ${err.message}`, 'error');
        } finally {
          setButtonLoading(btnConvertText, false);
        }
      }
    });
  }

  /**
   * Отображает готовый HTML в текстовом поле и в предпросмотре
   * @param {string} html — очищенный и типографированный HTML
   */
  function displayResult(html) {
    if (outputHtmlCode) {
      outputHtmlCode.value = html;
    }

    if (previewRenderArea) {
      if (html.trim()) {
        previewRenderArea.innerHTML = html;
      } else {
        previewRenderArea.innerHTML = '<p class="placeholder-text">Результат пуст.</p>';
      }
    }

    // Обновляем счётчик символов и слов в готовом результате
    updateTextStats(html);
  }

  /**
   * Переключает кнопку в состояние "Загрузка..."
   */
  function setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalHtml = button.innerHTML;
      button.innerHTML = '<span class="btn-icon">⏳</span> Преобразование...';
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
      }
    }
  }

  /**
   * Асинхронное чтение файла как ArrayBuffer (для DOCX)
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Не удалось прочитать файл с диска'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Асинхронное чтение файла как текста в UTF-8
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Не удалось прочитать текстовый файл'));
      reader.readAsText(file, 'UTF-8');
    });
  }


  // ==========================================================================
  // 8. КНОПКА "ОЧИСТИТЬ ВСЁ"
  // ==========================================================================

  if (btnClearText) {
    btnClearText.addEventListener('click', () => {
      clearEditor();
      clearSelectedFile();

      if (outputHtmlCode) outputHtmlCode.value = '';
      if (previewRenderArea) {
        previewRenderArea.innerHTML = '<p class="placeholder-text">Предпросмотр будет отображаться здесь после преобразования текста.</p>';
      }

      updateTextStats('');
      hideStatus();
      showStatus('Все поля очищены.', 'info', 2000);
    });
  }


  // ==========================================================================
  // 9. КНОПКА "СКОПИРОВАТЬ HTML" (С ПРОВЕРКОЙ И ОБРАТНОЙ СВЯЗЬЮ)
  // ==========================================================================

  if (btnCopyHtml && outputHtmlCode) {
    btnCopyHtml.addEventListener('click', async () => {
      const textToCopy = outputHtmlCode.value.trim();

      // Проверка: есть ли что копировать
      if (!textToCopy) {
        showStatus('Пока нечего копировать! Сначала вставьте текст и нажмите «Преобразовать в HTML».', 'warning', 4000);
        return;
      }

      // Пытаемся скопировать через современный Clipboard API
      let copySuccess = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          copySuccess = true;
        } catch (err) {
          console.warn('Clipboard API не сработал, переключаемся на fallback:', err);
        }
      }

      // Запасной способ через выделение textarea (работает в старых браузерах и некоторых iframe)
      if (!copySuccess) {
        try {
          outputHtmlCode.select();
          outputHtmlCode.setSelectionRange(0, 999999);
          copySuccess = document.execCommand('copy');
        } catch (err) {
          console.error('Fallback execCommand failed:', err);
        }
      }

      if (copySuccess) {
        // Визуальная анимация на кнопке
        const originalHtml = btnCopyHtml.innerHTML;
        btnCopyHtml.classList.add('btn-copied');
        btnCopyHtml.innerHTML = '<span class="btn-icon">✅</span> Скопировано!';

        showStatus('Код скопирован в буфер обмена! Теперь его можно вставить в CMS (Ctrl+V).', 'success', 3000);

        setTimeout(() => {
          btnCopyHtml.classList.remove('btn-copied');
          btnCopyHtml.innerHTML = originalHtml;
        }, 2000);
      } else {
        showStatus('Не удалось скопировать автоматически. Пожалуйста, выделите текст в поле и нажмите Ctrl+C.', 'error', 6000);
      }
    });
  }


  // ==========================================================================
  // 10. ПОЛЗУНОК КАЧЕСТВА ДЛЯ ВКЛАДКИ ИЗОБРАЖЕНИЙ (ИЗ ЭТАПА 1)
  // ==========================================================================

  const qualityRange = document.getElementById('img-quality-range');
  const qualityValBadge = document.getElementById('img-quality-val');

  if (qualityRange && qualityValBadge) {
    qualityRange.addEventListener('input', () => {
      qualityValBadge.textContent = `${qualityRange.value}%`;
    });
  }

  // Зона драг-энд-дропа для фото (пока заглушка для визуального эффекта)
  const imagesDropzone = document.getElementById('images-dropzone');
  const imagesFileInput = document.getElementById('images-file-input');

  if (imagesDropzone && imagesFileInput) {
    imagesDropzone.addEventListener('click', () => {
      imagesFileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      imagesDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagesDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      imagesDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagesDropzone.classList.remove('dragover');
      });
    });
  }

  // Вспомогательная функция безопасного экранирования для UI
  function escapeString(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  console.log('✨ Модуль «Текст → HTML» (Этап 2) готов к работе.');
});
