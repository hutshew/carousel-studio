'use client';

import { ChangeEvent, useRef, useState } from 'react';

const tools = [
  ['＋', 'Upload'], ['▦', 'Templates'], ['▣', 'Photos'], ['T', 'Text'],
  ['◇', 'Elements'], ['●', 'Background'], ['▱', 'Projects'],
];

export default function Home() {
  const [pages, setPages] = useState(3);
  const [zoom, setZoom] = useState(55);
  const [images, setImages] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState('Upload');
  const [preview, setPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImages((old) => [...old, ...files.map((file) => URL.createObjectURL(file))]);
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand"><span className="brandMark">C</span><b>CAROUSEL</b> STUDIO</div>
        <button className="projectName">My Carousel <span>⌄</span></button>
        <div className="topActions">
          <button className="iconButton">↶</button><button className="iconButton">↷</button>
          <button className="previewButton" onClick={() => setPreview(true)}>▷ Preview</button>
          <button className="exportButton" onClick={() => alert('Export JPG จะเพิ่มในขั้นถัดไป')}>Export</button>
        </div>
      </header>

      <aside className="sidebar">
        {tools.map(([icon, label]) => (
          <button key={label} className={activeTool === label ? 'tool active' : 'tool'} onClick={() => { setActiveTool(label); if (label === 'Upload') inputRef.current?.click(); }}>
            <span>{icon}</span>{label}
          </button>
        ))}
        <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={upload} />
      </aside>

      <section className="workspace">
        <div className="workspaceHead">
          <div><b>Instagram Portrait</b><span className="muted"> 1080 × 1350 · 4:5</span></div>
          <div className="badge">{pages} pages</div>
        </div>

        <div className="canvasScroller">
          <div className="canvas" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
            {Array.from({ length: pages }).map((_, i) => (
              <div className="page" key={i}>
                <div className="pageLabel">PAGE {String(i + 1).padStart(2, '0')}</div>
                {i === 0 && images.length === 0 && <div className="heroText"><small>CREATE · DESIGN · SHARE</small><h1>MAKE IT<br/>SEAMLESS.</h1><p>Upload photos and start designing your carousel.</p><button onClick={() => inputRef.current?.click()}>＋ Upload photos</button></div>}
                {images[i] && <img className="placedImage" src={images[i]} alt="Uploaded" />}
                {i > 0 && !images[i] && <div className="emptyPage">Drop your design here</div>}
              </div>
            ))}
          </div>
        </div>

        <button className="addPage" onClick={() => setPages((p) => Math.min(10, p + 1))}>＋ Add Page</button>
      </section>

      <footer className="statusbar">
        <span>{pages} pages</span><span>Grid ✓</span><span>Snap ✓</span>
        <div className="zoom"><button onClick={() => setZoom(z => Math.max(25, z - 10))}>−</button><span>{zoom}%</span><button onClick={() => setZoom(z => Math.min(100, z + 10))}>＋</button></div>
      </footer>

      {preview && <div className="modal" onClick={() => setPreview(false)}><div className="previewCard" onClick={e => e.stopPropagation()}><div className="previewHead"><b>Carousel Preview</b><button onClick={() => setPreview(false)}>×</button></div><div className="previewPages">{Array.from({length: pages}).map((_, i) => <div className="previewPage" key={i}>{images[i] ? <img src={images[i]} alt="preview"/> : <span>{i+1}</span>}</div>)}</div><p>เลื่อนซ้าย–ขวาเพื่อจำลองการ Swipe บน Instagram</p></div></div>}
    </main>
  );
}
