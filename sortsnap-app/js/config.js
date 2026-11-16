// SortSnap configuration constants

export const ACCEPTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff', 'bmp', 'gif'
]);

export const CATEGORIES = {
  DOKUMEN: 'Dokumen_&_Struk',
  SCREENSHOT: 'Screenshot',
  FOTO_KAMERA: 'Foto_Kamera',
  LAINNYA: 'Lainnya'
};

export const CATEGORY_ORDER = [
  CATEGORIES.DOKUMEN,
  CATEGORIES.SCREENSHOT,
  CATEGORIES.FOTO_KAMERA,
  CATEGORIES.LAINNYA
];

// OCR: minimum alphanumeric characters to consider a document
export const OCR_MIN_VALID_CHARS = 15;

// Document aspect ratio ranges (width / height)
export const DOCUMENT_RATIO = {
  portraitMin: 0.60,
  portraitMax: 0.85,
  landscapeMin: 1.18,
  landscapeMax: 1.70
};

// Screen-like ratios (width / height) with tolerance
export const SCREEN_RATIOS = [
  9 / 16,   // 0.5625 phone portrait
  9 / 18,   // 0.5
  9 / 19.5, // ~0.4615
  9 / 20,   // 0.45
  16 / 9,   // 1.777 desktop
  16 / 10,  // 1.6
  4 / 3,    // 1.333
  21 / 9    // 2.333
];

export const SCREEN_RATIO_TOLERANCE = 0.08;

// Filename patterns suggesting screenshot
export const SCREENSHOT_NAME_PATTERNS = [
  /screenshot/i,
  /screen[_\s]?shot/i,
  /img_e/i,
  /screencapture/i,
  /capture/i
];

// Thumbnail size
export const THUMB_SIZE = 240;
