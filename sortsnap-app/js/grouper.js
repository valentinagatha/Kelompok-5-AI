import { CATEGORIES } from './config.js';

export function groupByClassification(files, classifications) {
  const groups = {};
  for (const cat of Object.values(CATEGORIES)) {
    groups[cat] = [];
  }
  for (const file of files) {
    const cat = classifications[file.id] || CATEGORIES.LAINNYA;
    groups[cat].push(file);
  }
  return groups;
}
