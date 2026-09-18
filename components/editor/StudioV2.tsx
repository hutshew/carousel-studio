'use client';

import { ChangeEvent, PointerEvent, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';

type Ratio = '1:1' | '4:5' | '9:16';
type Resolution = 1080 | 1440 | 2160;
type TemplateName = 'Ayurveda' | 'Minimal' | 'Bold' | 'Nature' | 'Luxury' | 'Pastel' | 'Ocean' | 'Sunset' | 'Neon' | 'Editorial' | 'Raw' | 'Cinema';
type FontName = 'Cormorant' | 'Playfair' | 'Bebas' | 'Grotesk' | 'Syne' | 'Italiana' | 'Josefin' | 'Fraunces';
type SizeName = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
type AlignName = 'auto' | 'left' | 'center' | 'right';
type SlideCopy = {
  eyebrow: string;
  title: string;
  body: string;
  titleSize: SizeName;
  bodySize: SizeName;
  align: AlignName;
  titleColor: string;
  bodyColor: string;
  font: FontName;
};

type StudioObject =
  | {
      id: string;
      type: 'image';
      name: string;
      src: string;
      slide: number;
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
    }
  | {
      id: string;
      type: 'text';
      name: string;
      text: string;
      slide: number;
      x: number;
      y: number;
      width: number;
      height: number;
      font: FontName;
      fontSize: number;
      weight: 400 | 700;
      color: string;
      opacity: number;
    };

const ratioMap: Record<Ratio, { width: number; height: number; label: string }> = {
  '1:1': { width: 1080, height: 1080, label: '1:1 Carousel' },
  '4:5': { width: 1080, height: 1350, label: '4:5 Portrait' },
  '9:16': { width: 1080, height: 1920, label: '9:16 Story' },
};

const templates: { name: TemplateName; icon: string; colors: string[] }[] = [
  { name: 'Ayurveda', icon: 'leaf', colors: ['#0d160f', '#243b22', '#c8a13a'] },
  { name: 'Minimal', icon: 'min', colors: ['#eee9df', '#faf7ef', '#111111'] },
  { name: 'Bold', icon: 'bolt', colors: ['#441032', '#b52b62', '#f2a33a'] },
  { name: 'Nature', icon: 'sprout', colors: ['#0c2112', '#2d5b2d', '#a7c957'] },
  { name: 'Luxury', icon: 'spark', colors: ['#050505', '#151515', '#c49a2c'] },
  { name: 'Pastel', icon: 'flower', colors: ['#ffd2df', '#f7edf3', '#d14d72'] },
  { name: 'Ocean', icon: 'wave', colors: ['#052033', '#146c94', '#8ecae6'] },
  { name: 'Sunset', icon: 'sun', colors: ['#2b1008', '#ef7b45', '#ffd166'] },
  { name: 'Neon', icon: 'neo', colors: ['#07001f', '#6d28d9', '#22d3ee'] },
  { name: 'Editorial', icon: 'Edit', colors: ['#f3ede3', '#d1b37d', '#121212'] },
  { name: 'Raw', icon: 'RAW', colors: ['#111111', '#ff9f1c', '#fef08a'] },
  { name: 'Cinema', icon: 'play', colors: ['#060606', '#1f2937', '#eab308'] },
];

const fonts: FontName[] = ['Cormorant', 'Playfair', 'Bebas', 'Grotesk', 'Syne', 'Italiana', 'Josefin', 'Fraunces'];
const titleScale: Record<SizeName, number> = { XS: 4.2, S: 5.6, M: 7.2, L: 8.8, XL: 10.4, XXL: 12 };
const bodyScale: Record<SizeName, number> = { XS: 1.8, S: 2.2, M: 2.65, L: 3.1, XL: 3.55, XXL: 4 };
const defaultSlides: SlideCopy[] = [
  {
    eyebrow: '01 — Co to je',
    title: 'Abhyanga',
    body: 'Masáž celého těla teplým bylinným olejem, která pomáhá tělu zpomalit.',
    titleSize: 'L',
    bodySize: 'S',
    align: 'auto',
    titleColor: '#090909',
    bodyColor: '#171717',
    font: 'Cormorant',
  },
  {
    eyebrow: '02 — tradice',
    title: 'Tradiční\najurvédská masáž',
    body: 'Pochází z více než 5 000 let staré indické medicíny.',
    titleSize: 'M',
    bodySize: 'S',
    align: 'auto',
    titleColor: '#111111',
    bodyColor: '#f4f4f4',
    font: 'Cormorant',
  },
  {
    eyebrow: '03 — pokoj',
    title: 'Teplý olej.\nHluboký klid.',
    body: 'Uvolňuje napětí v těle i nervovém systému. Zpomaluje a uzemňuje.',
    titleSize: 'L',
    bodySize: 'M',
    align: 'auto',
    titleColor: '#111111',
    bodyColor: '#ffffff',
    font: 'Cormorant',
  },
];

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

function fontStack(font: FontName) {
  const stacks: Record<FontName, string> = {
    Cormorant: 'Cormorant Garamond, Georgia, serif',
    Playfair: 'Playfair Display, Georgia, serif',
    Bebas: 'Bebas Neue, Impact, sans-serif',
    Grotesk: 'Inter, Arial, sans-serif',
    Syne: 'Syne, Arial, sans-serif',
    Italiana: 'Italiana, Georgia, serif',
    Josefin: 'Josefin Sans, Arial, sans-serif',
    Fraunces: 'Fraunces, Georgia, serif',
  };
  return stacks[font];
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

export default function StudioV2() {
  const inputRef = useRef<HTMLInputElement>(null);
  const slideRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [ratio, setRatio] = useState<Ratio>('1:1');
  const [resolution, setResolution] = useState<Resolution>(1080);
  const [slideCount, setSlideCount] = useState(3);
  const [template, setTemplate] = useState<TemplateName>('Editorial');
  const [font, setFont] = useState<FontName>('Cormorant');
  const [topic, setTopic] = useState('Hot stone masáž');
  const [brandName, setBrandName] = useState('MADEROTERAPIE UH');
  const [tone, setTone] = useState('Inspirativní a motivační');
  const [length, setLength] = useState('Krátký — hesla, max 1 věta');
  const [activeSlide, setActiveSlide] = useState(1);
  const [slideCopies, setSlideCopies] = useState<SlideCopy[]>(defaultSlides);
  const [copySpacing, setCopySpacing] = useState(1);
  const [overlayDarkness, setOverlayDarkness] = useState(45);
  const [highlightIcon, setHighlightIcon] = useState('🌿');
  const [highlightName, setHighlightName] = useState('Masáže, Ceník, O mně...');
  const [objects, setObjects] = useState<StudioObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [message, setMessage] = useState('Ready');

  const selectedTemplate = templates.find((item) => item.name === template) ?? templates[9];
  const baseSize = ratioMap[ratio];
  const exportHeight = Math.round((resolution * baseSize.height) / baseSize.width);
  const selected = useMemo(() => objects.find((object) => object.id === selectedId) ?? null, [objects, selectedId]);
  const currentCopy = slideCopies[activeSlide - 1] ?? defaultSlides[0];

  function slideObjects(slide: number) {
    return objects.filter((object) => object.slide === slide);
  }

  function updateObject(next: StudioObject) {
    setObjects((items) => items.map((item) => (item.id === next.id ? next : item)));
  }

  function updateSlideCopy(index: number, patch: Partial<SlideCopy>) {
    setSlideCopies((items) => {
      const next = Array.from({ length: Math.max(slideCount, items.length) }, (_, slide) => items[slide] ?? defaultSlides[slide % defaultSlides.length]);
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function ensureSlides(count: number) {
    setSlideCount(count);
    setActiveSlide((slide) => Math.min(slide, count));
    setSlideCopies((items) => Array.from({ length: count }, (_, index) => items[index] ?? defaultSlides[index % defaultSlides.length]));
  }

  function generateContent(variants = 1) {
    const baseTopic = topic.trim() || 'wellness ritual';
    const brand = brandName.trim() || 'Carousel Studio';
    const generated = Array.from({ length: slideCount }, (_, index): SlideCopy => {
      const variantLabel = variants > 1 ? `V${(index % variants) + 1}` : String(index + 1).padStart(2, '0');
      return {
        eyebrow: `${variantLabel} — ${brand}`,
        title:
          index === 0
            ? baseTopic
            : index === slideCount - 1
              ? 'Ulož si tento\nklidný moment'
              : `${tone.split(' ')[0]}\n${baseTopic}`,
        body:
          length.includes('Krátký')
            ? 'Jemně, stručně a s jasným pocitem pro značku.'
            : 'Vytvoř plynulý příběh, který vysvětlí benefit a pozve publikum k další akci.',
        titleSize: index === 0 ? 'L' : 'M',
        bodySize: 'S',
        align: 'auto',
        titleColor: '#101010',
        bodyColor: index === slideCount - 1 ? '#ffffff' : '#f5f5f5',
        font,
      };
    });
    setSlideCopies(generated);
    setMessage(variants > 1 ? 'Generated 3 content variants' : 'Content generated');
  }

  function slideTextLayout(slide: number) {
    if (slide === 0) return { x: 7, y: 42, width: 74, bodyY: 58 };
    if (slide === slideCount - 1) return { x: 7, y: 34, width: 78, bodyY: 58 };
    return { x: 7, y: 39, width: 80, bodyY: 63 };
  }

  function textAlign(copy: SlideCopy) {
    if (copy.align === 'auto') return 'left';
    return copy.align;
  }

  function slidePoint(event: PointerEvent<HTMLDivElement>, slide: number) {
    const rect = slideRefs.current[slide]?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function pointerDownObject(event: PointerEvent<HTMLDivElement>, object: StudioObject) {
    event.preventDefault();
    event.stopPropagation();
    const point = slidePoint(event, object.slide);
    setSelectedId(object.id);
    setDragging({ id: object.id, dx: point.x - object.x, dy: point.y - object.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMoveSlide(event: PointerEvent<HTMLDivElement>, slide: number) {
    if (!dragging) return;
    const point = slidePoint(event, slide);
    setObjects((items) =>
      items.map((item) =>
        item.id === dragging.id
          ? { ...item, slide, x: Math.max(-45, Math.min(145, point.x - dragging.dx)), y: Math.max(-40, Math.min(125, point.y - dragging.dy)) }
          : item,
      ),
    );
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const nextObjects: StudioObject[] = [];
    for (const [index, file] of files.entries()) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) continue;
      const src = await fileToDataUrl(file);
      const object: StudioObject = {
        id: id('image'),
        type: 'image',
        name: file.name,
        src,
        slide: Math.min(index, slideCount - 1),
        x: index === 0 ? 6 : -10,
        y: index === 0 ? 8 : 0,
        width: index === 0 ? 88 : 120,
        height: index === 0 ? 84 : 100,
        opacity: 0.78,
      };
      nextObjects.push(object);
    }
    setObjects((items) => [...items, ...nextObjects]);
    setSelectedId(nextObjects[0]?.id ?? null);
    setMessage(`${nextObjects.length} photo${nextObjects.length === 1 ? '' : 's'} added`);
  }

  function addText(slide = 0) {
    const next: StudioObject = {
      id: id('text'),
      type: 'text',
      name: 'Headline',
      text: slide === 0 ? 'Abhyanga' : 'Teplý olej.\nHluboký klid.',
      slide,
      x: 8,
      y: slide === 0 ? 42 : 34,
      width: 72,
      height: 24,
      font,
      fontSize: slide === 0 ? 8 : 7,
      weight: 700,
      color: slide === 2 ? '#f8fafc' : '#0b0b0b',
      opacity: 0.9,
    };
    setObjects((items) => [...items, next]);
    setSelectedId(next.id);
  }

  function applyEditorialSeed() {
    setRatio('1:1');
    setResolution(1080);
    ensureSlides(3);
    setTemplate('Editorial');
    setFont('Cormorant');
    setSlideCopies(defaultSlides);
    setObjects([]);
    setSelectedId(null);
    setActiveSlide(1);
    setMessage('Editorial template applied');
  }

  async function renderSlide(slide: number) {
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    const gradient = ctx.createLinearGradient(0, 0, resolution, exportHeight);
    gradient.addColorStop(0, selectedTemplate.colors[0]);
    gradient.addColorStop(0.54, selectedTemplate.colors[1]);
    gradient.addColorStop(1, selectedTemplate.colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, resolution, exportHeight);

    ctx.fillStyle = `rgba(0,0,0,${overlayDarkness / 100})`;
    ctx.fillRect(0, 0, resolution, exportHeight);

    for (const object of slideObjects(slide)) {
      ctx.globalAlpha = object.opacity;
      const x = (object.x / 100) * resolution;
      const y = (object.y / 100) * exportHeight;
      const width = (object.width / 100) * resolution;
      const height = (object.height / 100) * exportHeight;

      if (object.type === 'image') {
        const image = await loadImage(object.src);
        ctx.drawImage(image, x, y, width, height);
      } else {
        ctx.fillStyle = object.color;
        ctx.font = `${object.weight} ${(object.fontSize / 100) * resolution}px ${fontStack(object.font)}`;
        object.text.split('\n').forEach((line, index) => ctx.fillText(line, x, y + index * ((object.fontSize / 100) * resolution * 1.08), width));
      }
    }
    ctx.globalAlpha = 1;

    const copy = slideCopies[slide] ?? defaultSlides[slide % defaultSlides.length];
    const layout = slideTextLayout(slide);
    const align = textAlign(copy);
    const textX = (layout.x / 100) * resolution;
    const textWidth = (layout.width / 100) * resolution;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = copy.bodyColor;
    ctx.font = `400 ${Math.max(10, resolution * 0.009)}px ${fontStack('Grotesk')}`;
    ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    const alignedX = align === 'center' ? textX + textWidth / 2 : align === 'right' ? textX + textWidth : textX;
    ctx.fillText(copy.eyebrow, alignedX, (12 / 100) * exportHeight, textWidth);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = copy.titleColor;
    ctx.font = `${copy.titleSize === 'XS' || copy.titleSize === 'S' ? 400 : 700} ${(titleScale[copy.titleSize] / 100) * resolution}px ${fontStack(copy.font)}`;
    copy.title.split('\n').forEach((line, index) => {
      ctx.fillText(line, alignedX, (layout.y / 100) * exportHeight + index * ((titleScale[copy.titleSize] / 100) * resolution * copySpacing), textWidth);
    });
    ctx.globalAlpha = 0.84;
    ctx.fillStyle = copy.bodyColor;
    ctx.font = `700 ${(bodyScale[copy.bodySize] / 100) * resolution}px ${fontStack('Grotesk')}`;
    copy.body.split('\n').forEach((line, index) => {
      ctx.fillText(line, alignedX, (layout.bodyY / 100) * exportHeight + index * ((bodyScale[copy.bodySize] / 100) * resolution * 1.25 * copySpacing), textWidth);
    });
    ctx.globalAlpha = 1;

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png');
    });
  }

  async function exportPng(slide: number) {
    try {
      downloadBlob(await renderSlide(slide), `carousel-slide-${slide + 1}.png`);
      setMessage(`Slide ${slide + 1} exported`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed');
    }
  }

  async function exportZip() {
    try {
      const zip = new JSZip();
      for (let slide = 0; slide < slideCount; slide += 1) {
        zip.file(`carousel-${String(slide + 1).padStart(2, '0')}.png`, await renderSlide(slide));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'carousel-export.zip');
      setMessage('ZIP exported');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed');
    }
  }

  return (
    <main className="luxStudio">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadFiles} />

      <header className="luxHeader">
        <div className="luxLogo"><span>Carousel</span>Studio</div>
        <button onClick={exportZip}>Export ZIP</button>
      </header>

      <aside className="luxPanel">
        <p className="luxEyebrow">Settings</p>
        <section className="luxCards two">
          <div className="luxCard">
            <span className="luxStep">1</span>
            <h2>Format & Resolution</h2>
            <div className="luxPills">
              {(['1:1', '4:5', '9:16'] as Ratio[]).map((item) => (
                <button key={item} className={ratio === item ? 'active' : ''} onClick={() => setRatio(item)}>{item}</button>
              ))}
            </div>
            <div className="luxPills">
              {([1080, 1440, 2160] as Resolution[]).map((item) => (
                <button key={item} className={resolution === item ? 'active' : ''} onClick={() => setResolution(item)}>{item === 2160 ? '4K' : `${item}px`}</button>
              ))}
            </div>
          </div>
          <div className="luxCard">
            <span className="luxStep">3</span>
            <h2>Slides</h2>
            <div className="luxNumberGrid">
              {[2, 3, 4, 5, 6, 7, 8, 10].map((count) => (
                <button key={count} className={slideCount === count ? 'active' : ''} onClick={() => ensureSlides(count)}>{count}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="luxCard">
          <div className="luxCardHead">
            <span className="luxStep">2</span>
            <h2>Template <small>{template}</small></h2>
          </div>
          <div className="luxTemplateGrid">
            {templates.map((item) => (
              <button
                key={item.name}
                className={template === item.name ? 'active' : ''}
                onClick={() => setTemplate(item.name)}
                style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]} 55%, ${item.colors[2]})` }}
              >
                <b>{item.icon}</b>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
          <button className="luxWide" onClick={applyEditorialSeed}>Use editorial starter</button>
        </section>

        <p className="luxEyebrow">AI Generator</p>
        <section className="luxCard">
          <div className="luxCardHead">
            <span className="luxStep">4</span>
            <h2>Carousel Content</h2>
          </div>
          <label className="luxLabel">
            Topic
            <input value={topic} placeholder="e.g. Hot stone masáž" onChange={(event) => setTopic(event.target.value)} />
          </label>
          <label className="luxLabel">
            Brand / Profile
            <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          </label>
          <label className="luxLabel">
            Tone
            <select value={tone} onChange={(event) => setTone(event.target.value)}>
              <option>Inspirativní a motivační</option>
              <option>Luxusní a klidný</option>
              <option>Vzdělávací</option>
              <option>Krátký pro Instagram</option>
            </select>
          </label>
          <label className="luxLabel">
            Text length
            <select value={length} onChange={(event) => setLength(event.target.value)}>
              <option>Krátký — hesla, max 1 věta</option>
              <option>Střední — 2 věty</option>
              <option>Delší — mini příběh</option>
            </select>
          </label>
          <button className="luxGold" onClick={() => generateContent()}>Generate content</button>
          <button className="luxWide subtle" onClick={() => generateContent(3)}>Generate 3 variants</button>
          <p className="luxHelp">Generates editable slide copy from one theme.</p>
        </section>

        <section className="luxCard">
          <div className="luxCardHead">
            <span className="luxStep">8</span>
            <h2>Text & Typography</h2>
          </div>
          <div className="luxSlideTabs">
            {Array.from({ length: slideCount }).map((_, index) => (
              <button key={index} className={activeSlide === index + 1 ? 'active' : ''} onClick={() => setActiveSlide(index + 1)}>
                {index + 1}
              </button>
            ))}
          </div>
          <label className="luxLabel">
            Eyebrow
            <input value={currentCopy.eyebrow} onChange={(event) => updateSlideCopy(activeSlide - 1, { eyebrow: event.target.value })} />
          </label>
          <label className="luxLabel">
            Heading
            <textarea value={currentCopy.title} onChange={(event) => updateSlideCopy(activeSlide - 1, { title: event.target.value })} />
          </label>
          <label className="luxLabel">
            Text
            <textarea value={currentCopy.body} onChange={(event) => updateSlideCopy(activeSlide - 1, { body: event.target.value })} />
          </label>
          <p className="luxSubhead">Heading size</p>
          <div className="luxPills compact">
            {(['XS', 'S', 'M', 'L', 'XL', 'XXL'] as SizeName[]).map((size) => (
              <button key={size} className={currentCopy.titleSize === size ? 'active' : ''} onClick={() => updateSlideCopy(activeSlide - 1, { titleSize: size })}>{size}</button>
            ))}
          </div>
          <p className="luxSubhead">Text size</p>
          <div className="luxPills compact">
            {(['XS', 'S', 'M', 'L', 'XL'] as SizeName[]).map((size) => (
              <button key={size} className={currentCopy.bodySize === size ? 'active' : ''} onClick={() => updateSlideCopy(activeSlide - 1, { bodySize: size })}>{size}</button>
            ))}
          </div>
          <p className="luxSubhead">Text alignment</p>
          <div className="luxPills compact">
            {(['auto', 'left', 'center', 'right'] as AlignName[]).map((align) => (
              <button key={align} className={currentCopy.align === align ? 'active' : ''} onClick={() => updateSlideCopy(activeSlide - 1, { align })}>
                {align === 'auto' ? 'Auto' : align}
              </button>
            ))}
          </div>
          <label className="luxLabel">
            Text spacing <b>{copySpacing.toFixed(1)}</b>
            <input type="range" min={0.8} max={1.45} step={0.05} value={copySpacing} onChange={(event) => setCopySpacing(Number(event.target.value))} />
          </label>
          <div className="luxColorRows">
            <label>Heading <input type="color" value={currentCopy.titleColor} onChange={(event) => updateSlideCopy(activeSlide - 1, { titleColor: event.target.value })} /></label>
            <label>Text <input type="color" value={currentCopy.bodyColor} onChange={(event) => updateSlideCopy(activeSlide - 1, { bodyColor: event.target.value })} /></label>
          </div>
          <p className="luxSubhead">Heading font</p>
          <div className="luxFontGrid">
            {fonts.map((item) => (
              <button
                key={item}
                className={currentCopy.font === item ? 'active' : ''}
                style={{ fontFamily: fontStack(item) }}
                onClick={() => {
                  setFont(item);
                  updateSlideCopy(activeSlide - 1, { font: item });
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <button className="luxWide subtle" onClick={() => updateSlideCopy(activeSlide - 1, { font })}>Reset to global font</button>
        </section>

        <section className="luxCard">
          <h2>Photo Positioning</h2>
          <div className="luxMoveGrid">
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x - 6, y: selected.y - 6 })}>↖</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, y: selected.y - 6 })}>↑</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x + 6, y: selected.y - 6 })}>↗</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x - 6 })}>←</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: 4, y: 4, width: 92, height: 92 })}>⊙</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x + 6 })}>→</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x - 6, y: selected.y + 6 })}>↙</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, y: selected.y + 6 })}>↓</button>
            <button onClick={() => selected?.type === 'image' && updateObject({ ...selected, x: selected.x + 6, y: selected.y + 6 })}>↘</button>
          </div>
          <label className="luxLabel">
            Overlay darkness <b>{overlayDarkness}%</b>
            <input type="range" min={10} max={75} value={overlayDarkness} onChange={(event) => setOverlayDarkness(Number(event.target.value))} />
          </label>
          <button className="luxWide" onClick={() => inputRef.current?.click()}>Add photos</button>
          <button className="luxWide subtle" onClick={() => addText(activeSlide - 1)}>Add free text</button>
        </section>

        <section className="luxCard">
          <h2>Story Highlights Cover</h2>
          <label className="luxLabel">
            Emoji icon
            <input value={highlightIcon} onChange={(event) => setHighlightIcon(event.target.value)} />
          </label>
          <label className="luxLabel">
            Name
            <input value={highlightName} onChange={(event) => setHighlightName(event.target.value)} />
          </label>
          <div className="luxCoverActions">
            <button className="subtle">Preview</button>
            <button className="luxGold">Download</button>
          </div>
          <div className="luxHighlightPreview">
            <span>{highlightIcon}</span>
            <small>{highlightName}</small>
          </div>
        </section>

        <p className="luxEyebrow">Save & Export</p>
        <section className="luxCard">
          <div className="luxCardHead">
            <span className="luxStep">10</span>
            <h2>Download PNG</h2>
          </div>
          <p className="luxHelp">Format: {ratio} · {resolution}×{exportHeight}px</p>
          <div className="luxExportGrid">
            {Array.from({ length: slideCount }).map((_, slide) => (
              <button key={slide} onClick={() => exportPng(slide)}>↓ Slide {slide + 1}</button>
            ))}
          </div>
          <button className="luxGold" onClick={exportZip}>Download all PNG</button>
          <button className="luxWide subtle" onClick={exportZip}>Export as ZIP</button>
        </section>

        {selected?.type === 'text' && (
          <section className="luxCard">
            <h2>Selected Text</h2>
            <textarea value={selected.text} onChange={(event) => updateObject({ ...selected, text: event.target.value })} />
            <select value={selected.font} onChange={(event) => updateObject({ ...selected, font: event.target.value as FontName })}>
              {fonts.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input type="range" min={2} max={12} step={0.1} value={selected.fontSize} onChange={(event) => updateObject({ ...selected, fontSize: Number(event.target.value) })} />
            <input type="color" value={selected.color} onChange={(event) => updateObject({ ...selected, color: event.target.value })} />
          </section>
        )}
      </aside>

      <section className="luxWorkspace">
        <div className="luxTabs">
          <span className="active">{ratioMap[ratio].label}</span>
          <b>{baseSize.width} × {baseSize.height} px</b>
        </div>
        <div className="luxMeta">
          <span>{ratio} carousel</span>
          <b>{resolution}×{exportHeight} → export {resolution}×{exportHeight}px</b>
        </div>
        <div className="luxSlides">
          {Array.from({ length: slideCount }).map((_, slide) => (
            <article key={slide} className="luxSlideWrap">
              <p>SLIDE {slide + 1} / {slideCount}</p>
              <div
                ref={(node) => {
                  slideRefs.current[slide] = node;
                }}
                className="luxSlide"
                style={{
                  aspectRatio: `${baseSize.width} / ${baseSize.height}`,
                  background: `linear-gradient(135deg, ${selectedTemplate.colors[0]}, ${selectedTemplate.colors[1]} 58%, ${selectedTemplate.colors[2]})`,
                }}
                onPointerMove={(event) => pointerMoveSlide(event, slide)}
                onPointerUp={() => setDragging(null)}
                onPointerLeave={() => setDragging(null)}
                onPointerDown={() => setSelectedId(null)}
              >
                <div className="luxShade" style={{ backgroundColor: `rgba(0,0,0,${overlayDarkness / 100})` }} />
                <span className="luxTiny">carousel studio</span>
                {(() => {
                  const copy = slideCopies[slide] ?? defaultSlides[slide % defaultSlides.length];
                  const layout = slideTextLayout(slide);
                  const align = textAlign(copy);
                  return (
                    <div
                      className={`luxGeneratedCopy align-${align}`}
                      style={{
                        left: `${layout.x}%`,
                        top: `${layout.y}%`,
                        width: `${layout.width}%`,
                        textAlign: align,
                      }}
                    >
                      <small style={{ color: copy.bodyColor }}>{copy.eyebrow}</small>
                      <h3
                        style={{
                          color: copy.titleColor,
                          fontFamily: fontStack(copy.font),
                          fontSize: `${titleScale[copy.titleSize]}cqw`,
                          lineHeight: copySpacing,
                        }}
                      >
                        {copy.title}
                      </h3>
                      <p
                        style={{
                          color: copy.bodyColor,
                          fontSize: `${bodyScale[copy.bodySize]}cqw`,
                          lineHeight: 1.18 * copySpacing,
                        }}
                      >
                        {copy.body}
                      </p>
                    </div>
                  );
                })()}
                {slideObjects(slide).map((object) => (
                  <div
                    key={object.id}
                    className={`luxObject ${selectedId === object.id ? 'selected' : ''}`}
                    style={{
                      left: `${object.x}%`,
                      top: `${object.y}%`,
                      width: `${object.width}%`,
                      height: `${object.height}%`,
                      opacity: object.opacity,
                    }}
                    onPointerDown={(event) => pointerDownObject(event, object)}
                  >
                    {object.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={object.src} alt={object.name} draggable={false} />
                    ) : (
                      <div
                        className="luxText"
                        style={{
                          fontFamily: fontStack(object.font),
                          fontSize: `${object.fontSize}cqw`,
                          fontWeight: object.weight,
                          color: object.color,
                        }}
                      >
                        {object.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="luxSlideActions">
                <button onClick={() => setObjects((items) => items.filter((item) => item.slide !== slide))}>×</button>
                <button onClick={() => inputRef.current?.click()}>Photo ✓</button>
                <button onClick={() => exportPng(slide)}>PNG</button>
              </div>
            </article>
          ))}
        </div>
        <footer className="luxStatus">{message}</footer>
      </section>
    </main>
  );
}
