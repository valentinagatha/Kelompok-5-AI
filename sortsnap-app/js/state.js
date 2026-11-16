import { CATEGORIES } from './config.js';
import { groupByClassification } from './grouper.js';

// Central application state
export const state = {
  files: [],                 // { id, file, name, size, type, lastModified }
  metadata: {},              // { fileId: { exif, width, height, ratio } }
  ocr: {},                   // { fileId: { text, confidence } }
  classifications: {},       // { fileId: category }
  groups: {},                // { category: [fileObjects] }
  activeTab: 'all',
  isProcessing: false,
  progress: { current: 0, total: 0, stage: '' },
  previewFileId: null
};

export function resetState() {
  state.files = [];
  state.metadata = {};
  state.ocr = {};
  state.classifications = {};
  state.groups = {};
  state.activeTab = 'all';
  state.isProcessing = false;
  state.progress = { current: 0, total: 0, stage: '' };
  state.previewFileId = null;
}

export function setClassification(fileId, category) {
  state.classifications[fileId] = category;
  rebuildGroups();
}

export function rebuildGroups() {
  state.groups = groupByClassification(state.files, state.classifications);
}
