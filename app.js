/**
 * ==========================================================================
 * Text2Html + OptiPics — Основной JavaScript приложения (Этап 3)
 * Управление интерфейсом, связывание модулей и обработка событий
 * ==========================================================================
 * 
 * ПОЯСНЕНИЕ ДЛЯ НАЧИНАЮЩИХ:
 * Этот файл — "дирижёр" нашего веб-приложения:
 * 1. Слушает клики по кнопкам, ввод текста и перетаскивание файлов.
 * 2. Передаёт текст или DOCX в модуль `text2html.js` на обработку.
 * 3. Передаёт картинки в модуль `optipics.js` для сжатия и конвертации в WebP.
 * 4. Управляет скачиванием готовых изображений и упаковкой в единый ZIP.
 * 5. Показывает понятные подсказки, предупреждения и сообщения об ошибках.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Инициализация Text2Html + OptiPics (Этап 3: OptiPics)...');

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
  // 10. МОДУЛЬ «ИЗОБРАЖЕНИЯ» (OPTIPICS) — СЖАТИЕ, КОНВЕРТАЦИЯ И ZIP
  // ==========================================================================

  // Элементы настроек сжатия
  const imgFormatSelect = document.getElementById('img-format-select');
  const imgMaxWidthSelect = document.getElementById('img-max-width');
  const imgQualityRange = document.getElementById('img-quality-range');
  const imgQualityValBadge = document.getElementById('img-quality-val');

  // Зона загрузки и выбора файлов
  const imagesDropzone = document.getElementById('images-dropzone');
  const imagesFileInput = document.getElementById('images-file-input');
  const imagesSelectedList = document.getElementById('images-selected-list');
  const imagesStatusBanner = document.getElementById('images-status-banner');

  // Индикатор прогресса
  const imagesProgressContainer = document.getElementById('images-progress-container');
  const imagesProgressLabel = document.getElementById('images-progress-label');
  const imagesProgressPercent = document.getElementById('images-progress-percent');
  const imagesProgressFill = document.getElementById('images-progress-fill');

  // Главные кнопки управления
  const btnOptimizeImages = document.getElementById('btn-optimize-images');
  const btnClearImages = document.getElementById('btn-clear-images');
  const btnDownloadAllZip = document.getElementById('btn-download-all-zip');

  // Область результатов и галерея
  const processedGalleryContainer = document.getElementById('processed-gallery');
  const imagesEmptyPlaceholder = document.getElementById('images-empty-placeholder');
  const imagesGalleryGrid = document.getElementById('images-gallery-grid');
  const imagesBatchSummary = document.getElementById('images-batch-summary');
  const totalSavedInfo = document.getElementById('total-saved-info');

  // Внутреннее состояние вкладки OptiPics
  let selectedFiles = [];       // Массив выбранных пользователем файлов (File)
  let processedResults = [];    // Массив результатов сжатия из OptiPics
  let isProcessingImages = false;

  /**
   * Отображает уведомление вверху вкладки изображений
   * @param {string} message — текст сообщения
   * @param {'info'|'success'|'error'|'warning'} type — тип сообщения
   * @param {number} autoHideMs — через сколько мс скрыть (0 — не скрывать)
   */
  let imagesBannerTimer = null;
  function showImagesBanner(message, type = 'info', autoHideMs = 5000) {
    if (!imagesStatusBanner) return;
    if (imagesBannerTimer) {
      clearTimeout(imagesBannerTimer);
      imagesBannerTimer = null;
    }

    imagesStatusBanner.className = `status-banner banner-${type}`;
    imagesStatusBanner.textContent = message;
    imagesStatusBanner.classList.remove('hidden');

    if (autoHideMs > 0) {
      imagesBannerTimer = setTimeout(() => {
        imagesStatusBanner.classList.add('hidden');
      }, autoHideMs);
    }
  }

  // Обновление значения качества при перемещении ползунка
  if (imgQualityRange && imgQualityValBadge) {
    imgQualityRange.addEventListener('input', () => {
      imgQualityValBadge.textContent = `${imgQualityRange.value}%`;
    });
  }

  /**
   * Добавляет новые файлы в очередь обработки
   * @param {FileList|Array<File>} newFiles
   */
  function addImagesToQueue(newFiles) {
    if (!newFiles || newFiles.length === 0) return;

    const added = [];
    const rejected = [];

    Array.from(newFiles).forEach(file => {
      if (typeof OptiPics !== 'undefined' && OptiPics.isSupportedImage(file)) {
        selectedFiles.push(file);
        added.push(file.name);
      } else {
        rejected.push(file.name);
      }
    });

    renderSelectedFilesQueue();

    if (added.length > 0) {
      showImagesBanner(`Добавлено файлов в очередь: ${added.length}`, 'success', 3500);
    }
    if (rejected.length > 0) {
      showImagesBanner(`Пропущено неподдерживаемых файлов (${rejected.length}): ${rejected.join(', ')}`, 'warning', 6000);
    }
  }

  /**
   * Перерисовывает визуальный список выбранных файлов в левой колонке
   */
  function renderSelectedFilesQueue() {
    if (!imagesSelectedList) return;

    if (selectedFiles.length === 0) {
      imagesSelectedList.innerHTML = '<div class="empty-list-notice">Файлы ещё не выбраны</div>';
      if (btnOptimizeImages) btnOptimizeImages.disabled = true;
      return;
    }

    if (btnOptimizeImages) btnOptimizeImages.disabled = false;

    // Считаем общий размер выбранных файлов
    const totalBytes = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const totalFormatted = (typeof OptiPics !== 'undefined') 
      ? OptiPics.formatBytes(totalBytes) 
      : `${Math.round(totalBytes / 1024)} КБ`;

    let html = `
      <div class="selected-images-header">
        <span>Выбрано: <strong class="selected-count-badge">${selectedFiles.length}</strong> (общий вес: ${totalFormatted})</span>
        <button type="button" class="btn-inline-clear" id="btn-clear-selected-list" title="Очистить только очередь">Очистить список</button>
      </div>
      <div class="selected-images-scroll">
    `;

    selectedFiles.forEach((file, idx) => {
      const fileSize = (typeof OptiPics !== 'undefined') 
        ? OptiPics.formatBytes(file.size) 
        : `${Math.round(file.size / 1024)} КБ`;

      html += `
        <div class="selected-img-row" data-index="${idx}">
          <div class="selected-img-info">
            <div class="selected-img-name" title="${escapeString(file.name)}">${escapeString(file.name)}</div>
            <div class="selected-img-meta">${fileSize} • ${escapeString(file.type || 'файл')}</div>
          </div>
          <button type="button" class="btn-remove-item" data-remove-index="${idx}" title="Удалить из очереди">✕</button>
        </div>
      `;
    });

    html += '</div>';
    imagesSelectedList.innerHTML = html;

    // Обработчик кнопки "Очистить список"
    const btnClearQueue = document.getElementById('btn-clear-selected-list');
    if (btnClearQueue) {
      btnClearQueue.addEventListener('click', () => {
        clearSelectedQueue();
      });
    }

    // Обработчики кнопок удаления отдельных файлов
    const removeBtns = imagesSelectedList.querySelectorAll('.btn-remove-item');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const removeIdx = parseInt(e.currentTarget.getAttribute('data-remove-index'), 10);
        if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < selectedFiles.length) {
          selectedFiles.splice(removeIdx, 1);
          renderSelectedFilesQueue();
        }
      });
    });
  }

  /**
   * Очищает только выбранную очередь файлов
   */
  function clearSelectedQueue() {
    selectedFiles = [];
    if (imagesFileInput) imagesFileInput.value = '';
    renderSelectedFilesQueue();
    showImagesBanner('Список выбранных файлов очищен', 'info', 3000);
  }

  /**
   * Полная очистка: удаляет и выбранные, и обработанные файлы
   */
  function clearAllImages() {
    // 1. Очищаем очередь файлов
    selectedFiles = [];
    if (imagesFileInput) imagesFileInput.value = '';
    renderSelectedFilesQueue();

    // 2. Освобождаем память от URL картинок
    if (Array.isArray(processedResults)) {
      processedResults.forEach(item => {
        if (item && item.previewUrl) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch (e) { /* игнорируем */ }
        }
      });
    }
    processedResults = [];

    // 3. Сбрасываем правую колонку галереи
    if (imagesGalleryGrid) {
      imagesGalleryGrid.innerHTML = '';
      imagesGalleryGrid.classList.add('hidden');
    }
    if (imagesEmptyPlaceholder) {
      imagesEmptyPlaceholder.classList.remove('hidden');
    }
    if (processedGalleryContainer) {
      processedGalleryContainer.classList.remove('has-items');
    }

    // 4. Сбрасываем сводки и кнопки
    if (imagesBatchSummary) {
      imagesBatchSummary.textContent = 'Ожидание файлов';
    }
    if (totalSavedInfo) {
      totalSavedInfo.textContent = 'Экономия: 0 КБ (0%)';
    }
    if (btnDownloadAllZip) {
      btnDownloadAllZip.disabled = true;
    }

    // 5. Скрываем индикатор прогресса
    if (imagesProgressContainer) {
      imagesProgressContainer.classList.add('hidden');
    }

    showImagesBanner('Все файлы и результаты обработки очищены.', 'info', 4000);
  }

  // Привязываем обработчик к главной кнопке «Очистить»
  if (btnClearImages) {
    btnClearImages.addEventListener('click', () => {
      clearAllImages();
    });
  }

  // Настройка Drag-and-Drop для зоны картинок
  if (imagesDropzone && imagesFileInput) {
    imagesDropzone.addEventListener('click', () => {
      if (!isProcessingImages) {
        imagesFileInput.click();
      }
    });

    imagesFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addImagesToQueue(e.target.files);
        imagesFileInput.value = ''; // сбрасываем для возможности повторного выбора того же файла
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      imagesDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isProcessingImages) {
          imagesDropzone.classList.add('dragover');
        }
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      imagesDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagesDropzone.classList.remove('dragover');
      });
    });

    imagesDropzone.addEventListener('drop', (e) => {
      if (isProcessingImages) return;
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        addImagesToQueue(dt.files);
      }
    });
  }

  /**
   * Отображает галерею обработанных изображений в правой колонке
   */
  function renderProcessedGallery() {
    if (!imagesGalleryGrid || !processedGalleryContainer || !imagesEmptyPlaceholder) return;

    if (!processedResults || processedResults.length === 0) {
      imagesGalleryGrid.innerHTML = '';
      imagesGalleryGrid.classList.add('hidden');
      imagesEmptyPlaceholder.classList.remove('hidden');
      processedGalleryContainer.classList.remove('has-items');
      if (btnDownloadAllZip) btnDownloadAllZip.disabled = true;
      if (totalSavedInfo) totalSavedInfo.textContent = 'Экономия: 0 КБ (0%)';
      return;
    }

    imagesEmptyPlaceholder.classList.add('hidden');
    imagesGalleryGrid.classList.remove('hidden');
    processedGalleryContainer.classList.add('has-items');

    let totalOrigBytes = 0;
    let totalNewBytes = 0;
    let successCount = 0;

    let gridHtml = '';

    processedResults.forEach((item, index) => {
      if (item.success) {
        successCount++;
        totalOrigBytes += (item.originalSize || 0);
        totalNewBytes += (item.newSize || 0);

        const origFormatted = OptiPics.formatBytes(item.originalSize);
        const newFormatted = OptiPics.formatBytes(item.newSize);
        const isSmaller = item.newSize < item.originalSize;
        const savedText = isSmaller 
          ? `-${item.savedPercent}%` 
          : '0%';
        const badgeClass = isSmaller ? 'stat-saved-badge' : 'stat-saved-badge stat-zero';

        gridHtml += `
          <div class="processed-card" data-card-index="${index}">
            <div class="card-left">
              <div class="processed-thumb-wrap">
                <img src="${item.previewUrl}" alt="${escapeString(item.newName)}" class="processed-thumb" loading="lazy">
              </div>
              <div class="card-details">
                <div class="card-title-row">
                  <span class="card-filename" title="${escapeString(item.newName)}">${escapeString(item.newName)}</span>
                  <span class="card-badge-format">${escapeString(item.format)}</span>
                </div>
                <div class="card-stats-row">
                  <span class="stat-size-compare">
                    ${origFormatted} <span class="stat-size-arrow">→</span> <strong>${newFormatted}</strong>
                  </span>
                  <span class="${badgeClass}">${savedText}</span>
                  <span class="stat-dims">${item.newWidth}×${item.newHeight} px</span>
                </div>
              </div>
            </div>
            <div class="card-actions">
              <button type="button" class="btn-card-download" data-download-index="${index}" title="Скачать этот файл">
                <span>⬇</span> Скачать
              </button>
            </div>
          </div>
        `;
      } else {
        // Карточка с ошибкой обработки
        gridHtml += `
          <div class="processed-card has-error" data-card-index="${index}">
            <div class="card-left">
              <div class="processed-thumb-wrap">⚠️</div>
              <div class="card-details">
                <div class="card-title-row">
                  <span class="card-filename">${escapeString(item.originalName)}</span>
                </div>
                <div class="card-stats-row">
                  <span style="color: #dc2626; font-size: 0.8rem;">Ошибка: ${escapeString(item.error || 'Не удалось обработать')}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });

    imagesGalleryGrid.innerHTML = gridHtml;

    // Навешиваем клики на индивидуальные кнопки скачивания
    const downloadBtns = imagesGalleryGrid.querySelectorAll('.btn-card-download');
    downloadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-download-index'), 10);
        const item = processedResults[idx];
        if (item && item.blob && typeof OptiPics !== 'undefined') {
          OptiPics.downloadBlob(item.blob, item.newName);
        }
      });
    });

    // Обновляем общую статистику экономии
    const totalSavedBytes = Math.max(0, totalOrigBytes - totalNewBytes);
    const totalPercent = totalOrigBytes > 0 
      ? Math.round((totalSavedBytes / totalOrigBytes) * 100) 
      : 0;

    const savedFormatted = OptiPics.formatBytes(totalSavedBytes);
    if (totalSavedInfo) {
      totalSavedInfo.textContent = `Экономия: ${savedFormatted} (${totalPercent}%)`;
    }

    if (imagesBatchSummary) {
      imagesBatchSummary.textContent = `Готово: ${successCount} из ${processedResults.length}`;
    }

    if (btnDownloadAllZip) {
      btnDownloadAllZip.disabled = (successCount === 0);
    }
  }

  /**
   * Запуск процесса оптимизации изображений
   */
  if (btnOptimizeImages) {
    btnOptimizeImages.addEventListener('click', async () => {
      if (selectedFiles.length === 0 || isProcessingImages) return;

      if (typeof OptiPics === 'undefined') {
        showImagesBanner('Ошибка: модуль OptiPics не загружен. Проверьте подключение optipics.js.', 'error');
        return;
      }

      isProcessingImages = true;
      btnOptimizeImages.disabled = true;
      if (btnClearImages) btnClearImages.disabled = true;
      if (btnDownloadAllZip) btnDownloadAllZip.disabled = true;

      // Считываем текущие настройки
      const targetFormat = imgFormatSelect ? imgFormatSelect.value : 'webp';
      const maxWidth = imgMaxWidthSelect ? imgMaxWidthSelect.value : '1200';
      const qualityVal = imgQualityRange ? Number(imgQualityRange.value) / 100 : 0.80;

      const options = {
        format: targetFormat,
        maxWidth: maxWidth,
        quality: qualityVal
      };

      // Показываем контейнер прогресса
      if (imagesProgressContainer) {
        imagesProgressContainer.classList.remove('hidden');
      }
      if (imagesProgressPercent) imagesProgressPercent.textContent = '0%';
      if (imagesProgressFill) imagesProgressFill.style.width = '0%';
      if (imagesProgressLabel) imagesProgressLabel.textContent = `Подготовка к сжатию ${selectedFiles.length} файлов...`;

      try {
        const results = await OptiPics.processBatch(selectedFiles, options, (info) => {
          if (imagesProgressPercent) {
            imagesProgressPercent.textContent = `${info.percent}%`;
          }
          if (imagesProgressFill) {
            imagesProgressFill.style.width = `${info.percent}%`;
          }
          if (imagesProgressLabel) {
            const fileName = info.file ? info.file.name : '';
            imagesProgressLabel.textContent = `Обработка (${info.current}/${info.total}): ${fileName}`;
          }
        });

        processedResults = results;
        renderProcessedGallery();

        const successCount = results.filter(r => r.success).length;
        showImagesBanner(`Успешно обработано: ${successCount} из ${results.length} изображений.`, 'success', 5000);

        // Мягко скрываем индикатор прогресса через секунду после завершения
        setTimeout(() => {
          if (imagesProgressContainer) {
            imagesProgressContainer.classList.add('hidden');
          }
        }, 1200);

      } catch (err) {
        console.error('Ошибка при пакетной обработке изображений:', err);
        showImagesBanner(`Ошибка оптимизации: ${err.message || 'Сбой обработки'}`, 'error', 7000);
      } finally {
        isProcessingImages = false;
        btnOptimizeImages.disabled = (selectedFiles.length === 0);
        if (btnClearImages) btnClearImages.disabled = false;
      }
    });
  }

  /**
   * Скачивание всех обработанных файлов единым ZIP-архивом
   */
  if (btnDownloadAllZip) {
    btnDownloadAllZip.addEventListener('click', async () => {
      if (!processedResults || processedResults.length === 0) return;

      const validItems = processedResults.filter(it => it.success && it.blob);
      if (validItems.length === 0) {
        showImagesBanner('Нет готовых файлов для добавления в архив', 'warning', 4000);
        return;
      }

      const originalBtnHtml = btnDownloadAllZip.innerHTML;
      btnDownloadAllZip.disabled = true;
      btnDownloadAllZip.innerHTML = '<span class="btn-icon">⏳</span> Создание архива...';

      try {
        const zipBlob = await OptiPics.createZip(validItems, (percent) => {
          if (imagesProgressContainer && !imagesProgressContainer.classList.contains('hidden')) {
            if (imagesProgressLabel) imagesProgressLabel.textContent = `Упаковка архива ZIP: ${percent}%`;
            if (imagesProgressPercent) imagesProgressPercent.textContent = `${percent}%`;
            if (imagesProgressFill) imagesProgressFill.style.width = `${percent}%`;
          }
        });

        // Формируем имя архива с текущей датой
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const zipName = `optipics_optimized_${dateStr}.zip`;

        OptiPics.downloadBlob(zipBlob, zipName);
        showImagesBanner(`Архив «${zipName}» успешно создан и отправлен на скачивание!`, 'success', 5000);

      } catch (err) {
        console.error('Ошибка при создании ZIP-архива:', err);
        showImagesBanner(`Не удалось создать ZIP-архив: ${err.message || 'Ошибка'}`, 'error', 6000);
      } finally {
        btnDownloadAllZip.disabled = false;
        btnDownloadAllZip.innerHTML = originalBtnHtml;
      }
    });
  }

  // Вспомогательная функция безопасного экранирования для UI
  function escapeString(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  console.log('✨ Приложение Text2Html + OptiPics (Этап 3) полностью инициализировано и готово.');
});
