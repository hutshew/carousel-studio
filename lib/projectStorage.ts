import { CarouselProject, ProjectSummary, UploadedImage } from '../types/editor';

const DB_NAME = 'carousel-studio';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const ASSET_STORE = 'assets';
const LAST_PROJECT_KEY = 'carousel-studio:last-project-id';

type ProjectRecord = Omit<CarouselProject, 'uploads'> & {
  assetIds: string[];
};

type AssetRecord = {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  blob: Blob;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function withStore<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T>,
) {
  const db = await openDb();
  const transaction = db.transaction(stores, mode);
  const complete = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });

  try {
    const result = await run(transaction);
    await complete;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already be complete or aborted.
    }
    throw error;
  }
}

function toProjectRecord(project: CarouselProject): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    pageCount: project.pageCount,
    background: project.background,
    objects: project.objects,
    thumbnail: project.thumbnail,
    assetIds: project.uploads.map((asset) => asset.id),
  };
}

export function getLastProjectId() {
  return localStorage.getItem(LAST_PROJECT_KEY);
}

export function setLastProjectId(id: string) {
  localStorage.setItem(LAST_PROJECT_KEY, id);
}

export function clearLastProjectId() {
  localStorage.removeItem(LAST_PROJECT_KEY);
}

export async function saveProject(project: CarouselProject, thumbnail?: string) {
  const now = Date.now();
  const nextProject: CarouselProject = {
    ...project,
    updatedAt: now,
    thumbnail: thumbnail ?? project.thumbnail,
  };

  await withStore([PROJECT_STORE, ASSET_STORE], 'readwrite', async (transaction) => {
    const projectStore = transaction.objectStore(PROJECT_STORE);
    const assetStore = transaction.objectStore(ASSET_STORE);

    for (const upload of nextProject.uploads) {
      if (!upload.blob) continue;
      const asset: AssetRecord = {
        id: upload.id,
        name: upload.name,
        mimeType: upload.mimeType,
        width: upload.width,
        height: upload.height,
        blob: upload.blob,
        createdAt: now,
      };
      await requestToPromise(assetStore.put(asset));
    }

    await requestToPromise(projectStore.put(toProjectRecord(nextProject)));
  });

  setLastProjectId(nextProject.id);
  return nextProject;
}

export async function loadProject(id: string): Promise<CarouselProject | null> {
  return withStore([PROJECT_STORE, ASSET_STORE], 'readonly', async (transaction) => {
    const projectStore = transaction.objectStore(PROJECT_STORE);
    const assetStore = transaction.objectStore(ASSET_STORE);
    const record = (await requestToPromise(projectStore.get(id))) as ProjectRecord | undefined;
    if (!record) return null;

    const uploads: UploadedImage[] = [];
    for (const assetId of record.assetIds) {
      const asset = (await requestToPromise(assetStore.get(assetId))) as AssetRecord | undefined;
      if (!asset) continue;
      uploads.push({
        id: asset.id,
        name: asset.name,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        blob: asset.blob,
        src: URL.createObjectURL(asset.blob),
      });
    }

    return { ...record, uploads };
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return withStore(PROJECT_STORE, 'readonly', async (transaction) => {
    const records = (await requestToPromise(transaction.objectStore(PROJECT_STORE).getAll())) as ProjectRecord[];
    return records
      .map((record) => ({
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        pageCount: record.pageCount,
        thumbnail: record.thumbnail,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

export async function deleteProject(id: string) {
  await withStore(PROJECT_STORE, 'readwrite', async (transaction) => {
    await requestToPromise(transaction.objectStore(PROJECT_STORE).delete(id));
  });
}

export async function duplicateProject(id: string, nextId: string) {
  const project = await loadProject(id);
  if (!project) throw new Error('Project not found.');
  const now = Date.now();
  const copy: CarouselProject = {
    ...project,
    id: nextId,
    name: `${project.name} Copy`,
    createdAt: now,
    updatedAt: now,
  };
  return saveProject(copy, project.thumbnail);
}
