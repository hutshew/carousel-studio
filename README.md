# Carousel Studio

A browser-based seamless carousel editor for creating Instagram carousel posts.

## Features

- Instagram portrait canvas at 1080 × 1350 pixels per page.
- One continuous horizontal Konva stage for 2–10 pages.
- Page boundary guides and labels inside the editor.
- Image upload for JPG, PNG, and WEBP files.
- Drag, resize, rotate, duplicate, delete, and layer-order controls.
- Text objects with content, font, size, color, alignment, bold, italic, opacity, rotation, and resize controls.
- Whole-carousel background color presets and custom color input.
- Undo/redo for committed editor actions.
- Add, delete, and reorder pages while adjusting object coordinates.
- Instagram-style preview rendered from the continuous design.
- Client-side JPG export at 1080 × 1350 per page with quality options.
- Local browser project save/load using localStorage.
- Starter template actions for Minimal, Travel Story, and Photo Dump layouts.

## Installation

```bash
npm install
```

If your environment cannot write to the default npm cache, use a local cache:

```bash
npm install --cache ./.npm-cache
```

## Development

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Usage

1. Upload photos from the Upload or Photos panel.
2. Click a photo to place it on the continuous carousel canvas, or drag it from the Photos panel onto the canvas.
3. Move, resize, and rotate objects with the Konva transformer.
4. Add text from the Text panel and style it from the sidebar.
5. Drag objects across page boundaries to create seamless carousel transitions.
6. Open Preview to see sliced pages.
7. Use Export to download JPG files named `carousel-01.jpg`, `carousel-02.jpg`, and so on.

## Current Limitations

- Project saving uses localStorage with image data URLs. Very large projects can exceed browser storage.
- ZIP export is not included yet; pages download as individual JPG files.
- Page backgrounds are global for the whole carousel in V1.
- Drag-to-reorder layers is not implemented yet; layer buttons are available.
- The editor targets desktop Chrome and Edge first. Smaller screens use a simplified layout.

No login, backend, database, cloud image upload, or Cloudflare deployment is required for V1.
