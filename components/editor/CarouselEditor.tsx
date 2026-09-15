'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import EditorStage from './EditorStage';
import { clearProject, loadProject, saveProject } from '../../lib/projectStorage';
import { downloadDataUrl, renderCarouselPages } from '../../lib/renderCarousel';
import {
  CarouselProject,
  EditorObject,
  ExportQuality,
  MAX_PAGES,
  MIN_PAGES,
  PAGE_WIDTH,
  TextObject,
  ToolName,
  UploadedImage,
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

const fonts = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS'];
const presets = ['#ffffff', '#f4f1ea', '#111827', '#f97316', '#0f766e', '#2563eb', '#e11d48'];

const emptyProject: CarouselProject = {
  name: 'My Carousel',
  pageCount: 3,
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
  return JSON.parse(JSON.stringify(project)) as CarouselProject;
}

export default function CarouselEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<CarouselProject>(emptyProject);
  const [activeTool, setActiveTool] = useState<ToolName>('Upload');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [undoStack, setUndoStack] = useState<CarouselProject[]>([]);
  const [redoStack, setRedoStack] = useState<CarouselProject[]>([]);
  const [clipboard, setClipboard] = useState<EditorObject | null>(null);
  const [dragUpload, setDragUpload] = useState<UploadedImage | null>(null);
  const [message, setMessage] = useState('Ready');
  const [previewUrls, setPreviewUrls] = useState<string[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [quality, setQuality] = useState<ExportQuality>(0.95);
  const [exportTarget, setExportTarget] = useState<'all' | 'selected'>('all');

  const selectedObject = useMemo(
    () => project.objects.find((object) => object.id === selectedId) ?? null,
    [project.objects, selectedId],
  );

  function commit(next: CarouselProject, nextSelectedId = selectedId) {
    setUndoStack((stack) => [...stack.slice(-49), cloneProject(project)]);
    setRedoStack([]);
    setProject(next);
    setSelectedId(nextSelectedId);
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
    };

    commit({ ...project, objects: [...project.objects, object] }, object.id);
    setActiveTool('Photos');
  }

  function addText() {
    const object: TextObject = {
      id: id('text'),
      type: 'text',
      name: 'Text - Double click to edit',
      text: 'Double click to edit',
      x: currentPage * PAGE_WIDTH + 160,
      y: 260,
      width: 720,
      height: 120,
      rotation: 0,
      opacity: 1,
      fontSize: 64,
      fontFamily: 'Arial',
      fill: '#111827',
      bold: true,
      italic: false,
      align: 'left',
    };

    commit({ ...project, objects: [...project.objects, object] }, object.id);
    setActiveTool('Text');
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit({ ...project, objects: project.objects.filter((object) => object.id !== selectedId) }, null);
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
          return { id: id('upload'), name: file.name, src, ...size };
        }),
      );

      const next = { ...project, uploads: [...project.uploads, ...uploads] };
      commit(next);
      if (uploads[0]) insertImageIntoProject(next, uploads[0]);
      setMessage(`${uploads.length} image${uploads.length === 1 ? '' : 's'} uploaded`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  function insertImageIntoProject(sourceProject: CarouselProject, upload: UploadedImage) {
    const maxWidth = 640;
    const width = Math.min(maxWidth, upload.width);
    const height = width * (upload.height / upload.width);
    const object: EditorObject = {
      id: id('image'),
      type: 'image',
      name: `Photo - ${upload.name}`,
      imageId: upload.id,
      x: currentPage * PAGE_WIDTH + 170,
      y: 220,
      width,
      height,
      rotation: 0,
      opacity: 1,
    };
    setProject({ ...sourceProject, objects: [...sourceProject.objects, object] });
    setSelectedId(object.id);
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
    const baseX = currentPage * PAGE_WIDTH;
    const common = {
      rotation: 0,
      opacity: 1,
      fontFamily: 'Arial',
      italic: false,
      align: 'left' as const,
    };
    const objects: TextObject[] =
      template === 'minimal'
        ? [
            {
              ...common,
              id: id('template-text'),
              type: 'text',
              name: 'Text - Minimal title',
              text: 'A clean idea\nacross pages',
              x: baseX + 132,
              y: 390,
              width: 840,
              height: 250,
              fontSize: 96,
              fill: '#111827',
              bold: true,
            },
          ]
        : template === 'travel'
          ? [
              {
                ...common,
                id: id('template-text'),
                type: 'text',
                name: 'Text - Travel story',
                text: 'CHIANG MAI',
                x: baseX + 720,
                y: 610,
                width: 980,
                height: 120,
                fontSize: 82,
                fill: '#0f766e',
                bold: true,
              },
              {
                ...common,
                id: id('template-note'),
                type: 'text',
                name: 'Text - Travel note',
                text: 'temples, coffee, and mountain light',
                x: baseX + 760,
                y: 740,
                width: 820,
                height: 70,
                fontSize: 36,
                fill: '#334155',
                bold: false,
              },
            ]
          : [
              {
                ...common,
                id: id('template-text'),
                type: 'text',
                name: 'Text - Photo dump',
                text: 'PHOTO DUMP',
                x: baseX + 120,
                y: 112,
                width: 900,
                height: 120,
                fontSize: 76,
                fill: '#111827',
                bold: true,
              },
              {
                ...common,
                id: id('template-caption'),
                type: 'text',
                name: 'Text - Caption',
                text: 'moments worth sliding through',
                x: baseX + 128,
                y: 1240,
                width: 820,
                height: 60,
                fontSize: 32,
                fill: '#4b5563',
                bold: false,
              },
            ];

    commit({ ...project, objects: [...project.objects, ...objects] }, objects[0]?.id ?? selectedId);
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

  async function exportJpg() {
    try {
      setMessage('Exporting JPG...');
      const selectedPage = exportTarget === 'selected' ? currentPage : undefined;
      const pages = await renderCarouselPages(project, quality, selectedPage);
      pages.forEach((url, index) => {
        const pageNumber = selectedPage === undefined ? index + 1 : selectedPage + 1;
        downloadDataUrl(url, `carousel-${String(pageNumber).padStart(2, '0')}.jpg`);
      });
      setExportOpen(false);
      setMessage(`Exported ${pages.length} JPG page${pages.length === 1 ? '' : 's'}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    }
  }

  function saveLocalProject() {
    try {
      saveProject(project);
      setMessage('Project saved in this browser');
    } catch {
      setMessage('Project save failed. Large images may exceed browser storage.');
    }
  }

  function loadLocalProject() {
    try {
      const saved = loadProject();
      if (!saved) {
        setMessage('No saved project found');
        return;
      }
      commit(saved, null);
      setMessage('Project loaded');
    } catch {
      setMessage('Project load failed.');
    }
  }

  function newProject() {
    clearProject();
    commit(cloneProject(emptyProject), null);
    setCurrentPage(0);
    setMessage('New project started');
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'c' && selectedObject) {
        event.preventDefault();
        setClipboard(selectedObject);
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'v' && clipboard) {
        event.preventDefault();
        const pasted = { ...clipboard, id: id(clipboard.type), name: `${clipboard.name} copy`, x: clipboard.x + 60, y: clipboard.y + 60 };
        commit({ ...project, objects: [...project.objects, pasted] }, pasted.id);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The shortcut handler is rebound when editor state changes so copy/paste and history use fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboard, project, selectedId, selectedObject, undoStack, redoStack]);

  return (
    <main className="appShell">
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
      </aside>

      <section className="panel">
        <PanelContent
          activeTool={activeTool}
          project={project}
          selectedObject={selectedObject}
          currentPage={currentPage}
          onUpload={() => inputRef.current?.click()}
          onInsertImage={insertImage}
          onSetDragUpload={setDragUpload}
          onAddText={addText}
          onApplyTemplate={applyTemplate}
          onChangeProject={(next) => commit(next)}
          onChangeObject={updateObject}
          onSelect={setSelectedId}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onMoveLayer={moveLayer}
          onSave={saveLocalProject}
          onLoad={loadLocalProject}
          onNew={newProject}
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
        <div className="canvasScroller">
          <EditorStage
            project={project}
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
        <div className="zoom">
          <button onClick={() => setZoom((value) => Math.max(25, value - 10))}>−</button>
          <span>{zoom}%</span>
          <button onClick={() => setZoom((value) => Math.min(100, value + 10))}>+</button>
          <button onClick={() => setZoom(50)}>Fit</button>
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
                <img key={url} className="previewPage" src={url} alt={`Preview page ${index + 1}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="modal" onClick={() => setExportOpen(false)}>
          <div className="exportCard" onClick={(event) => event.stopPropagation()}>
            <div className="previewHead">
              <b>Export JPG</b>
              <button onClick={() => setExportOpen(false)}>×</button>
            </div>
            <label>
              Quality
              <select value={quality} onChange={(event) => setQuality(Number(event.target.value) as ExportQuality)}>
                <option value={0.8}>80%</option>
                <option value={0.9}>90%</option>
                <option value={0.95}>95%</option>
                <option value={1}>100%</option>
              </select>
            </label>
            <label>
              Pages
              <select value={exportTarget} onChange={(event) => setExportTarget(event.target.value as 'all' | 'selected')}>
                <option value="all">All pages</option>
                <option value="selected">Selected page</option>
              </select>
            </label>
            <button className="exportButton wide" onClick={exportJpg}>
              Download JPG
            </button>
          </div>
        </div>
      )}
    </main>
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
  onApplyTemplate,
  onChangeProject,
  onChangeObject,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveLayer,
  onSave,
  onLoad,
  onNew,
}: {
  activeTool: ToolName;
  project: CarouselProject;
  selectedObject: EditorObject | null;
  currentPage: number;
  onUpload: () => void;
  onInsertImage: (upload: UploadedImage) => void;
  onSetDragUpload: (upload: UploadedImage | null) => void;
  onAddText: () => void;
  onApplyTemplate: (template: 'minimal' | 'travel' | 'dump') => void;
  onChangeProject: (project: CarouselProject) => void;
  onChangeObject: (object: EditorObject) => void;
  onSelect: (id: string | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
}) {
  if (activeTool === 'Templates') {
    return (
      <div className="panelSection">
        <h2>Templates</h2>
        <button onClick={() => onApplyTemplate('minimal')}>Minimal</button>
        <button onClick={() => onApplyTemplate('travel')}>Travel Story</button>
        <button onClick={() => onApplyTemplate('dump')}>Photo Dump</button>
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
        <div className="photoGrid">
          {project.uploads.map((upload) => (
            <button key={upload.id} onClick={() => onInsertImage(upload)}>
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
        <button className="primaryPanelButton" onClick={onAddText}>
          Add text
        </button>
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
        <button onClick={onSave}>Save Project</button>
        <button onClick={onLoad}>Load Project</button>
        <button onClick={onNew}>New Project</button>
        <p className="panelNote">Saved locally in this browser. Uploaded images are stored as data URLs for V1.</p>
      </div>
    );
  }

  return (
    <div className="panelSection">
      <h2>Elements</h2>
      <button onClick={onAddText}>Add text element</button>
      <p className="panelNote">
        Current page starts at x={currentPage * PAGE_WIDTH}. Objects can be moved freely across the 1080px page boundaries.
      </p>
    </div>
  );
}
