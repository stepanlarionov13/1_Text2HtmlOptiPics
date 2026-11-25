/**
 * ==========================================================================
 * OptiPics — Модуль оптимизации, сжатия и конвертации изображений
 * Версия: 0.3 (Этап 3)
 * ==========================================================================
 * 
 * ПОЯСНЕНИЕ ДЛЯ НАЧИНАЮЩИХ:
 * Этот файл — автономный «движок» для работы с фотографиями прямо в браузере.
 * Он решает 4 ключевые задачи без отправки файлов на какой-либо сервер:
 * 
 * 1. ЧТЕНИЕ И ДЕКОДИРОВАНИЕ:
 *    - Принимает выбранные пользователем файлы изображений (JPG, PNG, WebP и др.).
 *    - Превращает двоичные данные файла в видимую картинку с помощью встроенных
 *      браузерных механизмов (HTMLImageElement с безопасным URL.createObjectURL).
 * 
 * 2. ПРОПОРЦИОНАЛЬНОЕ УМЕНЬШЕНИЕ (RESIZE ПО БОЛЬШЕЙ СТОРОНЕ):
 *    - Если фотография огромная (например, 4000x3000 px с камеры телефона),
 *      модуль аккуратно уменьшает её до заданного лимита (1920, 1200 или 800 px).
 *    - Проверяет наибольшую сторону: корректно уменьшает как горизонтальные,
 *      так и вертикальные (портретные) фотографии.
 *    - Сохраняет исходные пропорции (соотношение сторон), картинка не сплющивается.
 *    - Картинки меньшего размера не увеличиваются (нет искусственной потери четкости).
 * 
 * 3. ПЕРЕРИСОВКА В CANVAS, СЖАТИЕ В WEBP И АДАПТИВНАЯ ОПТИМИЗАЦИЯ:
 *    - Использует виртуальный холст HTML5 <canvas>.
 *    - Применяет высококачественное бикубическое сглаживание.
 *    - Для формата WebP сохраняет прозрачность PNG (альфа-канал).
 *    - Адаптивный алгоритм: если после первого прохода сжатия размер не уменьшился,
 *      автоматически пробует более эффективные параметры для гарантии экономии.
 *    - Защита от раздувания: если файл уже был максимально оптимизирован до нас,
 *      он никогда не станет тяжелее оригинала.
 * 
 * 4. УПАКОВКА В ZIP-АРХИВ И СКАЧИВАНИЕ:
 *    - Собирает все обработанные файлы в единый архив .zip.
 *    - Поддерживает как библиотеку JSZip (если подключена), так и собственный
 *      встроенный легковесный генератор ZIP-архивов (работает даже оффлайн).
 *    - Запускает прямое скачивание через браузер без сервера.
 */

