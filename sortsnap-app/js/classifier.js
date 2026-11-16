import {
  CATEGORIES,
  OCR_MIN_VALID_CHARS,
  DOCUMENT_RATIO,
  SCREEN_RATIOS,
  SCREEN_RATIO_TOLERANCE,
  SCREENSHOT_NAME_PATTERNS
} from './config.js';
import { countValidChars } from './ocrEngine.js';

function isDocumentRatio(ratio) {
  if (!ratio) return false;
  const r = Math.abs(ratio);
  const portrait = r >= DOCUMENT_RATIO.portraitMin && r <= DOCUMENT_RATIO.portraitMax;
  const landscape = r >= DOCUMENT_RATIO.landscapeMin && r <= DOCUMENT_RATIO.landscapeMax;
  return portrait || landscape;
}

function isScreenRatio(ratio) {
  if (!ratio) return false;
  const r = Math.abs(ratio);
  return SCREEN_RATIOS.some(screen => Math.abs(r - screen) <= SCREEN_RATIO_TOLERANCE);
}

function looksLikeScreenshotName(name) {
  return SCREENSHOT_NAME_PATTERNS.some(pattern => pattern.test(name));
}

export function classify(file, meta, ocrResult) {
  const name = file.name || '';
  const ratio = meta?.ratio ?? null;
  const hasCameraMeta = meta?.hasCameraMeta === true;

  const ocrText = ocrResult?.text || '';
  const validOcrChars = countValidChars(ocrText);

  // 1. Dokumen & Struk
  if (validOcrChars >= OCR_MIN_VALID_CHARS || isDocumentRatio(ratio)) {
    return CATEGORIES.DOKUMEN;
  }

  // 2. Screenshot
  if (looksLikeScreenshotName(name)) {
    return CATEGORIES.SCREENSHOT;
  }
  if (isScreenRatio(ratio) && !hasCameraMeta) {
    return CATEGORIES.SCREENSHOT;
  }

  // 3. Foto Kamera
  if (hasCameraMeta) {
    return CATEGORIES.FOTO_KAMERA;
  }

  // 4. Lainnya
  return CATEGORIES.LAINNYA;
}
