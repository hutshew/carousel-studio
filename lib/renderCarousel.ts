import {
  CarouselProject,
  EditorObject,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  UploadedImage,
} from '../types/editor';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

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
    }px ${object.fontFamily}`;

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
) {
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

    urls.push(canvas.toDataURL('image/jpeg', quality));
  }

  return urls;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
