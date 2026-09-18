import {
  CarouselProject,
  EditorObject,
  ExportFormat,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  UploadedImage,
} from '../types/editor';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function canvasFontFamily(fontFamily: string) {
  return fontFamily.includes(' ') ? `"${fontFamily.replace(/"/g, '\\"')}"` : fontFamily;
}

async function waitForProjectFonts(project: CarouselProject) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  const textFonts = Array.from(
    new Set(
      project.objects
        .filter((object) => object.type === 'text')
        .map((object) => object.fontFamily),
    ),
  );
  if (!textFonts.length) return;

  await Promise.all(
    textFonts.flatMap((fontFamily) => {
      const family = canvasFontFamily(fontFamily);
      return [`400 32px ${family}`, `700 32px ${family}`].map((font) => document.fonts.load(font));
    }),
  );
  await document.fonts.ready;
}

function loadImage(src: string) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not decode image.'));
        image.src = src;
      }),
    );
  }

  return imageCache.get(src)!;
}

function drawRotated(ctx: CanvasRenderingContext2D, object: EditorObject, draw: () => void) {
  ctx.save();
  ctx.globalAlpha = object.opacity;
  ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
  ctx.rotate((object.rotation * Math.PI) / 180);
  ctx.translate(-object.width / 2, -object.height / 2);
  draw();
  ctx.restore();
}

function roundedPath(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, safeRadius);
}

function coverCrop(sourceWidth: number, sourceHeight: number, frameWidth: number, frameHeight: number) {
  const frameRatio = frameWidth / frameHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > frameRatio) {
    cropWidth = sourceHeight * frameRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / frameRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  return { cropX, cropY, cropWidth, cropHeight };
}

