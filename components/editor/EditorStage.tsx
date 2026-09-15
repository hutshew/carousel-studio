'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  CarouselProject,
  EditorObject,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  UploadedImage,
} from '../../types/editor';

type EditorStageProps = {
  project: CarouselProject;
  selectedId: string | null;
  zoom: number;
  onSelect: (id: string | null) => void;
  onChangeObject: (object: EditorObject) => void;
  onDropImage: (upload: UploadedImage, x: number, y: number) => void;
  dragUpload: UploadedImage | null;
  onEditText: (id: string) => void;
};

function useCanvasImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let active = true;
    const next = new Image();
    next.onload = () => {
      if (active) setImage(next);
    };
    next.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return image;
}

function EditableImage({
  object,
  upload,
  selected,
  registerNode,
  onSelect,
  onChangeObject,
}: {
  object: EditorObject;
  upload?: UploadedImage;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
}) {
  const image = useCanvasImage(upload?.src);

  if (object.type !== 'image') return null;

  return (
    <KonvaImage
      ref={(node) => registerNode(object.id, node)}
      id={object.id}
      image={image ?? undefined}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      draggable
      stroke={selected ? '#111827' : undefined}
      strokeWidth={selected ? 2 : 0}
      onClick={() => onSelect(object.id)}
      onTap={() => onSelect(object.id)}
      onDragEnd={(event) => {
        onChangeObject({ ...object, x: event.target.x(), y: event.target.y() });
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChangeObject({
          ...object,
          x: node.x(),
          y: node.y(),
          width: Math.max(40, object.width * scaleX),
          height: Math.max(40, object.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

function EditableText({
  object,
  selected,
  registerNode,
  onSelect,
  onChangeObject,
  onEditText,
}: {
  object: EditorObject;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
  onEditText: (id: string) => void;
}) {
  if (object.type !== 'text') return null;

  return (
    <Text
      ref={(node) => registerNode(object.id, node)}
      id={object.id}
      text={object.text}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      fontSize={object.fontSize}
      fontFamily={object.fontFamily}
      fontStyle={`${object.italic ? 'italic' : 'normal'} ${object.bold ? '700' : '400'}`}
      fill={object.fill}
      align={object.align}
      draggable
      stroke={selected ? '#111827' : undefined}
      strokeWidth={selected ? 1 : 0}
      onClick={() => onSelect(object.id)}
      onTap={() => onSelect(object.id)}
      onDblClick={() => onEditText(object.id)}
      onDblTap={() => onEditText(object.id)}
      onDragEnd={(event) => {
        onChangeObject({ ...object, x: event.target.x(), y: event.target.y() });
      }}
      onTransformEnd={(event) => {
        const node = event.target as Konva.Text;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChangeObject({
          ...object,
          x: node.x(),
          y: node.y(),
          width: Math.max(80, object.width * scaleX),
          height: Math.max(40, object.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

export default function EditorStage({
  project,
  selectedId,
  zoom,
  onSelect,
  onChangeObject,
  onDropImage,
  dragUpload,
  onEditText,
}: EditorStageProps) {
  const scale = zoom / 100;
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const canvasWidth = project.pageCount * PAGE_WIDTH;

  const uploadMap = useMemo(() => {
    return new Map(project.uploads.map((upload) => [upload.id, upload]));
  }, [project.uploads]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const node = selectedId ? nodeRefs.current[selectedId] : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, project.objects]);

  function registerNode(id: string, node: Konva.Node | null) {
    nodeRefs.current[id] = node;
  }

  function getDropPoint(event: React.DragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, (event.clientX - rect.left) / scale),
      y: Math.max(0, (event.clientY - rect.top) / scale),
    };
  }

  return (
    <div className="stageFrame">
      <div
        className="stageScaleBox"
        style={{ width: canvasWidth * scale, height: PAGE_HEIGHT * scale }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!dragUpload) return;
          const point = getDropPoint(event);
          onDropImage(dragUpload, point.x, point.y);
        }}
      >
        <Stage
          ref={stageRef}
          width={canvasWidth * scale}
          height={PAGE_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) onSelect(null);
          }}
          onTouchStart={(event) => {
            if (event.target === event.target.getStage()) onSelect(null);
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={canvasWidth} height={PAGE_HEIGHT} fill={project.background} />
            {Array.from({ length: project.pageCount }).map((_, index) => (
              <Text
                key={`label-${index}`}
                text={`PAGE ${String(index + 1).padStart(2, '0')}`}
                x={index * PAGE_WIDTH + 32}
                y={28}
                fontSize={28}
                fontFamily="Arial"
                fontStyle="700"
                fill="rgba(17,24,39,0.28)"
                listening={false}
              />
            ))}
          </Layer>

          <Layer>
            {project.objects.map((object) =>
              object.type === 'image' ? (
                <EditableImage
                  key={object.id}
                  object={object}
                  upload={uploadMap.get(object.imageId)}
                  selected={selectedId === object.id}
                  registerNode={registerNode}
                  onSelect={onSelect}
                  onChangeObject={onChangeObject}
                />
              ) : (
                <EditableText
                  key={object.id}
                  object={object}
                  selected={selectedId === object.id}
                  registerNode={registerNode}
                  onSelect={onSelect}
                  onChangeObject={onChangeObject}
                  onEditText={onEditText}
                />
              ),
            )}
          </Layer>

          <Layer listening={false}>
            {Array.from({ length: project.pageCount + 1 }).map((_, index) => (
              <Rect
                key={`guide-${index}`}
                x={index * PAGE_WIDTH}
                y={0}
                width={2}
                height={PAGE_HEIGHT}
                fill={index === 0 || index === project.pageCount ? 'rgba(17,24,39,0.18)' : '#7c8592'}
                dash={index === 0 || index === project.pageCount ? undefined : [18, 18]}
                listening={false}
              />
            ))}
          </Layer>

          <Layer>
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={[
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'bottom-right',
                'bottom-center',
                'bottom-left',
                'middle-left',
              ]}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 30 || newBox.height < 30 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
