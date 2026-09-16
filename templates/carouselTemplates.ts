import {
  EditorObject,
  ImageFrameObject,
  PAGE_WIDTH,
  ShapeObject,
  TextObject,
} from '../types/editor';

export type TemplateId = 'minimal' | 'travel-story' | 'photo-dump' | 'product' | 'before-after' | 'information';

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  pageCount: number;
  background: string;
  thumbnail: 'minimal' | 'travel' | 'dump' | 'product' | 'compare' | 'info';
  objects: EditorObject[];
};

function text(
  id: string,
  input: Omit<TextObject, 'id' | 'type' | 'rotation' | 'opacity' | 'fontFamily' | 'italic' | 'align'> &
    Partial<Pick<TextObject, 'fontFamily' | 'italic' | 'align' | 'opacity' | 'rotation'>>,
): TextObject {
  return {
    id,
    type: 'text',
    rotation: 0,
    opacity: 1,
    fontFamily: 'Arial',
    italic: false,
    align: 'left',
    ...input,
  };
}

function frame(id: string, input: Omit<ImageFrameObject, 'id' | 'type' | 'rotation' | 'opacity' | 'fitMode' | 'cornerRadius' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'> & Partial<Pick<ImageFrameObject, 'rotation' | 'opacity' | 'fitMode' | 'cornerRadius'>>): ImageFrameObject {
  return {
    id,
    type: 'imageFrame',
    name: input.name,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    fitMode: input.fitMode ?? 'cover',
    cornerRadius: input.cornerRadius ?? 0,
    cropX: 0,
    cropY: 0,
    cropWidth: 0,
    cropHeight: 0,
  };
}

function shape(id: string, input: Omit<ShapeObject, 'id' | 'type' | 'rotation' | 'opacity'> & Partial<Pick<ShapeObject, 'rotation' | 'opacity'>>): ShapeObject {
  return {
    id,
    type: 'shape',
    rotation: 0,
    opacity: 1,
    ...input,
  };
}

const p = (page: number) => PAGE_WIDTH * page;

