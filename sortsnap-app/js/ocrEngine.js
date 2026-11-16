const { createWorker } = window.Tesseract;

let worker = null;

export async function initOcr() {
  if (!worker) {
    worker = await createWorker('eng+ind', 1, {
      logger: () => {}
    });
  }
  return worker;
}

export async function terminateOcr() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

export async function recognizeText(file, onProgress) {
  try {
    const w = await initOcr();
    const result = await w.recognize(file);
    if (onProgress) onProgress();
    return {
      text: result?.data?.text || '',
      confidence: result?.data?.confidence || 0
    };
  } catch (err) {
    console.warn('OCR failed for', file.name, err);
    return { text: '', confidence: 0 };
  }
}

export function countValidChars(text) {
  if (!text) return 0;
  return (text.match(/[a-zA-Z0-9]/g) || []).length;
}
