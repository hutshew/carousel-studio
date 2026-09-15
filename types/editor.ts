export const PAGE_WIDTH = 1080;
export const PAGE_HEIGHT = 1350;
export const MIN_PAGES = 2;
export const MAX_PAGES = 10;

export type ToolName =
  | 'Upload'
  | 'Templates'
  | 'Photos'
  | 'Text'
  | 'Elements'
  | 'Background'
  | 'Layers'
  | 'Projects';

export type TextAlign = 'left' | 'center' | 'right';

export type UploadedImage = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

export type BaseObject = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export type ImageObject = BaseObject & {
  type: 'image';
  imageId: string;
};

export type TextObject = BaseObject & {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
};

export type PlaceholderObject = BaseObject & {
  type: 'placeholder';
  label: string;
};

export type ShapeObject = BaseObject & {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type EditorObject = ImageObject | TextObject | PlaceholderObject | ShapeObject;

export type CarouselProject = {
  name: string;
  pageCount: number;
  background: string;
  objects: EditorObject[];
  uploads: UploadedImage[];
};

export type ExportQuality = 0.8 | 0.9 | 0.95 | 1;