export const carouselTemplates: TemplateDefinition[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean editorial layout',
    pageCount: 3,
    background: '#ffffff',
    thumbnail: 'minimal',
    objects: [
      text('minimal-title', { name: 'Text - Your Story', text: 'YOUR\nSTORY', x: p(0) + 96, y: 170, width: 690, height: 280, fontSize: 118, fill: '#111827', bold: true }),
      text('minimal-swipe', { name: 'Text - Swipe', text: 'Swipe to explore ->', x: p(0) + 104, y: 480, width: 520, height: 52, fontSize: 30, fill: '#64748b', bold: false }),
      frame('minimal-frame-1', { name: 'Frame - Minimal hero', x: p(0) + 116, y: 600, width: 830, height: 560, cornerRadius: 28 }),
      frame('minimal-frame-2', { name: 'Frame - Editorial crossing', x: p(0) + 820, y: 150, width: 980, height: 760, cornerRadius: 12 }),
      text('minimal-copy', { name: 'Text - Editorial note', text: 'A quiet layout for one strong visual moment.', x: p(1) + 185, y: 975, width: 690, height: 92, fontSize: 34, fill: '#334155', bold: false, align: 'center' }),
      text('minimal-thanks', { name: 'Text - Thank You', text: 'THANK\nYOU', x: p(2) + 145, y: 290, width: 780, height: 260, fontSize: 112, fill: '#111827', bold: true, align: 'center' }),
      frame('minimal-frame-3', { name: 'Frame - Closing', x: p(2) + 320, y: 635, width: 440, height: 460, cornerRadius: 34 }),
    ],
  },
  {
    id: 'travel-story',
    name: 'Travel Story',
    description: 'Travel photography layout',
    pageCount: 5,
    background: '#fbfaf7',
    thumbnail: 'travel',
    objects: [
      text('travel-title', { name: 'Text - Travel', text: 'TRAVEL', x: p(0) + 92, y: 145, width: 720, height: 150, fontSize: 138, fill: '#0f172a', bold: true }),
      text('travel-place', { name: 'Text - Chiang Mai', text: 'CHIANG MAI', x: p(0) + 100, y: 300, width: 790, height: 110, fontSize: 76, fill: '#0f766e', bold: true }),
      frame('travel-hero', { name: 'Frame - Travel hero', x: p(0) + 118, y: 485, width: 840, height: 655, cornerRadius: 30 }),
      frame('travel-cross', { name: 'Frame - Cross-page journey', x: p(0) + 820, y: 175, width: 1040, height: 700, cornerRadius: 18 }),
      text('travel-journey-num', { name: 'Text - 01', text: '01', x: p(1) + 160, y: 930, width: 150, height: 72, fontSize: 52, fill: '#0f766e', bold: true }),
      text('travel-journey', { name: 'Text - The Journey', text: 'THE\nJOURNEY', x: p(1) + 310, y: 915, width: 540, height: 170, fontSize: 68, fill: '#111827', bold: true }),
      frame('travel-grid-a', { name: 'Frame - Morning', x: p(2) + 110, y: 160, width: 390, height: 520, cornerRadius: 24 }),
      frame('travel-grid-b', { name: 'Frame - Evening', x: p(2) + 570, y: 320, width: 390, height: 520, cornerRadius: 24 }),
      text('travel-location', { name: 'Text - Location', text: 'old city walks\nmountain coffee\nsoft evening light', x: p(2) + 130, y: 860, width: 780, height: 180, fontSize: 38, fill: '#334155', bold: false, align: 'center' }),
      frame('travel-story-frame', { name: 'Frame - Story', x: p(3) + 95, y: 145, width: 890, height: 640, cornerRadius: 16 }),
      text('travel-story-copy', { name: 'Text - Short Story', text: 'A slow weekend guide for the north, built from quiet corners and color.', x: p(3) + 135, y: 850, width: 820, height: 150, fontSize: 38, fill: '#1f2937', bold: false, align: 'center' }),
      frame('travel-final-frame', { name: 'Frame - Final hero', x: p(4) + 116, y: 150, width: 850, height: 630, cornerRadius: 30 }),
      text('travel-final', { name: 'Text - See You', text: 'SEE YOU\nON THE NEXT TRIP', x: p(4) + 118, y: 860, width: 850, height: 210, fontSize: 62, fill: '#0f172a', bold: true, align: 'center' }),
    ],
  },
  {
    id: 'photo-dump',
    name: 'Photo Dump',
    description: 'Casual photo carousel',
    pageCount: 5,
    background: '#f8fafc',
    thumbnail: 'dump',
    objects: [
      text('dump-title', { name: 'Text - Photo Dump', text: 'PHOTO\nDUMP\n01', x: p(0) + 115, y: 170, width: 780, height: 430, fontSize: 120, fill: '#111827', bold: true }),
      frame('dump-p1-small', { name: 'Frame - First memory', x: p(0) + 570, y: 700, width: 360, height: 410, cornerRadius: 24 }),
      frame('dump-p2-large', { name: 'Frame - Big memory', x: p(1) + 95, y: 130, width: 890, height: 780, cornerRadius: 28 }),
      frame('dump-p2-small', { name: 'Frame - Detail', x: p(1) + 610, y: 820, width: 310, height: 350, cornerRadius: 22 }),
      frame('dump-p3-a', { name: 'Frame - Moment A', x: p(2) + 95, y: 170, width: 430, height: 500, cornerRadius: 24 }),
      frame('dump-p3-b', { name: 'Frame - Moment B', x: p(2) + 555, y: 335, width: 430, height: 580, cornerRadius: 24 }),
      frame('dump-p4-cross', { name: 'Frame - Weekend cross', x: p(3) - 160, y: 185, width: 1180, height: 740, cornerRadius: 34 }),
      text('dump-end', { name: 'Text - End', text: 'END OF\nDUMP', x: p(4) + 140, y: 330, width: 800, height: 260, fontSize: 104, fill: '#111827', bold: true, align: 'center' }),
      frame('dump-last', { name: 'Frame - Last detail', x: p(4) + 325, y: 685, width: 430, height: 430, cornerRadius: 32 }),
    ],
  },
  {
    id: 'product',
    name: 'Product',
    description: 'Product showcase',
    pageCount: 3,
    background: '#f7f7f4',
    thumbnail: 'product',
    objects: [
      frame('product-hero', { name: 'Frame - Product hero', x: p(0) + 210, y: 160, width: 660, height: 650, cornerRadius: 36, fitMode: 'contain' }),
      text('product-name', { name: 'Text - Product Name', text: 'PRODUCT\nNAME', x: p(0) + 150, y: 870, width: 780, height: 170, fontSize: 76, fill: '#111827', bold: true, align: 'center' }),
      text('product-tagline', { name: 'Text - Tagline', text: 'A short, confident product tagline.', x: p(0) + 205, y: 1060, width: 670, height: 60, fontSize: 30, fill: '#64748b', bold: false, align: 'center' }),
      frame('product-detail-a', { name: 'Frame - Detail 01', x: p(1) + 100, y: 180, width: 390, height: 520, cornerRadius: 24 }),
      frame('product-detail-b', { name: 'Frame - Detail 02', x: p(1) + 590, y: 180, width: 390, height: 520, cornerRadius: 24 }),
      text('product-f1', { name: 'Text - Feature 01', text: 'FEATURE 01', x: p(1) + 110, y: 760, width: 380, height: 64, fontSize: 38, fill: '#111827', bold: true, align: 'center' }),
      text('product-f2', { name: 'Text - Feature 02', text: 'FEATURE 02', x: p(1) + 590, y: 760, width: 390, height: 64, fontSize: 38, fill: '#111827', bold: true, align: 'center' }),
      frame('product-final', { name: 'Frame - CTA product', x: p(2) + 250, y: 170, width: 580, height: 600, cornerRadius: 32, fitMode: 'contain' }),
      text('product-cta', { name: 'Text - CTA', text: 'READY TO\nMAKE IT YOURS?', x: p(2) + 130, y: 850, width: 820, height: 210, fontSize: 68, fill: '#111827', bold: true, align: 'center' }),
    ],
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'Comparison carousel',
    pageCount: 3,
    background: '#ffffff',
    thumbnail: 'compare',
    objects: [
      text('before-title', { name: 'Text - Before', text: 'BEFORE', x: p(0) + 120, y: 130, width: 820, height: 120, fontSize: 108, fill: '#111827', bold: true, align: 'center' }),
      frame('before-frame', { name: 'Frame - Before', x: p(0) + 130, y: 320, width: 820, height: 760, cornerRadius: 24 }),
      frame('compare-cross', { name: 'Frame - Seamless transition', x: p(0) + 760, y: 250, width: 640, height: 840, cornerRadius: 0 }),
      text('after-title', { name: 'Text - After', text: 'AFTER', x: p(2) + 130, y: 130, width: 820, height: 120, fontSize: 108, fill: '#0f766e', bold: true, align: 'center' }),
      frame('after-frame', { name: 'Frame - After', x: p(2) + 130, y: 320, width: 820, height: 760, cornerRadius: 24 }),
    ],
  },
  {
    id: 'information',
    name: 'Information',
    description: 'Educational carousel',
    pageCount: 5,
    background: '#fcfcfb',
    thumbnail: 'info',
    objects: [
      text('info-title', { name: 'Text - Title', text: 'A SIMPLE\nGUIDE', x: p(0) + 110, y: 260, width: 860, height: 270, fontSize: 104, fill: '#111827', bold: true }),
      frame('info-cover-frame', { name: 'Frame - Cover support', x: p(0) + 580, y: 690, width: 330, height: 330, cornerRadius: 28 }),
      ...[1, 2, 3].flatMap((page) => [
        text(`info-${page}-num`, { name: `Text - 0${page}`, text: `0${page}`, x: p(page) + 105, y: 205, width: 160, height: 92, fontSize: 64, fill: '#0f766e', bold: true }),
        text(`info-${page}-headline`, { name: `Text - Key ${page}`, text: 'KEY\nINFORMATION', x: p(page) + 105, y: 330, width: 800, height: 190, fontSize: 74, fill: '#111827', bold: true }),
        text(`info-${page}-body`, { name: `Text - Body ${page}`, text: 'Explain the point clearly with short, scannable text.', x: p(page) + 115, y: 585, width: 720, height: 160, fontSize: 38, fill: '#475569', bold: false }),
        shape(`info-${page}-line`, { name: `Shape - Divider ${page}`, shape: 'rect', x: p(page) + 115, y: 820, width: 760, height: 6, fill: '#111827', stroke: '#111827', strokeWidth: 0 }),
      ]),
      text('info-summary', { name: 'Text - Summary', text: 'SAVE THIS\nFOR LATER', x: p(4) + 125, y: 320, width: 830, height: 220, fontSize: 86, fill: '#111827', bold: true, align: 'center' }),
      text('info-cta', { name: 'Text - CTA', text: 'Use this last slide for a summary, CTA, or checklist.', x: p(4) + 155, y: 640, width: 770, height: 120, fontSize: 38, fill: '#475569', bold: false, align: 'center' }),
      frame('info-final-frame', { name: 'Frame - Optional image', x: p(4) + 355, y: 830, width: 370, height: 270, cornerRadius: 24 }),
    ],
  },
];
