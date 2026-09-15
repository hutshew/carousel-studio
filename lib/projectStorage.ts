import { CarouselProject } from '../types/editor';

const STORAGE_KEY = 'carousel-studio:v1-project';

export function saveProject(project: CarouselProject) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function loadProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as CarouselProject;
}

export function clearProject() {
  localStorage.removeItem(STORAGE_KEY);
}
