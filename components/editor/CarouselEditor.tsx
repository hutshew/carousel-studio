'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import EditorStage from './EditorStage';
import {
  clearLastProjectId,
  deleteProject,
  duplicateProject,
  getLastProjectId,
  listProjects,
  loadProject,
  saveProject,
} from '../../lib/projectStorage';
import {
  renderCarouselPageBlobs,
  renderCarouselPages,
  renderProjectThumbnail,
} from '../../lib/renderCarousel';
import {
  CarouselProject,
  EditorObject,
  ExportFormat,
  ExportQuality,
  ImageObject,
  MAX_PAGES,
  MIN_PAGES,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PlaceholderObject,
  ShapeObject,
  TextObject,
  ToolName,
  UploadedImage,
  ProjectSummary,
} from '../../types/editor';

const tools: { icon: string; label: ToolName }[] = [
  { icon: '+', label: 'Upload' },
  { icon: '▦', label: 'Templates' },
  { icon: '▣', label: 'Photos' },
  { icon: 'T', label: 'Text' },
  { icon: '◇', label: 'Elements' },
  { icon: '●', label: 'Background' },
  { icon: '▱', label: 'Layers' },
  { icon: '□', label: 'Projects' },
];

const fonts = [
  'Noto Sans Thai',
  'Sarabun',
  'Prompt',
  'Kanit',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
];
const presets = ['#ffffff', '#f4f1ea', '#111827', '#f97316', '#0f766e', '#2563eb', '#e11d48'];
const MIN_ZOOM = 20;
const MAX_ZOOM = 100;

function createBlankProject(name = 'My Carousel', pageCount = 3): CarouselProject {
  const now = Date.now();
  return {
    id: id('project'),
    name,
    createdAt: now,
    updatedAt: now,
    pageCount,
    background: '#ffffff',
    uploads: [],
    objects: [
    {
      id: 'headline',
      type: 'text',
      name: 'Text - Make it seamless',
      text: 'MAKE IT\nSEAMLESS.',
      x: 116,
      y: 310,
      width: 720,
      height: 250,
      rotation: 0,
      opacity: 1,
      fontSize: 112,
      fontFamily: 'Arial',
      fill: '#111827',
      bold: true,
      italic: false,
      align: 'left',
    },
    {
      id: 'subtitle',
      type: 'text',
      name: 'Text - Upload prompt',
      text: 'Upload photos, drag them across page boundaries, then export clean JPG slices.',
      x: 124,
      y: 620,
      width: 740,
      height: 92,
      rotation: 0,
      opacity: 0.76,
      fontSize: 34,
      fontFamily: 'Arial',
      fill: '#4b5563',
      bold: false,
      italic: false,
      align: 'left',
    },
    ],
  };
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function getImageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Image decoding failed.'));
    image.src = src;
  });
}

function cloneProject(project: CarouselProject): CarouselProject {
  if (typeof structuredClone === 'function') {
    return structuredClone(project);
  }
  return JSON.parse(JSON.stringify(project)) as CarouselProject;
}