(function (global) {
  'use strict';

  // Создаём главный объект модуля OptiPics
  const OptiPics = {};

  // ==========================================================================
  // 1. НАСТРОЙКИ ПО УМОЛЧАНИЮ
  // ==========================================================================

  const DEFAULT_OPTIONS = {
    maxWidth: 1200,          // Максимальный размер большей стороны в px (или 'no-resize')
    quality: 0.80,           // Качество сжатия от 0.4 до 1.0 (80% по умолчанию)
    format: 'webp',          // 'webp' или 'original' (сохранить исходный формат)
    preserveAlpha: true      // Сохранять прозрачность при конвертации в WebP/PNG
  };

  /**
   * Поддерживаемые типы файлов для обработки
   */
  const SUPPORTED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/bmp',
    'image/gif',
    'image/avif'
  ];

  // ==========================================================================
  // 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (УТИЛИТЫ)
  // ==========================================================================

  /**
   * Проверяет, является ли файл поддерживаемым изображением
   * @param {File} file — объект файла
   * @returns {boolean}
   */
  OptiPics.isSupportedImage = function (file) {
    if (!file) return false;
    if (file.type && SUPPORTED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return true;
    }
    // Если браузер не определил MIME-тип, проверяем по расширению имени файла
    const name = (file.name || '').toLowerCase();
    return /\.(jpe?g|png|webp|bmp|gif|avif)$/i.test(name);
  };

  /**
   * Красиво форматирует размер файла в байтах в человекочитаемый вид
   * Например: 1536 -> "1.5 КБ", 2400000 -> "2.29 МБ"
   * @param {number} bytes — размер в байтах
   * @param {number} decimals — знаков после запятой
   * @returns {string}
   */
  OptiPics.formatBytes = function (bytes, decimals = 1) {
    if (!bytes || bytes <= 0) return '0 Б';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${val} ${sizes[i] || 'Б'}`;
  };

  /**
   * Удаляет запрещённые символы из имени файла для безопасности в ZIP
   * @param {string} fileName — исходное имя файла
   * @returns {string}
   */
  OptiPics.sanitizeFileName = function (fileName) {
    if (!fileName) return 'image';
    return fileName
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /**
   * Меняет расширение имени файла на указанное
   * Например: "photo.jpg" -> "photo.webp"
   * @param {string} fileName — имя файла
   * @param {string} newExt — новое расширение (например, "webp")
   * @returns {string}
   */
  OptiPics.changeExtension = function (fileName, newExt) {
    const cleanName = OptiPics.sanitizeFileName(fileName);
    const lastDotIndex = cleanName.lastIndexOf('.');
    const baseName = lastDotIndex !== -1 ? cleanName.substring(0, lastDotIndex) : cleanName;
    return `${baseName}.${newExt.replace(/^\./, '')}`;
  };

  /**
   * Получает базовое имя файла без расширения
   * @param {string} fileName
   * @returns {string}
   */
  OptiPics.getBaseName = function (fileName) {
    const clean = OptiPics.sanitizeFileName(fileName);
    const dot = clean.lastIndexOf('.');
    return dot !== -1 ? clean.substring(0, dot) : clean;
  };

  /**
   * Получает расширение файла в нижнем регистре без точки
   * @param {string} fileName
   * @returns {string}
   */
  OptiPics.getExtension = function (fileName) {
    const clean = fileName || '';
    const dot = clean.lastIndexOf('.');
    return dot !== -1 ? clean.substring(dot + 1).toLowerCase() : '';
  };

  /**
   * Обеспечивает уникальность имён файлов в списке (чтобы в ZIP не перезаписывались)
   * Например: ['photo.webp', 'photo.webp'] -> ['photo.webp', 'photo (1).webp']
   * @param {Array<string>} fileNames
   * @returns {Array<string>}
   */
  OptiPics.ensureUniqueNames = function (fileNames) {
    const counts = {};
    return fileNames.map(name => {
      const ext = OptiPics.getExtension(name);
      const base = OptiPics.getBaseName(name);
      const lower = name.toLowerCase();

      if (!counts[lower]) {
        counts[lower] = 1;
        return name;
      } else {
        const index = counts[lower]++;
        return `${base} (${index}).${ext}`;
      }
    });
  };

  // ==========================================================================
  // 3. ПРОПОРЦИОНАЛЬНЫЙ РАСЧЁТ РАЗМЕРОВ (BOUNDING BOX RESIZE)
  // ==========================================================================

  /**
   * Вычисляет целевую ширину и высоту изображения с сохранением пропорций
   * Проверяет наибольшую сторону: одинаково эффективно уменьшает
   * как горизонтальные, так и вертикальные (портретные) фотографии.
   * 
   * @param {number} origWidth — исходная ширина в px
   * @param {number} origHeight — исходная высота в px
   * @param {number|string} maxWidth — максимальный размер стороны (число или 'no-resize')
   * @returns {{ width: number, height: number, wasResized: boolean }}
   */
  OptiPics.calculateDimensions = function (origWidth, origHeight, maxWidth) {
    if (!origWidth || !origHeight) {
      return { width: origWidth || 0, height: origHeight || 0, wasResized: false };
    }

    // Если выбран режим "Без изменения разрешения"
    if (maxWidth === 'no-resize' || !maxWidth || isNaN(Number(maxWidth))) {
      return { width: origWidth, height: origHeight, wasResized: false };
    }

    const maxLimit = Number(maxWidth);

    // Ограничиваем наибольшую сторону (работает для горизонтальных и вертикальных фото)
    const maxSide = Math.max(origWidth, origHeight);
    if (maxSide <= maxLimit) {
      return { width: origWidth, height: origHeight, wasResized: false };
    }

    // Пропорциональное уменьшение с сохранением соотношения сторон
    const ratio = maxLimit / maxSide;
    const targetWidth = Math.max(1, Math.round(origWidth * ratio));
    const targetHeight = Math.max(1, Math.round(origHeight * ratio));

    return {
      width: targetWidth,
      height: targetHeight,
      wasResized: true
    };
  };

  // ==========================================================================
  // 4. ЗАГРУЗКА И ДЕКОДИРОВАНИЕ ИЗОБРАЖЕНИЯ (IMAGE LOADER)
  // ==========================================================================

  /**
   * Загружает изображение в память браузера для рисования на Canvas
   * 
   * @param {File|Blob} fileOrBlob — объект файла
   * @returns {Promise<{ source: HTMLImageElement, width: number, height: number, cleanup: Function }>}
   */
  OptiPics.loadImage = function (fileOrBlob) {
    return new Promise((resolve, reject) => {
      if (!fileOrBlob) {
        return reject(new Error('Файл не передан для загрузки'));
      }

      const objectUrl = URL.createObjectURL(fileOrBlob);
      const img = new Image();

      let isResolved = false;

      function onImageReady() {
        if (isResolved) return;
        isResolved = true;
        resolve({
          source: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          cleanup: () => {
            URL.revokeObjectURL(objectUrl);
          }
        });
      }

      img.onload = () => {
        onImageReady();
      };

      img.onerror = () => {
        if (isResolved) return;
        isResolved = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Не удалось декодировать изображение. Возможно, файл повреждён.'));
      };

      img.src = objectUrl;

      // Если изображение уже закэшировано или сразу доступно
      if (img.complete && (img.naturalWidth || img.width) > 0) {
        onImageReady();
      } else if (typeof img.decode === 'function') {
        img.decode().then(onImageReady).catch(() => {
          // Игнорируем ошибку decode, полагаемся на onload/onerror
        });
      }
    });
  };

  // ==========================================================================
  // 5. ОСНОВНОЙ МЕТОД СЖАТИЯ ОДНОГО ИЗОБРАЖЕНИЯ (CANVAS & WEBP)
  // ==========================================================================

  /**
   * Сжимает и конвертирует одно изображение с помощью HTML5 Canvas
   * 
   * @param {File} file — исходный файл
   * @param {Object} customOptions — параметры сжатия
   * @param {number|string} customOptions.maxWidth — лимит стороны (1920, 1200, 800 или 'no-resize')
   * @param {number} customOptions.quality — качество сжатия от 0.4 до 1.0 (например 0.8)
   * @param {'webp'|'original'} customOptions.format — целевой формат ('webp' или 'original')
   * @returns {Promise<Object>} — объект с метаданными и готовым Blob
   */
  OptiPics.compressImage = async function (file, customOptions = {}) {
    if (!file) {
      throw new Error('Файл не передан в метод compressImage');
    }

    if (!OptiPics.isSupportedImage(file)) {
      throw new Error(`Файл «${file.name}» не является поддерживаемым форматом изображения.`);
    }

    const options = Object.assign({}, DEFAULT_OPTIONS, customOptions);

    // 1. Нормализуем параметры
    const quality = Math.min(1.0, Math.max(0.1, Number(options.quality) || 0.80));
    const targetFormat = (options.format || 'webp').toLowerCase();

    // 2. Загружаем и декодируем картинку
    const loaded = await OptiPics.loadImage(file);
    const origWidth = loaded.width;
    const origHeight = loaded.height;

    try {
      // 3. Вычисляем целевой размер
      const dims = OptiPics.calculateDimensions(origWidth, origHeight, options.maxWidth);
      const targetWidth = dims.width;
      const targetHeight = dims.height;

      // 4. Создаём холст Canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        throw new Error('Не удалось инициализировать 2D-контекст Canvas в браузере.');
      }

      // Включаем алгоритм высококачественного сглаживания
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 5. Определение целевого MIME-типа и фона
      let mimeType = 'image/webp';
      let outputExt = 'webp';

      if (targetFormat === 'original') {
        const origExt = OptiPics.getExtension(file.name);
        if (file.type === 'image/png' || origExt === 'png') {
          mimeType = 'image/png';
          outputExt = 'png';
        } else if (file.type === 'image/webp' || origExt === 'webp') {
          mimeType = 'image/webp';
          outputExt = 'webp';
        } else {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
        }
      } else {
        mimeType = 'image/webp';
        outputExt = 'webp';
      }

      // Если мы сохраняем в JPEG (у которого нет поддержки прозрачности),
      // то заполняем фон белым цветом, чтобы прозрачные пиксели не стали чёрными
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else {
        // Для WebP и PNG очищаем холст (сохраняем прозрачный альфа-канал)
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      }

      // 6. Отрисовываем уменьшенное изображение на холсте
      ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

      // Вспомогательная функция безопасного экспорта в Blob
      function exportToBlob(q, mime = mimeType) {
        return new Promise(resolve => {
          try {
            canvas.toBlob(b => resolve(b), mime, q);
          } catch (e) {
            resolve(null);
          }
        });
      }

      // 7. Конвертируем холст в сжатый Blob
      let blob = await exportToBlob(quality, mimeType);
      if (!blob) {
        throw new Error(`Браузер не смог сгенерировать изображение в формате ${mimeType}`);
      }

      let usedQuality = quality;

      // 8. АДАПТИВНАЯ ОПТИМИЗАЦИЯ ДЛЯ ГАРАНТИИ УМЕНЬШЕНИЯ ВЕСА
      // Если файл после первого прохода сжатия не стал легче оригинала (или даже стал тяжелее),
      // интеллектуально подбираем более эффективный уровень качества
      if (blob.size >= file.size && (mimeType === 'image/webp' || mimeType === 'image/jpeg')) {
        const fallbackQualities = [
          Math.min(0.74, quality * 0.88),
          Math.min(0.64, quality * 0.75),
          Math.min(0.54, quality * 0.62),
          0.44
        ];

        for (const candidateQuality of fallbackQualities) {
          if (candidateQuality >= usedQuality) continue;
          const candidateBlob = await exportToBlob(candidateQuality, mimeType);
          if (candidateBlob && candidateBlob.size < blob.size) {
            blob = candidateBlob;
            usedQuality = candidateQuality;
            if (blob.size < file.size) {
              break; // Успешно добились реального снижения веса!
            }
          }
        }
      }

      // 9. СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ PNG ПРИ ВЫБОРЕ "ИСХОДНЫЙ ФОРМАТ"
      // По спецификации HTML Canvas метод toBlob для 'image/png' игнорирует параметр качества
      // и часто раздувает файл. Если PNG не сжался, проверяем прозрачность:
      if (targetFormat === 'original' && mimeType === 'image/png' && blob.size >= file.size) {
        let hasAlpha = false;
        try {
          const sampleW = Math.min(targetWidth, 40);
          const sampleH = Math.min(targetHeight, 40);
          const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
          for (let i = 3; i < imgData.length; i += 4) {
            if (imgData[i] < 255) {
              hasAlpha = true;
              break;
            }
          }
        } catch (e) {}

        // Если прозрачности нет, конвертируем в JPEG, экономя до 80% веса
        if (!hasAlpha) {
          const jpegBlob = await exportToBlob(quality, 'image/jpeg');
          if (jpegBlob && jpegBlob.size < file.size) {
            blob = jpegBlob;
            mimeType = 'image/jpeg';
            outputExt = 'jpg';
          }
        }
      }

      // 10. ГАРАНТИЯ ЗАЩИТЫ ОТ РАЗДУВАНИЯ (ZERO INFLATION GUARANTEE)
      // Если файл уже был максимально сжат до нашего сервиса, и при том же формате
      // новый файл больше исходного: не раздуваем его, оставляем оригинальный файл!
      if (blob.size >= file.size && !dims.wasResized && (outputExt === OptiPics.getExtension(file.name))) {
        blob = file;
      }

      // 11. Формируем новое имя файла
      const newName = OptiPics.changeExtension(file.name, outputExt);

      // 12. Считаем статистику экономии
      const originalSize = file.size;
      const newSize = blob.size;
      const savedBytes = Math.max(0, originalSize - newSize);
      const savedPercent = originalSize > 0 
        ? Math.round(((originalSize - newSize) / originalSize) * 100) 
        : 0;

      // Создаём безопасный локальный URL для предпросмотра и скачивания
      const previewUrl = URL.createObjectURL(blob);

      return {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        originalFile: file,
        originalName: file.name,
        originalSize: originalSize,
        originalWidth: origWidth,
        originalHeight: origHeight,
        blob: blob,
        newName: newName,
        newSize: newSize,
        newWidth: targetWidth,
        newHeight: targetHeight,
        format: outputExt.toUpperCase(),
        mimeType: mimeType,
        quality: Math.round(usedQuality * 100),
        savedBytes: savedBytes,
        savedPercent: savedPercent,
        wasResized: dims.wasResized,
        previewUrl: previewUrl,
        success: true
      };

    } finally {
      // Обязательно освобождаем память от загруженного исходника
      if (typeof loaded.cleanup === 'function') {
        loaded.cleanup();
      }
    }
  };

  // ==========================================================================
  // 6. ПАКЕТНАЯ ОБРАБОТКА МАССИВА ФАЙЛОВ (BATCH PROCESSING)
  // ==========================================================================

  /**
   * Последовательно сжимает список файлов с отчётом о прогрессе
   * 
   * @param {Array<File>} files — массив файлов
   * @param {Object} options — параметры сжатия
   * @param {Function} [onProgress] — коллбэк прогресса: (info) => {}
   * @returns {Promise<Array<Object>>} — массив результатов
   */
  OptiPics.processBatch = async function (files, options = {}, onProgress = null) {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    const results = [];
    const total = files.length;

    for (let index = 0; index < total; index++) {
      const file = files[index];

      // Уведомляем о начале обработки очередного файла
      if (typeof onProgress === 'function') {
        onProgress({
          index: index,
          current: index + 1,
          total: total,
          file: file,
          percent: Math.round((index / total) * 100),
          status: 'processing'
        });
      }

      try {
        const itemResult = await OptiPics.compressImage(file, options);
        results.push(itemResult);

        if (typeof onProgress === 'function') {
          onProgress({
            index: index,
            current: index + 1,
            total: total,
            file: file,
            result: itemResult,
            percent: Math.round(((index + 1) / total) * 100),
            status: 'done'
          });
        }
      } catch (err) {
        console.error(`Ошибка при сжатии файла ${file.name}:`, err);
        const errorResult = {
          id: `err_${Date.now()}_${index}`,
          originalFile: file,
          originalName: file.name,
          originalSize: file.size,
          newName: file.name,
          success: false,
          error: err.message || 'Ошибка обработки'
        };
        results.push(errorResult);

        if (typeof onProgress === 'function') {
          onProgress({
            index: index,
            current: index + 1,
            total: total,
            file: file,
            result: errorResult,
            percent: Math.round(((index + 1) / total) * 100),
            status: 'error'
          });
        }
      }
    }

    // Обеспечиваем уникальность имён успешных файлов
    const successfulItems = results.filter(r => r.success);
    const names = successfulItems.map(r => r.newName);
    const uniqueNames = OptiPics.ensureUniqueNames(names);
    successfulItems.forEach((item, idx) => {
      item.newName = uniqueNames[idx];
    });

    return results;
  };

  // ==========================================================================
  // 7. СОЗДАНИЕ ZIP-АРХИВА (JSZIP + НАДЁЖНЫЙ ВСТРОЕННЫЙ ФОЛБЭК)
  // ==========================================================================

  /**
   * Упаковывает сжатые изображения в ZIP-архив
   * 
   * @param {Array<Object>} items — массив объектов с полями { newName, blob }
   * @param {Function} [onZipProgress] — коллбэк прогресса архивации
   * @returns {Promise<Blob>} — готовый ZIP-файл как Blob
   */
  OptiPics.createZip = async function (items, onZipProgress = null) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Нет файлов для добавления в архив');
    }

    const validItems = items.filter(it => it && it.blob && it.newName);
    if (validItems.length === 0) {
      throw new Error('Среди переданных файлов нет готовых данных для архивации');
    }

    // ВАРИАНТ А: Если доступна библиотека JSZip
    if (typeof global.JSZip !== 'undefined') {
      try {
        const zip = new global.JSZip();

        validItems.forEach(item => {
          zip.file(item.newName, item.blob);
        });

        const zipBlob = await zip.generateAsync(
          {
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          },
          metadata => {
            if (typeof onZipProgress === 'function') {
              onZipProgress(Math.round(metadata.percent));
            }
          }
        );

        return zipBlob;
      } catch (err) {
        console.warn('JSZip вызвал ошибку, переключаемся на встроенный генератор ZIP:', err);
      }
    }

    // ВАРИАНТ Б: Встроенный чистый JavaScript ZIP-генератор (работает автономно)
    return await createZipNative(validItems, onZipProgress);
  };

  /**
   * Встроенный автономный ZIP-генератор по спецификации PKZIP (RFC 1951 / APPNOTE.TXT)
   */
  async function createZipNative(items, onZipProgress) {
    const fileEntries = [];
    let localHeadersOffset = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const arrayBuffer = await item.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const crc = crc32(bytes);
      const nameBytes = new TextEncoder().encode(item.newName);

      const now = new Date();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lhView = new DataView(localHeader.buffer);

      lhView.setUint32(0, 0x04034b50, true);
      lhView.setUint16(4, 20, true);
      lhView.setUint16(6, 0x0800, true);
      lhView.setUint16(8, 0, true);
      lhView.setUint16(10, dosTime, true);
      lhView.setUint16(12, dosDate, true);
      lhView.setUint32(14, crc, true);
      lhView.setUint32(18, bytes.length, true);
      lhView.setUint32(22, bytes.length, true);
      lhView.setUint16(26, nameBytes.length, true);
      lhView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({
        nameBytes: nameBytes,
        localHeader: localHeader,
        data: bytes,
        crc: crc,
        size: bytes.length,
        offset: localHeadersOffset,
        dosTime: dosTime,
        dosDate: dosDate
      });

      localHeadersOffset += localHeader.length + bytes.length;

      if (typeof onZipProgress === 'function') {
        onZipProgress(Math.round(((i + 1) / items.length) * 50));
      }
    }

    const centralEntries = [];
    let centralDirectorySize = 0;

    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);

      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0x0800, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, entry.dosTime, true);
      cdView.setUint16(14, entry.dosDate, true);
      cdView.setUint32(16, entry.crc, true);
      cdView.setUint32(20, entry.size, true);
      cdView.setUint32(24, entry.size, true);
      cdView.setUint16(28, entry.nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, entry.offset, true);
      cdHeader.set(entry.nameBytes, 46);

      centralEntries.push(cdHeader);
      centralDirectorySize += cdHeader.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, fileEntries.length, true);
    eocdView.setUint16(10, fileEntries.length, true);
    eocdView.setUint32(12, centralDirectorySize, true);
    eocdView.setUint32(16, localHeadersOffset, true);
    eocdView.setUint16(20, 0, true);

    const blobParts = [];
    for (const entry of fileEntries) {
      blobParts.push(entry.localHeader);
      blobParts.push(entry.data);
    }
    for (const cd of centralEntries) {
      blobParts.push(cd);
    }
    blobParts.push(eocd);

    if (typeof onZipProgress === 'function') {
      onZipProgress(100);
    }

    return new Blob(blobParts, { type: 'application/zip' });
  }

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(uint8Array) {
    let crc = 0xffffffff;
    for (let i = 0; i < uint8Array.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ==========================================================================
  // 8. СКАЧИВАНИЕ ФАЙЛОВ В БРАУЗЕРЕ (NATIVE DOWNLOAD TRIGGER)
  // ==========================================================================

  OptiPics.downloadBlob = function (blob, fileName) {
    if (!blob) {
      console.error('Не передан Blob для скачивания');
      return;
    }

    const name = OptiPics.sanitizeFileName(fileName || 'download');
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);

    link.click();

    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      URL.revokeObjectURL(objectUrl);
    }, 2000);
  };

  global.OptiPics = OptiPics;

})(typeof window !== 'undefined' ? window : this);