async function drawObject(
  ctx: CanvasRenderingContext2D,
  object: EditorObject,
  uploads: UploadedImage[],
) {
  if (object.type === 'image') {
    const upload = uploads.find((item) => item.id === object.imageId);
    if (!upload) return;

    const image = await loadImage(upload.src);
    drawRotated(ctx, object, () => {
      ctx.save();
      if (object.flipX || object.flipY) {
        ctx.translate(object.flipX ? object.width : 0, object.flipY ? object.height : 0);
        ctx.scale(object.flipX ? -1 : 1, object.flipY ? -1 : 1);
      }
      ctx.drawImage(
        image,
        object.cropX ?? 0,
        object.cropY ?? 0,
        object.cropWidth || image.naturalWidth,
        object.cropHeight || image.naturalHeight,
        0,
        0,
        object.width,
        object.height,
      );
      ctx.restore();
    });
    return;
  }

  if (object.type === 'imageFrame') {
    const upload = object.assetId ? uploads.find((item) => item.id === object.assetId) : null;
    drawRotated(ctx, object, () => {
      roundedPath(ctx, object.width, object.height, object.cornerRadius);
      ctx.fillStyle = '#e5e7eb';
      ctx.fill();
      ctx.save();
      roundedPath(ctx, object.width, object.height, object.cornerRadius);
      ctx.clip();
      ctx.restore();

      if (!upload) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4;
        roundedPath(ctx, object.width, object.height, object.cornerRadius);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 54px Arial';
        ctx.fillText('▧', object.width / 2, object.height / 2 - 36);
        ctx.font = '700 34px Arial';
        ctx.fillText('Add photo', object.width / 2, object.height / 2 + 36, object.width - 80);
      }
    });

    if (!upload) return;

    const image = await loadImage(upload.src);
    drawRotated(ctx, object, () => {
      roundedPath(ctx, object.width, object.height, object.cornerRadius);
      ctx.clip();

      if (object.fitMode === 'contain') {
        const scale = Math.min(object.width / image.naturalWidth, object.height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, (object.width - drawWidth) / 2, (object.height - drawHeight) / 2, drawWidth, drawHeight);
      } else {
        const crop =
          object.cropWidth > 0 && object.cropHeight > 0
            ? object
            : coverCrop(image.naturalWidth, image.naturalHeight, object.width, object.height);
        ctx.drawImage(
          image,
          crop.cropX,
          crop.cropY,
          crop.cropWidth,
          crop.cropHeight,
          0,
          0,
          object.width,
          object.height,
        );
      }
    });
    return;
  }

  if (object.type === 'placeholder') {
    drawRotated(ctx, object, () => {
      ctx.fillStyle = '#e5e7eb';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.fillRect(0, 0, object.width, object.height);
      ctx.strokeRect(0, 0, object.width, object.height);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 42px Arial';
      ctx.fillText(object.label, object.width / 2, object.height / 2 + 42, object.width - 80);
      ctx.font = '700 80px Arial';
      ctx.fillText('+', object.width / 2, object.height / 2 - 36);
    });
    return;
  }

  if (object.type === 'shape') {
    drawRotated(ctx, object, () => {
      ctx.fillStyle = object.fill;
      ctx.strokeStyle = object.stroke;
      ctx.lineWidth = object.strokeWidth;
      if (object.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(0, object.height / 2);
        ctx.lineTo(object.width, object.height / 2);
        ctx.stroke();
      } else if (object.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(object.width / 2, object.height / 2, object.width / 2, object.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (object.strokeWidth > 0) ctx.stroke();
      } else if (object.shape === 'roundRect') {
        const radius = object.radius ?? 32;
        ctx.beginPath();
        ctx.roundRect(0, 0, object.width, object.height, radius);
        ctx.fill();
        if (object.strokeWidth > 0) ctx.stroke();
      } else {
        ctx.fillRect(0, 0, object.width, object.height);
        if (object.strokeWidth > 0) ctx.strokeRect(0, 0, object.width, object.height);
      }
    });
    return;
  }

  drawRotated(ctx, object, () => {
    ctx.fillStyle = object.fill;
    ctx.textAlign = object.align;
    ctx.textBaseline = 'top';
    ctx.font = `${object.italic ? 'italic ' : ''}${object.bold ? '700 ' : '400 '}${
      object.fontSize
    }px ${canvasFontFamily(object.fontFamily)}`;

    const lines = object.text.split('\n');
    const lineHeight = object.fontSize * 1.2;
    const x = object.align === 'center' ? object.width / 2 : object.align === 'right' ? object.width : 0;

    lines.forEach((line, index) => {
      ctx.fillText(line, x, index * lineHeight, object.width);
    });
  });
}

export async function renderCarouselPages(
  project: CarouselProject,
  quality = 0.95,
  selectedPage?: number,
  format: ExportFormat = 'jpg',
) {
  await waitForProjectFonts(project);

  const pages = selectedPage === undefined ? project.pageCount : 1;
  const start = selectedPage ?? 0;
  const urls: string[] = [];

  for (let offset = 0; offset < pages; offset += 1) {
    const pageIndex = start + offset;
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas rendering is not available.');

    ctx.fillStyle = project.background;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.translate(-pageIndex * PAGE_WIDTH, 0);

    for (const object of project.objects) {
      await drawObject(ctx, object, project.uploads);
    }

    urls.push(canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', format === 'png' ? undefined : quality));
  }

  return urls;
}

export async function renderCarouselPageBlobs(
  project: CarouselProject,
  quality = 0.95,
  selectedPage?: number,
  format: ExportFormat = 'jpg',
) {
  const pages = await renderCarouselPages(project, quality, selectedPage, format);
  return Promise.all(
    pages.map(async (dataUrl) => {
      const response = await fetch(dataUrl);
      return response.blob();
    }),
  );
}

export async function renderProjectThumbnail(project: CarouselProject) {
  const [dataUrl] = await renderCarouselPages(project, 0.8, 0, 'jpg');
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error('Thumbnail rendering failed.'));
    next.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = Math.round((180 * PAGE_HEIGHT) / PAGE_WIDTH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