function sanitizeFilename(name: string) {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'carousel'
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function textObject(input: Omit<TextObject, 'id' | 'type' | 'rotation' | 'opacity' | 'fontFamily' | 'italic' | 'align'> & Partial<Pick<TextObject, 'fontFamily' | 'italic' | 'align' | 'opacity' | 'rotation'>>) {
  return {
    id: id('text'),
    type: 'text' as const,
    rotation: 0,
    opacity: 1,
    fontFamily: 'Arial',
    italic: false,
    align: 'left' as const,
    ...input,
  };
}

function placeholderObject(input: Omit<PlaceholderObject, 'id' | 'type' | 'rotation' | 'opacity' | 'label'> & Partial<Pick<PlaceholderObject, 'label' | 'opacity' | 'rotation'>>) {
  return {
    id: id('placeholder'),
    type: 'placeholder' as const,
    label: 'Add photo',
    rotation: 0,
    opacity: 1,
    ...input,
  };
}

function shapeObject(input: Omit<ShapeObject, 'id' | 'type' | 'rotation' | 'opacity'> & Partial<Pick<ShapeObject, 'opacity' | 'rotation'>>) {
  return {
    id: id('shape'),
    type: 'shape' as const,
    rotation: 0,
    opacity: 1,
    ...input,
  };
}

export default function CarouselEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const restoredObjectUrls = useRef<string[]>([]);
  const [project, setProject] = useState<CarouselProject>(() => createBlankProject());
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [storageReady, setStorageReady] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('My Carousel');
  const [newProjectPages, setNewProjectPages] = useState(3);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>('Upload');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(42);
  const [undoStack, setUndoStack] = useState<CarouselProject[]>([]);
  const [redoStack, setRedoStack] = useState<CarouselProject[]>([]);
  const [clipboard, setClipboard] = useState<EditorObject | null>(null);
  const [dragUpload, setDragUpload] = useState<UploadedImage | null>(null);
  const [message, setMessage] = useState('Ready');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [cropModeId, setCropModeId] = useState<string | null>(null);
  const [cropDraft, setCropDraft] = useState<ImageObject | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpg');
  const [quality, setQuality] = useState<ExportQuality>(0.95);
  const [exportTarget, setExportTarget] = useState<'all' | 'selected'>('all');
  const [zipExport, setZipExport] = useState(true);
  const [individualExport, setIndividualExport] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectedObject = useMemo(
    () => project.objects.find((object) => object.id === selectedId) ?? null,
    [project.objects, selectedId],
  );
  const visibleProject = useMemo(() => {
    if (!cropDraft) return project;
    return {
      ...project,
      objects: project.objects.map((object) => (object.id === cropDraft.id ? cropDraft : object)),
    };
  }, [cropDraft, project]);

  async function refreshProjects() {
    try {
      setProjects(await listProjects());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read projects.');
    }
  }

  useEffect(() => {
    let active = true;

    async function restoreLastProject() {
      try {
        const lastId = getLastProjectId();
        const summaries = await listProjects();
        const initialId = lastId ?? summaries[0]?.id;
        const restored = initialId ? await loadProject(initialId) : null;
        if (!active) return;

        if (restored) {
          restoredObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
          restoredObjectUrls.current = restored.uploads.map((upload) => upload.src);
          setProject(restored);
          setMessage('Project restored');
        } else {
          const blank = createBlankProject();
          setProject(await saveProject(blank));
          setMessage('New project ready');
        }

        setProjects(await listProjects());
        setStorageReady(true);
        setSaveStatus('saved');
      } catch (error) {
        setStorageReady(true);
        setSaveStatus('failed');
        setMessage(error instanceof Error ? error.message : 'Project restore failed.');
      }
    }

    restoreLastProject();

    return () => {
      active = false;
      restoredObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    setSaveStatus('saving');
    const timer = window.setTimeout(async () => {
      try {
        const thumbnail = await renderProjectThumbnail(project);
        const saved = await saveProject(project, thumbnail);
        setProject((current) =>
          current.id === saved.id ? { ...current, updatedAt: saved.updatedAt, thumbnail: saved.thumbnail } : current,
        );
        await refreshProjects();
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('failed');
        setMessage(error instanceof Error ? error.message : 'Save failed.');
      }
    }, 1000);

    return () => window.clearTimeout(timer);
    // Project mutations are the intended autosave trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.name, project.pageCount, project.background, project.objects, project.uploads, storageReady]);

  function calculateFitZoom() {
    const scroller = scrollerRef.current;
    if (!scroller) return 42;

    const verticalPadding = 140;
    const horizontalPadding = 72;
    const heightZoom = ((scroller.clientHeight - verticalPadding) / PAGE_HEIGHT) * 100;
    const targetVisiblePages = project.pageCount >= 3 ? 1.55 : project.pageCount;
    const widthZoom = ((scroller.clientWidth - horizontalPadding) / (PAGE_WIDTH * targetVisiblePages)) * 100;
    return Math.round(clamp(Math.min(heightZoom, widthZoom), MIN_ZOOM, MAX_ZOOM));
  }

  function fitToWorkspace() {
    setZoom(calculateFitZoom());
  }

  function commit(next: CarouselProject, nextSelectedId = selectedId) {
    setUndoStack((stack) => [...stack.slice(-49), cloneProject(project)]);
    setRedoStack([]);
    setProject(next);
    setSelectedId(nextSelectedId);
    setContextMenu(null);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((stack) => [...stack.slice(-49), cloneProject(project)]);
    setUndoStack((stack) => stack.slice(0, -1));
    setProject(previous);
    setSelectedId(null);
    setMessage('Undo');
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack.slice(-49), cloneProject(project)]);
    setRedoStack((stack) => stack.slice(0, -1));
    setProject(next);
    setSelectedId(null);
    setMessage('Redo');
  }

  useEffect(() => {
    fitToWorkspace();

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new ResizeObserver(() => {
      setZoom(calculateFitZoom());
    });
    observer.observe(scroller);

    return () => observer.disconnect();
    // Fit intentionally tracks layout inputs rather than every project edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelCollapsed, project.pageCount]);

  function updateObject(object: EditorObject) {
    commit({ ...project, objects: project.objects.map((item) => (item.id === object.id ? object : item)) });
  }

  function insertImage(upload: UploadedImage, x = currentPage * PAGE_WIDTH + 170, y = 220) {
    const maxWidth = 640;
    const width = Math.min(maxWidth, upload.width);
    const height = width * (upload.height / upload.width);
    const object: EditorObject = {
      id: id('image'),
      type: 'image',
      name: `Photo - ${upload.name}`,
      imageId: upload.id,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      cropX: 0,
      cropY: 0,
      cropWidth: upload.width,
      cropHeight: upload.height,
      flipX: false,
      flipY: false,
    };

    commit({ ...project, objects: [...project.objects, object] }, object.id);
    setActiveTool('Photos');
  }

  function selectedImage() {
    return selectedObject?.type === 'image' ? selectedObject : null;
  }

  function selectedUpload(image: ImageObject | null) {
    return image ? project.uploads.find((upload) => upload.id === image.imageId) ?? null : null;
  }

  function fillImageCrop(image: ImageObject) {
    const upload = selectedUpload(image);
    if (!upload) return image;

    const frameRatio = image.width / image.height;
    const sourceRatio = upload.width / upload.height;
    let cropWidth = upload.width;
    let cropHeight = upload.height;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > frameRatio) {
      cropWidth = upload.height * frameRatio;
      cropX = (upload.width - cropWidth) / 2;
    } else {
      cropHeight = upload.width / frameRatio;
      cropY = (upload.height - cropHeight) / 2;
    }

    return { ...image, cropX, cropY, cropWidth, cropHeight };
  }

  function fitImageToFrame() {
    const image = selectedImage();
    const upload = selectedUpload(image);
    if (!image || !upload) return;

    const aspect = upload.height / upload.width;
    updateObject({
      ...image,
      height: image.width * aspect,
      cropX: 0,
      cropY: 0,
      cropWidth: upload.width,
      cropHeight: upload.height,
    });
    setMessage('Image fitted');
  }

  function fillImageFrame() {
    const image = selectedImage();
    if (!image) return;
    updateObject(fillImageCrop(image));
    setMessage('Image filled frame');
  }

  function flipSelectedImage(axis: 'x' | 'y') {
    const image = selectedImage();
    if (!image) return;
    updateObject({ ...image, flipX: axis === 'x' ? !image.flipX : image.flipX, flipY: axis === 'y' ? !image.flipY : image.flipY });
  }

  function startCrop(idToCrop = selectedId) {
    const image = project.objects.find((object): object is ImageObject => object.id === idToCrop && object.type === 'image');
    if (!image) return;
    setCropModeId(image.id);
    setCropDraft(cloneProject({ ...project, objects: [image] }).objects[0] as ImageObject);
    setSelectedId(image.id);
    setMessage('Crop mode');
  }

  function updateCropDraft(next: ImageObject) {
    setCropDraft(next);
  }

  function applyCrop() {
    if (!cropDraft) return;
    commit({ ...project, objects: project.objects.map((object) => (object.id === cropDraft.id ? cropDraft : object)) }, cropDraft.id);
    setCropDraft(null);
    setCropModeId(null);
    setMessage('Crop applied');
  }

  function cancelCrop() {
    setCropDraft(null);
    setCropModeId(null);
    setMessage('Crop cancelled');
  }

  async function replaceSelectedImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const image = selectedImage();
    if (!file || !image) return;

    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setMessage('Unsupported file type. Use JPG, PNG, or WEBP.');
        return;
      }
      const src = await fileToDataUrl(file);
      const size = await getImageSize(src);
      const upload = { id: id('asset'), name: file.name, src, blob: file, mimeType: file.type, ...size };
      commit({
        ...project,
        uploads: [...project.uploads, upload],
        objects: project.objects.map((object) =>
          object.id === image.id
            ? {
                ...image,
                name: `Photo - ${upload.name}`,
                imageId: upload.id,
                cropX: 0,
                cropY: 0,
                cropWidth: upload.width,
                cropHeight: upload.height,
                flipX: false,
                flipY: false,
              }
            : object,
        ),
      });
      setMessage('Image replaced');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image replacement failed.');
    }
  }

  function addText(kind: 'heading' | 'subheading' | 'body' = 'heading') {
    const settings = {
      heading: { text: 'Heading', fontSize: 100, width: 760, height: 130, bold: true },
      subheading: { text: 'Subheading', fontSize: 60, width: 720, height: 90, bold: true },
      body: { text: 'Body text goes here', fontSize: 36, width: 680, height: 120, bold: false },
    }[kind];
    const object: TextObject = {
      id: id('text'),
      type: 'text',
      name: `Text - ${settings.text}`,
      text: settings.text,
      x: currentPage * PAGE_WIDTH + PAGE_WIDTH / 2 - settings.width / 2,
      y: PAGE_HEIGHT / 2 - settings.height / 2,
      width: settings.width,
      height: settings.height,
      rotation: 0,
      opacity: 1,
      fontSize: settings.fontSize,
      fontFamily: 'Arial',
      fill: '#111827',
      bold: settings.bold,
      italic: false,
      align: 'left',
    };

    commit({ ...project, objects: [...project.objects, object] }, object.id);
    setActiveTool('Text');
  }

  function addShape(shape: 'rect' | 'roundRect' | 'ellipse' | 'line') {
    const isLine = shape === 'line';
    const object = shapeObject({
      name:
        shape === 'rect'
          ? 'Shape - Rectangle'
          : shape === 'roundRect'
            ? 'Shape - Rounded rectangle'
            : shape === 'line'
              ? 'Shape - Line'
              : 'Shape - Circle',
      shape,
      x: currentPage * PAGE_WIDTH + 180,
      y: 300,
      width: isLine ? 520 : shape === 'rect' || shape === 'roundRect' ? 420 : 320,
      height: isLine ? 8 : shape === 'ellipse' ? 320 : 260,
      fill: isLine ? 'transparent' : '#e2e8f0',
      stroke: '#94a3b8',
      strokeWidth: isLine ? 8 : 3,
      radius: shape === 'roundRect' ? 42 : undefined,
    });

    commit({ ...project, objects: [...project.objects, object] }, object.id);
    setActiveTool('Elements');
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit({ ...project, objects: project.objects.filter((object) => object.id !== selectedId) }, null);
    if (cropModeId === selectedId) cancelCrop();
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    const duplicate = {
      ...cloneProject({ ...project, objects: [selectedObject] }).objects[0],
      id: id(selectedObject.type),
      name: `${selectedObject.name} copy`,
      x: selectedObject.x + 60,
      y: selectedObject.y + 60,
    };
    commit({ ...project, objects: [...project.objects, duplicate] }, duplicate.id);
  }

  function moveSelected(deltaX: number, deltaY: number) {
    if (!selectedObject) return;
    updateObject({ ...selectedObject, x: selectedObject.x + deltaX, y: selectedObject.y + deltaY });
  }

  function recenterSelected() {
    if (!selectedObject) return;
    const pageX = currentPage * PAGE_WIDTH;
    updateObject({
      ...selectedObject,
      x: pageX + PAGE_WIDTH / 2 - selectedObject.width / 2,
      y: PAGE_HEIGHT / 2 - selectedObject.height / 2,
    });
    setMessage('Object recentered');
  }

  function moveLayer(idToMove: string, direction: 'front' | 'back' | 'forward' | 'backward') {
    const objects = [...project.objects];
    const index = objects.findIndex((object) => object.id === idToMove);
    if (index < 0) return;
    const [object] = objects.splice(index, 1);
    const target =
      direction === 'front'
        ? objects.length
        : direction === 'back'
          ? 0
          : direction === 'forward'
            ? Math.min(objects.length, index + 1)
            : Math.max(0, index - 1);
    objects.splice(target, 0, object);
    commit({ ...project, objects });
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    try {
      const supported = files.filter((file) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      );
      if (supported.length !== files.length) {
        setMessage('Some files were skipped. Use JPG, PNG, or WEBP.');
      }

      const uploads = await Promise.all(
        supported.map(async (file) => {
          if (file.size > 16 * 1024 * 1024) {
            throw new Error(`${file.name} is larger than 16MB.`);
          }
          const src = await fileToDataUrl(file);
          const size = await getImageSize(src);
          return { id: id('asset'), name: file.name, src, blob: file, mimeType: file.type, ...size };
        }),
      );

      const next = { ...project, uploads: [...project.uploads, ...uploads] };
      commit(next);
      setMessage(`${uploads.length} image${uploads.length === 1 ? '' : 's'} uploaded`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  function addPage() {
    if (project.pageCount >= MAX_PAGES) return;
    commit({ ...project, pageCount: project.pageCount + 1 });
    setCurrentPage(project.pageCount);
  }

  function deletePage(pageIndex = currentPage) {
    if (project.pageCount <= MIN_PAGES) return;
    const start = pageIndex * PAGE_WIDTH;
    const end = start + PAGE_WIDTH;
    const objects = project.objects
      .filter((object) => object.x + object.width <= start || object.x >= end)
      .map((object) => (object.x >= end ? { ...object, x: object.x - PAGE_WIDTH } : object));
    commit({ ...project, pageCount: project.pageCount - 1, objects }, null);
    setCurrentPage(Math.max(0, Math.min(pageIndex, project.pageCount - 2)));
  }

  function movePage(direction: -1 | 1) {
    const target = currentPage + direction;
    if (target < 0 || target >= project.pageCount) return;
    const fromStart = currentPage * PAGE_WIDTH;
    const toStart = target * PAGE_WIDTH;
    const low = Math.min(fromStart, toStart);
    const high = Math.max(fromStart, toStart);
    const objects = project.objects.map((object) => {
      if (object.x >= fromStart && object.x < fromStart + PAGE_WIDTH) {
        return { ...object, x: object.x + direction * PAGE_WIDTH };
      }
      if (object.x >= low && object.x < high + PAGE_WIDTH) {
        return { ...object, x: object.x - direction * PAGE_WIDTH };
      }
      return object;
    });
    commit({ ...project, objects });
    setCurrentPage(target);
  }

  function applyTemplate(template: 'minimal' | 'travel' | 'dump') {
    const p1 = 0;
    const p2 = PAGE_WIDTH;
    const p3 = PAGE_WIDTH * 2;
    const objects: EditorObject[] =
      template === 'minimal'
        ? [
            textObject({
              name: 'Text - Minimal title',
              text: 'A CLEAN\nIDEA',
              x: p1 + 130,
              y: 390,
              width: 760,
              height: 310,
              fontSize: 132,
              fill: '#111827',
              bold: true,
            }),
            textObject({
              name: 'Text - Minimal subtitle',
              text: 'Whitespace, rhythm, and one strong story.',
              x: p1 + 138,
              y: 760,
              width: 650,
              height: 70,
              fontSize: 34,
              fill: '#64748b',
              bold: false,
            }),
            placeholderObject({
              name: 'Photo placeholder - Minimal feature',
              x: p2 + 150,
              y: 210,
              width: 780,
              height: 760,
            }),
            textObject({
              name: 'Text - Minimal page note',
              text: 'Drop in a hero image or product moment.',
              x: p2 + 170,
              y: 1035,
              width: 720,
              height: 58,
              fontSize: 30,
              fill: '#475569',
              bold: false,
              align: 'center',
            }),
            textObject({
              name: 'Text - Minimal close',
              text: 'SAVE THIS\nFOR LATER',
              x: p3 + 150,
              y: 455,
              width: 820,
              height: 230,
              fontSize: 96,
              fill: '#111827',
              bold: true,
              align: 'center',
            }),
            textObject({
              name: 'Text - Minimal CTA',
              text: 'Export clean 1080 × 1350 JPG pages.',
              x: p3 + 210,
              y: 740,
              width: 700,
              height: 58,
              fontSize: 28,
              fill: '#64748b',
              bold: false,
              align: 'center',
            }),
          ]
        : template === 'travel'
          ? [
              textObject({
                name: 'Text - Travel',
                text: 'TRAVEL',
                x: p1 + 118,
                y: 250,
                width: 800,
                height: 160,
                fontSize: 138,
                fill: '#0f172a',
                bold: true,
              }),
              textObject({
                name: 'Text - Travel story',
                text: 'CHIANG MAI',
                x: p1 + 126,
                y: 430,
                width: 840,
                height: 120,
                fontSize: 86,
                fill: '#0f766e',
                bold: true,
              }),
              textObject({
                name: 'Text - Travel note',
                text: 'temples, coffee, mountain light',
                x: p1 + 132,
                y: 565,
                width: 680,
                height: 70,
                fontSize: 34,
                fill: '#334155',
                bold: false,
              }),
              placeholderObject({
                name: 'Photo placeholder - Cross-page travel',
                x: p1 + 910,
                y: 235,
                width: 940,
                height: 650,
              }),
              textObject({
                name: 'Text - Location title',
                text: 'OLD CITY\nWALK',
                x: p2 + 160,
                y: 935,
                width: 720,
                height: 160,
                fontSize: 70,
                fill: '#0f172a',
                bold: true,
                align: 'center',
              }),
              placeholderObject({
                name: 'Photo placeholder - Travel finale',
                x: p3 + 120,
                y: 180,
                width: 840,
                height: 820,
              }),
              textObject({
                name: 'Text - Travel final note',
                text: 'A slow weekend guide for the north.',
                x: p3 + 150,
                y: 1085,
                width: 780,
                height: 60,
                fontSize: 30,
                fill: '#475569',
                bold: false,
                align: 'center',
              }),
            ]
          : [
              textObject({
                name: 'Text - Photo dump',
                text: 'PHOTO\nDUMP\n01',
                x: p1 + 130,
                y: 260,
                width: 900,
                height: 470,
                fontSize: 126,
                fill: '#111827',
                bold: true,
              }),
              textObject({
                name: 'Text - Photo dump date',
                text: 'moments worth sliding through',
                x: p1 + 140,
                y: 800,
                width: 650,
                height: 70,
                fontSize: 32,
                fill: '#4b5563',
                bold: false,
              }),
              placeholderObject({
                name: 'Photo placeholder - Dump center',
                x: p2 + 120,
                y: 160,
                width: 840,
                height: 900,
              }),
              placeholderObject({
                name: 'Photo placeholder - Dump finale',
                x: p3 + 130,
                y: 210,
                width: 660,
                height: 760,
              }),
              textObject({
                name: 'Text - Dump caption',
                text: 'the little scenes that made the week',
                x: p3 + 160,
                y: 1035,
                width: 760,
                height: 76,
                fontSize: 34,
                fill: '#334155',
                bold: false,
              }),
              shapeObject({
                name: 'Shape - Accent block',
                shape: 'rect',
                x: p3 + 810,
                y: 210,
                width: 110,
                height: 760,
                fill: '#111827',
                stroke: '#111827',
                strokeWidth: 0,
              }),
            ];

    commit({ ...project, pageCount: Math.max(3, project.pageCount), objects }, objects[0]?.id ?? selectedId);
    setCurrentPage(0);
    setActiveTool('Layers');
  }

  async function openPreview() {
    try {
      setMessage('Rendering preview...');
      setPreviewUrls(await renderCarouselPages(project, 0.9));
      setMessage('Preview ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview failed.');
    }
  }

  async function exportCarousel() {
    if (exporting) return;

    try {
      setExporting(true);
      setExportProgress('Preparing pages...');
      const selectedPage = exportTarget === 'selected' ? currentPage : undefined;
      const pages = await renderCarouselPageBlobs(project, quality, selectedPage, exportFormat);
      const basename = sanitizeFilename(project.name);
      const extension = exportFormat === 'png' ? 'png' : 'jpg';

      pages.forEach((_blob, index) => {
        setExportProgress(`Exporting ${index + 1} / ${pages.length}`);
      });

      if (zipExport && pages.length > 1) {
        setExportProgress('Creating ZIP...');
        const zip = new JSZip();
        pages.forEach((blob, index) => {
          const pageNumber = selectedPage === undefined ? index + 1 : selectedPage + 1;
          zip.file(`${basename}-${String(pageNumber).padStart(2, '0')}.${extension}`, blob);
        });
        downloadBlob(await zip.generateAsync({ type: 'blob' }), `${basename}.zip`);
      }

      if (!zipExport || individualExport || pages.length === 1) {
        pages.forEach((blob, index) => {
          const pageNumber = selectedPage === undefined ? index + 1 : selectedPage + 1;
          downloadBlob(blob, `${basename}-${String(pageNumber).padStart(2, '0')}.${extension}`);
        });
      }

      setExportProgress('Download ready ✓');
      setMessage(`Exported ${pages.length} ${extension.toUpperCase()} page${pages.length === 1 ? '' : 's'}`);
    } catch (error) {
      setExportProgress('Export failed');
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function saveLocalProject() {
    try {
      setSaveStatus('saving');
      const thumbnail = await renderProjectThumbnail(project);
      const saved = await saveProject(project, thumbnail);
      setProject((current) => ({ ...current, updatedAt: saved.updatedAt, thumbnail: saved.thumbnail }));
      await refreshProjects();
      setSaveStatus('saved');
      setMessage('Project saved');
    } catch (error) {
      setSaveStatus('failed');
      setMessage(error instanceof Error ? error.message : 'Project save failed.');
    }
  }

  async function openProject(projectId: string) {
    try {
      const saved = await loadProject(projectId);
      if (!saved) {
        setMessage('Project not found');
        return;
      }
      restoredObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      restoredObjectUrls.current = saved.uploads.map((upload) => upload.src);
      setProject(saved);
      setSelectedId(null);
      setCurrentPage(0);
      setSaveStatus('saved');
      setMessage(`Opened ${saved.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Project load failed.');
    }
  }

  async function createProjectFromModal() {
    const next = createBlankProject(newProjectName.trim() || 'My Carousel', newProjectPages);
    setProject(next);
    setSelectedId(null);
    setCurrentPage(0);
    setNewProjectOpen(false);
    await saveProject(next);
    await refreshProjects();
    setMessage('New project created');
  }

  async function duplicateExistingProject(projectId: string) {
    try {
      const copy = await duplicateProject(projectId, id('project'));
      await refreshProjects();
      setMessage(`Duplicated ${copy.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Duplicate failed.');
    }
  }

  async function renameExistingProject(projectId: string, name: string) {
    const nextName = name.trim();
    if (!nextName) return;

    try {
      if (projectId === project.id) {
        setProject((current) => ({ ...current, name: nextName }));
      } else {
        const saved = await loadProject(projectId);
        if (!saved) {
          setMessage('Project not found');
          return;
        }
        await saveProject({ ...saved, name: nextName }, saved.thumbnail);
        await refreshProjects();
      }
      setMessage('Project renamed');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rename failed.');
    }
  }

  async function confirmDeleteProject() {
    if (!deleteProjectId) return;

    try {
      await deleteProject(deleteProjectId);
      const remaining = await listProjects();
      setProjects(remaining);
      setDeleteProjectId(null);

      if (deleteProjectId === project.id) {
        const next = remaining[0] ? await loadProject(remaining[0].id) : createBlankProject();
        if (next) {
          setProject(next);
          setSelectedId(null);
          setCurrentPage(0);
          if (!remaining[0]) await saveProject(next);
        }
      }

      if (!remaining.length) clearLastProjectId();
      setMessage('Project deleted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed.');
    }
  }

  function startNewProject() {
    setNewProjectName('My Carousel');
    setNewProjectPages(3);
    setNewProjectOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteSelected();
      }
      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (isMod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if (isMod && event.key.toLowerCase() === 'd' && selectedObject) {
        event.preventDefault();
        duplicateSelected();
      }
      if (isMod && event.key.toLowerCase() === 'c' && selectedObject) {
        event.preventDefault();
        setClipboard(selectedObject);
      }
      if (isMod && event.key.toLowerCase() === 'v' && clipboard) {
        event.preventDefault();
        const pasted = { ...clipboard, id: id(clipboard.type), name: `${clipboard.name} copy`, x: clipboard.x + 60, y: clipboard.y + 60 };
        commit({ ...project, objects: [...project.objects, pasted] }, pasted.id);
      }
      if (selectedObject && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        moveSelected(dx, dy);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The shortcut handler is rebound when editor state changes so copy/paste and history use fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboard, project, selectedId, selectedObject, undoStack, redoStack]);

  return (
    <main className={panelCollapsed ? 'appShell panelCollapsed' : 'appShell'}>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">C</span>
          <span>
            <b>CAROUSEL</b> STUDIO
          </span>
        </div>
        <input
          className="projectName"
          value={project.name}
          onChange={(event) => setProject({ ...project, name: event.target.value })}
          aria-label="Project name"
        />
        <span className={`saveStatus ${saveStatus}`}>
          {saveStatus === 'saving'
            ? 'Saving...'
            : saveStatus === 'failed'
              ? 'Save failed'
              : storageReady
                ? 'Saved'
                : 'Opening...'}
        </span>
        <div className="topActions">
          <button className="iconButton" onClick={undo} disabled={!undoStack.length} title="Undo">
            ↶
          </button>
          <button className="iconButton" onClick={redo} disabled={!redoStack.length} title="Redo">
            ↷
          </button>
          <button className="previewButton" onClick={openPreview}>
            ▷ Preview
          </button>
          <button className="exportButton" onClick={() => setExportOpen(true)}>
            Export
          </button>
        </div>
      </header>

      <aside className="sidebar">
        {tools.map((tool) => (
          <button
            key={tool.label}
            className={activeTool === tool.label ? 'tool active' : 'tool'}
            onClick={() => {
              setActiveTool(tool.label);
              if (tool.label === 'Upload') inputRef.current?.click();
            }}
          >
            <span>{tool.icon}</span>
            {tool.label}
          </button>
        ))}
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={uploadFiles}
        />
        <input
          ref={replaceInputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={replaceSelectedImage}
        />
      </aside>

      <section className="panel">
        <button
          className="collapseButton"
          onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
          title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {panelCollapsed ? '›' : '‹'}
        </button>
        <PanelContent
          activeTool={activeTool}
          project={project}
          selectedObject={selectedObject}
          currentPage={currentPage}
          onUpload={() => inputRef.current?.click()}
          onInsertImage={insertImage}
          onSetDragUpload={setDragUpload}
          onAddText={addText}
          onAddShape={addShape}
          onApplyTemplate={applyTemplate}
          onChangeProject={(next) => commit(next)}
          onChangeObject={updateObject}
          onSelect={setSelectedId}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onMoveLayer={moveLayer}
          onSave={saveLocalProject}
          projects={projects}
          saveStatus={saveStatus}
          onOpenProject={openProject}
          onRenameProject={renameExistingProject}
          onDuplicateProject={duplicateExistingProject}
          onRequestDeleteProject={setDeleteProjectId}
          onNewProject={startNewProject}
        />
      </section>

      <section className="workspace">
        <div className="workspaceHead">
          <div>
            <b>Instagram Portrait</b>
            <span className="muted">1080 × 1350 per page · continuous canvas</span>
          </div>
          <div className="badge">{project.pageCount} pages</div>
        </div>
        <ContextualToolbar
          selectedObject={cropDraft ?? selectedObject}
          cropMode={Boolean(cropModeId)}
          uploads={project.uploads}
          onChangeObject={(object) => (cropModeId && object.type === 'image' ? updateCropDraft(object) : updateObject(object))}
          onReplaceImage={() => replaceInputRef.current?.click()}
          onCrop={() => startCrop()}
          onFitImage={fitImageToFrame}
          onFillImage={fillImageFrame}
          onFlipImage={flipSelectedImage}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onMoveLayer={moveLayer}
          onRecenter={recenterSelected}
          onApplyCrop={applyCrop}
          onCancelCrop={cancelCrop}
        />
        <div className="canvasScroller" ref={scrollerRef}>
          <EditorStage
            project={visibleProject}
            selectedId={selectedId}
            zoom={zoom}
            onSelect={setSelectedId}
            onChangeObject={updateObject}
            onDropImage={(upload, x, y) => insertImage(upload, x, y)}
            dragUpload={dragUpload}
            onEditText={(idToEdit) => {
              setSelectedId(idToEdit);
              setActiveTool('Text');
            }}
            onEditImage={startCrop}
            snapEnabled={snapEnabled}
            cropModeId={cropModeId}
            onContextMenu={(idToOpen, x, y) => setContextMenu({ id: idToOpen, x, y })}
          />
        </div>
      </section>

      <footer className="statusbar">
        <span>{message}</span>
        <span>
          Page {String(currentPage + 1).padStart(2, '0')} / {project.pageCount}
        </span>
        <button onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}>◀</button>
        <button onClick={() => setCurrentPage((page) => Math.min(project.pageCount - 1, page + 1))}>▶</button>
        <button onClick={addPage}>+ Page</button>
        <button onClick={() => deletePage()}>Delete Page</button>
        <button onClick={() => movePage(-1)}>Move Left</button>
        <button onClick={() => movePage(1)}>Move Right</button>
        <button className={snapEnabled ? 'activeStatusButton' : ''} onClick={() => setSnapEnabled((enabled) => !enabled)}>
          Snap {snapEnabled ? 'ON' : 'OFF'}
        </button>
        <div className="zoom">
          <button onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 10))}>−</button>
          <span>{zoom}%</span>
          <button onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 10))}>+</button>
          <button onClick={fitToWorkspace}>Fit</button>
        </div>
      </footer>

      {previewUrls && (
        <div className="modal" onClick={() => setPreviewUrls(null)}>
          <div className="previewCard" onClick={(event) => event.stopPropagation()}>
            <div className="previewHead">
              <b>Carousel Preview</b>
              <button onClick={() => setPreviewUrls(null)}>×</button>
            </div>
            <div className="previewPages">
              {previewUrls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`preview-${index}`} className="previewPage" src={url} alt={`Preview page ${index + 1}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="modal" onClick={() => setExportOpen(false)}>
          <div className="exportCard" onClick={(event) => event.stopPropagation()}>
            <div className="previewHead">
              <b>Export Carousel</b>
              <button onClick={() => setExportOpen(false)} disabled={exporting}>×</button>
            </div>
            <div className="exportMeta">
              <span>1080 × 1350 px</span>
              <span>{exportTarget === 'all' ? `${project.pageCount} pages selected` : `Page ${currentPage + 1} selected`}</span>
            </div>
            <div className="segmented two">
              {(['jpg', 'png'] as const).map((format) => (
                <button
                  key={format}
                  className={exportFormat === format ? 'active' : ''}
                  onClick={() => setExportFormat(format)}
                  disabled={exporting}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            {exportFormat === 'jpg' && (
              <label>
                JPG quality
                <select value={quality} onChange={(event) => setQuality(Number(event.target.value) as ExportQuality)} disabled={exporting}>
                  <option value={0.8}>80%</option>
                  <option value={0.9}>90%</option>
                  <option value={0.95}>95%</option>
                  <option value={1}>100%</option>
                </select>
              </label>
            )}
            <div className="segmented two">
              <button className={exportTarget === 'all' ? 'active' : ''} onClick={() => setExportTarget('all')} disabled={exporting}>
                All pages
              </button>
              <button className={exportTarget === 'selected' ? 'active' : ''} onClick={() => setExportTarget('selected')} disabled={exporting}>
                Current page
              </button>
            </div>
            <label className="checkRow">
              <input type="checkbox" checked={zipExport} onChange={(event) => setZipExport(event.target.checked)} disabled={exporting} />
              Download as ZIP
            </label>
            <label className="checkRow">
              <input type="checkbox" checked={individualExport} onChange={(event) => setIndividualExport(event.target.checked)} disabled={exporting} />
              Also download individual files
            </label>
            {exportProgress && <div className="progressNote">{exportProgress}</div>}
            <button className="exportButton wide" onClick={exportCarousel} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Download'}
            </button>
          </div>
        </div>
      )}
      {newProjectOpen && (
        <div className="modal" onClick={() => setNewProjectOpen(false)}>
          <div className="exportCard" onClick={(event) => event.stopPropagation()}>
            <div className="previewHead">
              <b>New Project</b>
              <button onClick={() => setNewProjectOpen(false)}>×</button>
            </div>
            <label>
              Name
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} autoFocus />
            </label>
            <label>
              Pages
              <input
                type="number"
                min={MIN_PAGES}
                max={MAX_PAGES}
                value={newProjectPages}
                onChange={(event) => setNewProjectPages(clamp(Number(event.target.value), MIN_PAGES, MAX_PAGES))}
              />
            </label>
            <button className="exportButton wide" onClick={createProjectFromModal}>
              Create Project
            </button>
          </div>
        </div>
      )}
      {deleteProjectId && (
        <div className="modal" onClick={() => setDeleteProjectId(null)}>
          <div className="exportCard" onClick={(event) => event.stopPropagation()}>
            <div className="previewHead">
              <b>Delete Project</b>
              <button onClick={() => setDeleteProjectId(null)}>×</button>
            </div>
            <p className="panelNote">Delete this local project from this browser? This cannot be undone.</p>
            <div className="modalActions">
              <button onClick={() => setDeleteProjectId(null)}>Cancel</button>
              <button className="dangerButton" onClick={confirmDeleteProject}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && selectedObject && (
        <div
          className="contextMenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={duplicateSelected}>Duplicate</button>
          <button onClick={deleteSelected}>Delete</button>
          <button onClick={() => selectedObject && moveLayer(selectedObject.id, 'front')}>Bring to Front</button>
          <button onClick={() => selectedObject && moveLayer(selectedObject.id, 'forward')}>Bring Forward</button>
          <button onClick={() => selectedObject && moveLayer(selectedObject.id, 'backward')}>Send Backward</button>
          <button onClick={() => selectedObject && moveLayer(selectedObject.id, 'back')}>Send to Back</button>
        </div>
      )}
      <div className="toast">{message}</div>
    </main>
  );
}

function ContextualToolbar({
  selectedObject,
  cropMode,
  uploads,
  onChangeObject,
  onReplaceImage,
  onCrop,
  onFitImage,
  onFillImage,
  onFlipImage,
  onDuplicate,
  onDelete,
  onMoveLayer,
  onRecenter,
  onApplyCrop,
  onCancelCrop,
}: {
  selectedObject: EditorObject | null;
  cropMode: boolean;
  uploads: UploadedImage[];
  onChangeObject: (object: EditorObject) => void;
  onReplaceImage: () => void;
  onCrop: () => void;
  onFitImage: () => void;
  onFillImage: () => void;
  onFlipImage: (axis: 'x' | 'y') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onRecenter: () => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}) {
  if (!selectedObject) {
    return <div className="contextToolbar empty">Select an object to edit</div>;
  }

  if (selectedObject.type === 'image') {
    const upload = uploads.find((item) => item.id === selectedObject.imageId);
    return (
      <div className={cropMode ? 'contextToolbar cropActive' : 'contextToolbar'}>
        <strong>{cropMode ? 'Crop image' : 'Image'}</strong>
        {!cropMode ? (
          <>
            <button onClick={onReplaceImage}>Replace image</button>
            <button onClick={onCrop}>Crop</button>
            <button onClick={onFitImage}>Fit</button>
            <button onClick={onFillImage}>Fill</button>
            <button onClick={() => onFlipImage('x')}>Flip H</button>
            <button onClick={() => onFlipImage('y')}>Flip V</button>
          </>
        ) : (
          <>
            <label>
              X
              <input
                type="range"
                min={0}
                max={Math.max(0, (upload?.width ?? selectedObject.cropWidth) - selectedObject.cropWidth)}
                value={selectedObject.cropX}
                onChange={(event) => onChangeObject({ ...selectedObject, cropX: Number(event.target.value) })}
              />
            </label>
            <label>
              Y
              <input
                type="range"
                min={0}
                max={Math.max(0, (upload?.height ?? selectedObject.cropHeight) - selectedObject.cropHeight)}
                value={selectedObject.cropY}
                onChange={(event) => onChangeObject({ ...selectedObject, cropY: Number(event.target.value) })}
              />
            </label>
            <label>
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={(upload?.width ?? selectedObject.cropWidth) / selectedObject.cropWidth}
                onChange={(event) => {
                  if (!upload) return;
                  const zoom = Number(event.target.value);
                  const frameRatio = selectedObject.width / selectedObject.height;
                  const cropWidth = upload.width / zoom;
                  const cropHeight = cropWidth / frameRatio;
                  onChangeObject({
                    ...selectedObject,
                    cropWidth: Math.min(upload.width, cropWidth),
                    cropHeight: Math.min(upload.height, cropHeight),
                    cropX: Math.min(selectedObject.cropX, Math.max(0, upload.width - cropWidth)),
                    cropY: Math.min(selectedObject.cropY, Math.max(0, upload.height - cropHeight)),
                  });
                }}
              />
            </label>
            <button className="primaryPanelButton" onClick={onApplyCrop}>Apply</button>
            <button onClick={onCancelCrop}>Cancel</button>
          </>
        )}
        <label>
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={selectedObject.opacity}
            onChange={(event) => onChangeObject({ ...selectedObject, opacity: Number(event.target.value) })}
          />
        </label>
        <button onClick={onDuplicate}>Duplicate</button>
        <button onClick={onDelete}>Delete</button>
        <button onClick={() => onMoveLayer(selectedObject.id, 'forward')}>Forward</button>
        <button onClick={() => onMoveLayer(selectedObject.id, 'backward')}>Backward</button>
        <button onClick={onRecenter}>Recenter</button>
      </div>
    );
  }

  if (selectedObject.type === 'text') {
    return (
      <div className="contextToolbar">
        <strong>Text</strong>
        <select value={selectedObject.fontFamily} onChange={(event) => onChangeObject({ ...selectedObject, fontFamily: event.target.value })}>
          {fonts.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </select>
        <input
          className="smallNumber"
          type="number"
          min={16}
          max={220}
          value={selectedObject.fontSize}
          onChange={(event) => onChangeObject({ ...selectedObject, fontSize: Number(event.target.value) })}
        />
        <button className={selectedObject.bold ? 'active' : ''} onClick={() => onChangeObject({ ...selectedObject, bold: !selectedObject.bold })}>B</button>
        <button className={selectedObject.italic ? 'active' : ''} onClick={() => onChangeObject({ ...selectedObject, italic: !selectedObject.italic })}>I</button>
        {(['left', 'center', 'right'] as const).map((align) => (
          <button key={align} className={selectedObject.align === align ? 'active' : ''} onClick={() => onChangeObject({ ...selectedObject, align })}>
            {align[0].toUpperCase()}
          </button>
        ))}
        <input type="color" value={selectedObject.fill} onChange={(event) => onChangeObject({ ...selectedObject, fill: event.target.value })} />
        <label>
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={selectedObject.opacity}
            onChange={(event) => onChangeObject({ ...selectedObject, opacity: Number(event.target.value) })}
          />
        </label>
      </div>
    );
  }

  if (selectedObject.type === 'shape') {
    return (
      <div className="contextToolbar">
        <strong>Element</strong>
        {selectedObject.shape !== 'line' && (
          <label>
            Fill
            <input type="color" value={selectedObject.fill === 'transparent' ? '#ffffff' : selectedObject.fill} onChange={(event) => onChangeObject({ ...selectedObject, fill: event.target.value })} />
          </label>
        )}
        <label>
          Border
          <input type="color" value={selectedObject.stroke} onChange={(event) => onChangeObject({ ...selectedObject, stroke: event.target.value })} />
        </label>
        <label>
          Width
          <input
            className="smallNumber"
            type="number"
            min={0}
            max={40}
            value={selectedObject.strokeWidth}
            onChange={(event) => onChangeObject({ ...selectedObject, strokeWidth: Number(event.target.value) })}
          />
        </label>
        <label>
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={selectedObject.opacity}
            onChange={(event) => onChangeObject({ ...selectedObject, opacity: Number(event.target.value) })}
          />
        </label>
        <button onClick={onDuplicate}>Duplicate</button>
        <button onClick={onDelete}>Delete</button>
        <button onClick={onRecenter}>Recenter</button>
      </div>
    );
  }

  return (
    <div className="contextToolbar">
      <strong>Placeholder</strong>
      <button onClick={onDuplicate}>Duplicate</button>
      <button onClick={onDelete}>Delete</button>
      <button onClick={onRecenter}>Recenter</button>
    </div>
  );
}

function PanelContent({
  activeTool,
  project,
  selectedObject,
  currentPage,
  onUpload,
  onInsertImage,
  onSetDragUpload,
  onAddText,
  onAddShape,
  onApplyTemplate,
  onChangeProject,
  onChangeObject,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveLayer,
  onSave,
  projects,
  saveStatus,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onRequestDeleteProject,
  onNewProject,
}: {
  activeTool: ToolName;
  project: CarouselProject;
  selectedObject: EditorObject | null;
  currentPage: number;
  onUpload: () => void;
  onInsertImage: (upload: UploadedImage) => void;
  onSetDragUpload: (upload: UploadedImage | null) => void;
  onAddText: (kind?: 'heading' | 'subheading' | 'body') => void;
  onAddShape: (shape: 'rect' | 'roundRect' | 'ellipse' | 'line') => void;
  onApplyTemplate: (template: 'minimal' | 'travel' | 'dump') => void;
  onChangeProject: (project: CarouselProject) => void;
  onChangeObject: (object: EditorObject) => void;
  onSelect: (id: string | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onSave: () => void;
  projects: ProjectSummary[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  onOpenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onRequestDeleteProject: (projectId: string) => void;
  onNewProject: () => void;
}) {
  if (activeTool === 'Templates') {
    return (
      <div className="panelSection">
        <h2>Templates</h2>
        <button className="templateCard" onClick={() => onApplyTemplate('minimal')}>
          <b>Minimal</b>
          <span>Whitespace, hero text, image block, final CTA.</span>
        </button>
        <button className="templateCard" onClick={() => onApplyTemplate('travel')}>
          <b>Travel Story</b>
          <span>Cross-page image placeholder with destination notes.</span>
        </button>
        <button className="templateCard" onClick={() => onApplyTemplate('dump')}>
          <b>Photo Dump</b>
          <span>Large photo spaces with a bold opening page.</span>
        </button>
      </div>
    );
  }

  if (activeTool === 'Photos' || activeTool === 'Upload') {
    return (
      <div className="panelSection">
        <h2>Photos</h2>
        <button className="primaryPanelButton" onClick={onUpload}>
          Upload photos
        </button>
        {!project.uploads.length && (
          <p className="panelNote">Upload JPG, PNG, or WEBP images, then click or drag a thumbnail onto the canvas.</p>
        )}
        <div className="photoGrid">
          {project.uploads.map((upload) => (
            <button key={upload.id} title={upload.name} onClick={() => onInsertImage(upload)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upload.src}
                alt={upload.name}
                draggable
                onDragStart={() => onSetDragUpload(upload)}
                onDragEnd={() => onSetDragUpload(null)}
              />
              <span>{upload.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeTool === 'Text') {
    const textObject = selectedObject?.type === 'text' ? selectedObject : null;
    return (
      <div className="panelSection">
        <h2>Text</h2>
        <div className="textPresetGrid">
          <button className="primaryPanelButton" onClick={() => onAddText('heading')}>
            Add Heading
          </button>
          <button onClick={() => onAddText('subheading')}>Add Subheading</button>
          <button onClick={() => onAddText('body')}>Add Body Text</button>
        </div>
        {textObject && (
          <>
            <label>
              Content
              <textarea
                value={textObject.text}
                onChange={(event) =>
                  onChangeObject({ ...textObject, text: event.target.value, name: `Text - ${event.target.value.slice(0, 18)}` })
                }
              />
            </label>
            <label>
              Font
              <select value={textObject.fontFamily} onChange={(event) => onChangeObject({ ...textObject, fontFamily: event.target.value })}>
                {fonts.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
            <label>
              Size
              <input
                type="number"
                min={12}
                max={220}
                value={textObject.fontSize}
                onChange={(event) => onChangeObject({ ...textObject, fontSize: Number(event.target.value) })}
              />
            </label>
            <div className="segmented">
              <button className={textObject.bold ? 'active' : ''} onClick={() => onChangeObject({ ...textObject, bold: !textObject.bold })}>
                B
              </button>
              <button className={textObject.italic ? 'active' : ''} onClick={() => onChangeObject({ ...textObject, italic: !textObject.italic })}>
                I
              </button>
              {(['left', 'center', 'right'] as const).map((align) => (
                <button key={align} className={textObject.align === align ? 'active' : ''} onClick={() => onChangeObject({ ...textObject, align })}>
                  {align[0].toUpperCase()}
                </button>
              ))}
            </div>
            <label>
              Color
              <input type="color" value={textObject.fill} onChange={(event) => onChangeObject({ ...textObject, fill: event.target.value })} />
            </label>
            <label>
              Opacity
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={textObject.opacity}
                onChange={(event) => onChangeObject({ ...textObject, opacity: Number(event.target.value) })}
              />
            </label>
          </>
        )}
      </div>
    );
  }

  if (activeTool === 'Background') {
    return (
      <div className="panelSection">
        <h2>Background</h2>
        <div className="swatches">
          {presets.map((color) => (
            <button
              key={color}
              style={{ background: color }}
              className={project.background === color ? 'active' : ''}
              onClick={() => onChangeProject({ ...project, background: color })}
              aria-label={color}
            />
          ))}
        </div>
        <label>
          Custom color
          <input type="color" value={project.background} onChange={(event) => onChangeProject({ ...project, background: event.target.value })} />
        </label>
      </div>
    );
  }

  if (activeTool === 'Layers') {
    return (
      <div className="panelSection">
        <h2>Layers</h2>
        <div className="layerList">
          {[...project.objects].reverse().map((object) => (
            <button key={object.id} className={selectedObject?.id === object.id ? 'active' : ''} onClick={() => onSelect(object.id)}>
              <span>{object.name}</span>
              <small>{object.type}</small>
            </button>
          ))}
        </div>
        <div className="panelGrid">
          <button onClick={() => selectedObject && onMoveLayer(selectedObject.id, 'front')}>Front</button>
          <button onClick={() => selectedObject && onMoveLayer(selectedObject.id, 'forward')}>Forward</button>
          <button onClick={() => selectedObject && onMoveLayer(selectedObject.id, 'backward')}>Backward</button>
          <button onClick={() => selectedObject && onMoveLayer(selectedObject.id, 'back')}>Back</button>
        </div>
        <div className="panelGrid">
          <button onClick={onDuplicate}>Duplicate</button>
          <button onClick={onDelete}>Delete</button>
        </div>
      </div>
    );
  }

  if (activeTool === 'Projects') {
    return (
      <div className="panelSection">
        <h2>Projects</h2>
        <button className="primaryPanelButton" onClick={onNewProject}>New Project</button>
        <div className="currentProjectBox">
          <span>Current project</span>
          <b>{project.name || 'Untitled'}</b>
          <small>
            {saveStatus === 'saving' ? 'Autosaving...' : saveStatus === 'failed' ? 'Autosave failed' : 'Saved locally'}
          </small>
        </div>
        <button onClick={onSave}>Save now</button>
        <div className="projectList">
          {projects.map((item) => (
            <div key={item.id} className={item.id === project.id ? 'projectCard active' : 'projectCard'}>
              <button className="projectThumb" onClick={() => onOpenProject(item.id)} title={`Open ${item.name}`}>
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt="" />
                ) : (
                  <span>{item.name.slice(0, 1).toUpperCase() || 'C'}</span>
                )}
              </button>
              <div className="projectDetails">
                <b>{item.name || 'Untitled'}</b>
                <span>{item.pageCount} pages · {timeAgo(item.updatedAt)}</span>
                <div className="projectActions">
                  <button onClick={() => onOpenProject(item.id)} disabled={item.id === project.id}>Open</button>
                  <button
                    onClick={() => {
                      const nextName = window.prompt('Rename project', item.name);
                      if (nextName !== null) onRenameProject(item.id, nextName);
                    }}
                  >
                    Rename
                  </button>
                  <button onClick={() => onDuplicateProject(item.id)}>Duplicate</button>
                  <button onClick={() => onRequestDeleteProject(item.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="panelNote">Projects and image assets are stored locally in this browser using IndexedDB.</p>
      </div>
    );
  }

  return (
    <div className="panelSection">
      <h2>Elements</h2>
      <button onClick={() => onAddShape('rect')}>Add rectangle</button>
      <button onClick={() => onAddShape('roundRect')}>Add rounded rectangle</button>
      <button onClick={() => onAddShape('ellipse')}>Add ellipse</button>
      <button onClick={() => onAddShape('line')}>Add line</button>
      <button onClick={() => onAddText('body')}>Add label text</button>
      <p className="panelNote">
        Page {currentPage + 1} starts at x={currentPage * PAGE_WIDTH}. Objects can move freely across 1080px boundaries.
      </p>
    </div>
  );
}
