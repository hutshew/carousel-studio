'use client';

import { ChangeEvent, PointerEvent, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../../types/editor';

type FontName = 'Noto Sans Thai' | 'Prompt' | 'Kanit' | 'Sarabun' | 'Arial' | 'Georgia';
type StudioObject =
  | {
      id: string;
      type: 'image';
      name: string;
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
    }
  | {
      id: string;
      type: 'text';
      name: string;
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      font: FontName;
      fontSize: number;
      weight: 400 | 700;
      color: string;
      align: 'left' | 'center' | 'right';
      rotation: number;
      opacity: number;
    };

const fonts: FontName[] = ['Noto Sans Thai', 'Prompt', 'Kanit', 'Sarabun', 'Arial', 'Georgia'];
const palette = ['#f8fafc', '#111827', '#ef4444', '#0f766e', '#2563eb', '#f59e0b'];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be loaded.'));
    image.src = src;
  });
}

async function waitForFonts(objects: StudioObject[]) {
  if (!('fonts' in document)) return;
  const usedFonts = Array.from(new Set(objects.filter((object) => object.type === 'text').map((object) => object.font)));
  await Promise.all(usedFonts.flatMap((font) => [`400 32px "${font}"`, `700 32px "${font}"`].map((value) => document.fonts.load(value))));
  await document.fonts.ready;
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

function drawWrappedText(ctx: CanvasRenderingContext2D, object: Extract<StudioObject, { type: 'text' }>) {
  const lines = object.text.split('\n');
  const lineHeight = object.fontSize * 1.18;
  ctx.fillStyle = object.color;
  ctx.globalAlpha = object.opacity;
  ctx.textAlign = object.align;
  ctx.textBaseline = 'top';
  ctx.font = `${object.weight} ${object.fontSize}px "${object.font}"`;
  const x = object.align === 'center' ? object.width / 2 : object.align === 'right' ? object.width : 0;
  lines.forEach((line, index) => ctx.fillText(line, x, index * lineHeight, object.width));
}

export default function StudioV2() {
  const inputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [projectName, setProjectName] = useState('Carousel Studio V2');
  const [pageCount, setPageCount] = useState(3);
  const [background, setBackground] = useState('#f8fafc');
  const [objects, setObjects] = useState<StudioObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(34);
  const [message, setMessage] = useState('Ready');
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const scale = zoom / 100;
  const canvasWidth = pageCount * PAGE_WIDTH;
  const selected = useMemo(() => objects.find((object) => object.id === selectedId) ?? null, [objects, selectedId]);

  function patchObject(next: StudioObject) {
    setObjects((items) => items.map((item) => (item.id === next.id ? next : item)));
  }

  function worldPoint(event: PointerEvent | globalThis.PointerEvent) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const nextObjects: StudioObject[] = [];
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) continue;
      const src = await fileToDataUrl(file);
      const image = await loadImage(src);
      const width = Math.min(640, image.naturalWidth);
      const height = width * (image.naturalHeight / image.naturalWidth);
      nextObjects.push({
        id: id('image'),
        type: 'image',
        name: file.name,
        src,
        x: 150 + nextObjects.length * 42,
        y: 220 + nextObjects.length * 42,
        width,
        height,
        rotation: 0,
        opacity: 1,
      });
    }

    setObjects((items) => [...items, ...nextObjects]);
    setSelectedId(nextObjects.at(-1)?.id ?? null);
    setMessage(`${nextObjects.length} photo${nextObjects.length === 1 ? '' : 's'} added`);
  }

  function addText(preset: 'title' | 'caption' = 'title') {
    const object: StudioObject = {
      id: id('text'),
      type: 'text',
      name: preset === 'title' ? 'Headline' : 'Caption',
      text: preset === 'title' ? 'หัวข้อของคุณ' : 'ข้อความประกอบภาพ',
      x: preset === 'title' ? 120 : 130,
      y: preset === 'title' ? 140 : 1020,
      width: preset === 'title' ? 790 : 820,
      height: preset === 'title' ? 170 : 110,
      font: 'Noto Sans Thai',
      fontSize: preset === 'title' ? 92 : 40,
      weight: preset === 'title' ? 700 : 400,
      color: '#111827',
      align: preset === 'title' ? 'left' : 'center',
      rotation: 0,
      opacity: 1,
    };
    setObjects((items) => [...items, object]);
    setSelectedId(object.id);
    setMessage('Text added');
  }

  function applyTemplate() {
    setPageCount(4);
    setBackground('#f8fafc');
    const fresh: StudioObject[] = [
      {
        id: id('text'),
        type: 'text',
        name: 'Cover title',
        text: 'NEW\nCAROUSEL',
        x: 96,
        y: 170,
        width: 790,
        height: 270,
        font: 'Kanit',
        fontSize: 112,
        weight: 700,
        color: '#111827',
        align: 'left',
        rotation: 0,
        opacity: 1,
      },
      {
        id: id('text'),
        type: 'text',
        name: 'Swipe note',
        text: 'ลากรูปให้คร่อมหน้าได้ แล้ว export เป็นชุดภาพ',
        x: PAGE_WIDTH + 130,
        y: 940,
        width: 820,
        height: 120,
        font: 'Noto Sans Thai',
        fontSize: 42,
        weight: 400,
        color: '#334155',
        align: 'center',
        rotation: 0,
        opacity: 1,
      },
      {
        id: id('text'),
        type: 'text',
        name: 'End title',
        text: 'พร้อมใช้งาน',
        x: PAGE_WIDTH * 3 + 120,
        y: 520,
        width: 840,
        height: 140,
        font: 'Prompt',
        fontSize: 82,
        weight: 700,
        color: '#0f766e',
        align: 'center',
        rotation: 0,
        opacity: 1,
      },
    ];
    setObjects(fresh);
    setSelectedId(fresh[0].id);
    setMessage('Starter layout applied');
  }

  function onObjectPointerDown(event: PointerEvent<HTMLDivElement>, object: StudioObject) {
    event.preventDefault();
    event.stopPropagation();
    const point = worldPoint(event);
    setSelectedId(object.id);
    setDragging({ id: object.id, dx: point.x - object.x, dy: point.y - object.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const point = worldPoint(event);
    setObjects((items) =>
      items.map((item) =>
        item.id === dragging.id
          ? {
              ...item,
              x: Math.round(point.x - dragging.dx),
              y: Math.round(Math.max(-400, Math.min(PAGE_HEIGHT + 200, point.y - dragging.dy))),
            }
          : item,
      ),
    );
  }

  async function renderPage(pageIndex: number) {
    await waitForFonts(objects);
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.translate(-pageIndex * PAGE_WIDTH, 0);

    for (const object of objects) {
      ctx.save();
      ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
      ctx.rotate((object.rotation * Math.PI) / 180);
      ctx.translate(-object.width / 2, -object.height / 2);
      ctx.globalAlpha = object.opacity;

      if (object.type === 'image') {
        const image = await loadImage(object.src);
        ctx.drawImage(image, 0, 0, object.width, object.height);
      } else {
        drawWrappedText(ctx, object);
      }

      ctx.restore();
    }

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png');
    });
  }

  async function exportZip() {
    try {
      setMessage('Exporting pages...');
      const zip = new JSZip();
      for (let page = 0; page < pageCount; page += 1) {
        zip.file(`${projectName.toLowerCase().replace(/\s+/g, '-')}-${String(page + 1).padStart(2, '0')}.png`, await renderPage(page));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${projectName.toLowerCase().replace(/\s+/g, '-')}.zip`);
      setMessage('Export ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed');
    }
  }

  return (
    <main className="studioV2">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadFiles} />
      <aside className="v2Sidebar">
        <div className="v2Brand">
          <span>CS</span>
          <div>
            <b>Carousel Studio</b>
            <small>V2 workspace</small>
          </div>
        </div>
        <button className="v2Primary" onClick={() => inputRef.current?.click()}>Upload photos</button>
        <button onClick={applyTemplate}>Starter layout</button>
        <button onClick={() => addText('title')}>Add headline</button>
        <button onClick={() => addText('caption')}>Add caption</button>

        <div className="v2ControlGroup">
          <label>
            Project
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <label>
            Pages
            <input type="number" min={2} max={8} value={pageCount} onChange={(event) => setPageCount(Math.max(2, Math.min(8, Number(event.target.value))))} />
          </label>
          <label>
            Background
            <div className="v2Swatches">
              {palette.map((color) => (
                <button key={color} style={{ background: color }} className={background === color ? 'active' : ''} onClick={() => setBackground(color)} />
              ))}
            </div>
          </label>
        </div>

        {selected?.type === 'text' && (
          <div className="v2ControlGroup">
            <b>Text</b>
            <textarea value={selected.text} onChange={(event) => patchObject({ ...selected, text: event.target.value })} />
            <label>
              Font
              <select
                value={selected.font}
                onChange={(event) => {
                  patchObject({ ...selected, font: event.target.value as FontName });
                  setMessage(`Font changed to ${event.target.value}`);
                }}
              >
                {fonts.map((font) => <option key={font}>{font}</option>)}
              </select>
            </label>
            <label>
              Size
              <input type="range" min={24} max={140} value={selected.fontSize} onChange={(event) => patchObject({ ...selected, fontSize: Number(event.target.value) })} />
            </label>
            <div className="v2Segmented">
              <button className={selected.weight === 400 ? 'active' : ''} onClick={() => patchObject({ ...selected, weight: 400 })}>Regular</button>
              <button className={selected.weight === 700 ? 'active' : ''} onClick={() => patchObject({ ...selected, weight: 700 })}>Bold</button>
            </div>
            <input type="color" value={selected.color} onChange={(event) => patchObject({ ...selected, color: event.target.value })} />
          </div>
        )}

        {selected?.type === 'image' && (
          <div className="v2ControlGroup">
            <b>Image</b>
            <label>
              Width
              <input type="range" min={120} max={1200} value={selected.width} onChange={(event) => patchObject({ ...selected, width: Number(event.target.value), height: Number(event.target.value) * (selected.height / selected.width) })} />
            </label>
            <label>
              Opacity
              <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(event) => patchObject({ ...selected, opacity: Number(event.target.value) })} />
            </label>
          </div>
        )}
      </aside>

      <section className="v2Workspace">
        <header className="v2Topbar">
          <div>
            <b>{projectName}</b>
            <span>{pageCount} pages · 1080 x 1350 · continuous canvas</span>
          </div>
          <div>
            <button onClick={() => setZoom((value) => Math.max(20, value - 5))}>-</button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom((value) => Math.min(70, value + 5))}>+</button>
            <button className="v2Primary" onClick={exportZip}>Export ZIP</button>
          </div>
        </header>

        <div className="v2Scroller">
          <div className="v2PageLabels" style={{ width: canvasWidth * scale }}>
            {Array.from({ length: pageCount }).map((_, index) => <span key={index} style={{ left: index * PAGE_WIDTH * scale }}>PAGE {index + 1}</span>)}
          </div>
          <div
            ref={boardRef}
            className="v2Board"
            style={{ width: canvasWidth * scale, height: PAGE_HEIGHT * scale }}
            onPointerMove={onBoardPointerMove}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
            onPointerDown={() => setSelectedId(null)}
          >
            <div className="v2Stage" style={{ width: canvasWidth, height: PAGE_HEIGHT, transform: `scale(${scale})`, background }}>
              {Array.from({ length: pageCount + 1 }).map((_, index) => <i key={index} className="v2PageBreak" style={{ left: index * PAGE_WIDTH }} />)}
              {objects.map((object) => (
                <div
                  key={object.id}
                  className={`v2Object ${selectedId === object.id ? 'selected' : ''}`}
                  style={{
                    left: object.x,
                    top: object.y,
                    width: object.width,
                    height: object.height,
                    opacity: object.opacity,
                    transform: `rotate(${object.rotation}deg)`,
                  }}
                  onPointerDown={(event) => onObjectPointerDown(event, object)}
                >
                  {object.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={object.src} alt={object.name} draggable={false} />
                  ) : (
                    <div
                      className="v2Text"
                      style={{
                        fontFamily: object.font,
                        fontSize: object.fontSize,
                        fontWeight: object.weight,
                        color: object.color,
                        textAlign: object.align,
                      }}
                    >
                      {object.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="v2Status">{message}</footer>
      </section>
    </main>
  );
}
