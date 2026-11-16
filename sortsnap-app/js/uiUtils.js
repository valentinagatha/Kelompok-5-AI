export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 z-50 ${
    type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600'
  }`;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

export function setProgress(visible, stage = '', current = 0, total = 0) {
  const area = document.getElementById('progressArea');
  const bar = document.getElementById('progressBar');
  const stageEl = document.getElementById('progressStage');
  const textEl = document.getElementById('progressText');
  if (!area) return;

  if (visible) {
    area.classList.remove('hidden');
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    bar.style.width = `${pct}%`;
    stageEl.textContent = stage;
    textEl.textContent = `${current} / ${total}`;
  } else {
    area.classList.add('hidden');
    bar.style.width = '0%';
  }
}

export function setDownloadEnabled(enabled) {
  const btn = document.getElementById('downloadZipBtn');
  if (btn) btn.disabled = !enabled;
}

export function setTabsVisible(visible) {
  const tabs = document.getElementById('categoryTabs');
  const stats = document.getElementById('statsArea');
  if (tabs) {
    if (visible) tabs.classList.remove('hidden');
    else tabs.classList.add('hidden');
  }
  if (stats) {
    if (visible) stats.classList.remove('hidden');
    else stats.classList.add('hidden');
  }
}
