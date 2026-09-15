'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
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
  onEditImage: (id: string) => void;
  snapEnabled: boolean;
  onContextMenu: (id: string, x: number, y: number) => void;
  cropModeId: string | null;
};

type Guide = {
  orientation: 'vertical' | 'horizontal';
  position: number;
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
  onDragMove,
  onDragComplete,
  onContextMenu,
  onEditImage,
  cropMode,
}: {
  object: EditorObject;
  upload?: UploadedImage;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragComplete: () => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onEditImage: (id: string) => void;
  cropMode: boolean;
}) {
  const image = useCanvasImage(upload?.src);

  if (object.type !== 'image') return null;

  const displayX = object.flipX ? object.x + object.width : object.x;
  const displayY = object.flipY ? object.y + object.height : object.y;

  return (
    <KonvaImage
      ref={(node) => registerNode(object.id, node)}
      id={object.id}
      image={image ?? undefined}
      x={displayX}
      y={displayY}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      crop={{
        x: object.cropX ?? 0,
        y: object.cropY ?? 0,
        width: object.cropWidth || upload?.width || object.width,
        height: object.cropHeight || upload?.height || object.height,
      }}
      scaleX={object.flipX ? -1 : 1}
      scaleY={object.flipY ? -1 : 1}
      draggable
      stroke={cropMode ? '#f97316' : selected ? '#111827' : undefined}
      strokeWidth={cropMode ? 4 : selected ? 2 : 0}
      dash={cropMode ? [18, 12] : undefined}
      onClick={() => onSelect(object.id)}
      onTap={() => onSelect(object.id)}
      onDblClick={() => onEditImage(object.id)}
      onDblTap={() => onEditImage(object.id)}
      onContextMenu={(event) => {
        event.evt.preventDefault();
        onSelect(object.id);
        onContextMenu(object.id, event.evt.clientX, event.evt.clientY);
      }}
      onDragMove={onDragMove}
      onDragEnd={(event) => {
        onChangeObject({
          ...object,
          x: object.flipX ? event.target.x() - object.width : event.target.x(),
          y: object.flipY ? event.target.y() - object.height : event.target.y(),
        });
        onDragComplete();
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        node.scaleX(object.flipX ? -1 : 1);
        node.scaleY(object.flipY ? -1 : 1);
        const width = Math.max(40, object.width * scaleX);
        const height = Math.max(40, object.height * scaleY);
        onChangeObject({
          ...object,
          x: object.flipX ? node.x() - width : node.x(),
          y: object.flipY ? node.y() - height : node.y(),
          width,
          height,
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
  onDragMove,
  onDragComplete,
  onContextMenu,
}: {
  object: EditorObject;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
  onEditText: (id: string) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragComplete: () => void;
  onContextMenu: (id: string, x: number, y: number) => void;
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
      onContextMenu={(event) => {
        event.evt.preventDefault();
        onSelect(object.id);
        onContextMenu(object.id, event.evt.clientX, event.evt.clientY);
      }}
      onDragMove={onDragMove}
      onDragEnd={(event) => {
        onChangeObject({ ...object, x: event.target.x(), y: event.target.y() });
        onDragComplete();
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

function EditablePlaceholder({
  object,
  selected,
  registerNode,
  onSelect,
  onChangeObject,
  onDragMove,
  onDragComplete,
  onContextMenu,
}: {
  object: EditorObject;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragComplete: () => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  if (object.type !== 'placeholder') return null;

  return (
    <Group
      ref={(node) => registerNode(object.id, node)}
      id={object.id}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      draggable
      onClick={() => onSelect(object.id)}
      onTap={() => onSelect(object.id)}
      onContextMenu={(event) => {
        event.evt.preventDefault();
        onSelect(object.id);
        onContextMenu(object.id, event.evt.clientX, event.evt.clientY);
      }}
      onDragMove={onDragMove}
      onDragEnd={(event) => {
        onChangeObject({ ...object, x: event.target.x(), y: event.target.y() });
        onDragComplete();
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
          width: Math.max(90, object.width * scaleX),
          height: Math.max(90, object.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      <Rect
        width={object.width}
        height={object.height}
        fill="#e5e7eb"
        stroke={selected ? '#111827' : '#cbd5e1'}
        strokeWidth={selected ? 4 : 2}
        dash={[18, 14]}
      />
      <Text
        text="+"
        width={object.width}
        y={object.height / 2 - 88}
        align="center"
        fontSize={88}
        fontFamily="Arial"
        fontStyle="700"
        fill="#64748b"
        listening={false}
      />
      <Text
        text={object.label}
        width={object.width}
        y={object.height / 2 + 22}
        align="center"
        fontSize={42}
        fontFamily="Arial"
        fontStyle="700"
        fill="#64748b"
        listening={false}
      />
    </Group>
  );
}

function EditableShape({
  object,
  selected,
  registerNode,
  onSelect,
  onChangeObject,
  onDragMove,
  onDragComplete,
  onContextMenu,
}: {
  object: EditorObject;
  selected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChangeObject: (object: EditorObject) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragComplete: () => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  if (object.type !== 'shape') return null;

  return (
    <Group
      ref={(node) => registerNode(object.id, node)}
      id={object.id}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      draggable
      onClick={() => onSelect(object.id)}
      onTap={() => onSelect(object.id)}
      onContextMenu={(event) => {
        event.evt.preventDefault();
        onSelect(object.id);
        onContextMenu(object.id, event.evt.clientX, event.evt.clientY);
      }}
      onDragMove={onDragMove}
      onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) => {
      onChangeObject({ ...object, x: event.target.x(), y: event.target.y() });
      onDragComplete();
      }}
      onTransformEnd={(event: Konva.KonvaEventObject<Event>) => {
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
    >
      {object.shape === 'ellipse' ? (
        <Ellipse
          x={object.width / 2}
          y={object.height / 2}
          radiusX={object.width / 2}
          radiusY={object.height / 2}
          fill={object.fill}
          stroke={selected ? '#111827' : object.stroke}
          strokeWidth={selected ? Math.max(3, object.strokeWidth) : object.strokeWidth}
        />
      ) : object.shape === 'line' ? (
        <Line
          points={[0, object.height / 2, object.width, object.height / 2]}
          stroke={selected ? '#111827' : object.stroke}
          strokeWidth={selected ? Math.max(3, object.strokeWidth) : object.strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      ) : (
        <Rect
          width={object.width}
          height={object.height}
          cornerRadius={object.shape === 'roundRect' ? object.radius ?? 42 : 0}
          fill={object.fill}
          stroke={selected ? '#111827' : object.stroke}
          strokeWidth={selected ? Math.max(3, object.strokeWidth) : object.strokeWidth}
        />
      )}
    </Group>
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
  onEditImage,
  snapEnabled,
  onContextMenu,
  cropModeId,
}: EditorStageProps) {
  const scale = zoom / 100;
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const [guides, setGuides] = useState<Guide[]>([]);
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

  function snapNode(object: EditorObject, node: Konva.Node) {
    if (!snapEnabled) {
      setGuides([]);
      return;
    }

    const threshold = 14;
    const width = object.width;
    const height = object.height;
    const rawX = object.type === 'image' && object.flipX ? node.x() - width : node.x();
    const rawY = object.type === 'image' && object.flipY ? node.y() - height : node.y();
    const objectStopsX = [rawX, rawX + width / 2, rawX + width];
    const objectStopsY = [rawY, rawY + height / 2, rawY + height];
    const pageStopsX = Array.from({ length: project.pageCount }, (_, index) => {
      const pageX = index * PAGE_WIDTH;
      return [pageX, pageX + PAGE_WIDTH / 2, pageX + PAGE_WIDTH];
    }).flat();
    const otherStopsX = project.objects
      .filter((item) => item.id !== object.id)
      .flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width]);
    const otherStopsY = project.objects
      .filter((item) => item.id !== object.id)
      .flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height]);
    const snapXStops = [...pageStopsX, ...otherStopsX];
    const snapYStops = [PAGE_HEIGHT / 2, ...otherStopsY];
    let nextX = rawX;
    let nextY = rawY;
    const nextGuides: Guide[] = [];

    for (const target of snapXStops) {
      const index = objectStopsX.findIndex((stop) => Math.abs(stop - target) <= threshold);
      if (index >= 0) {
        nextX = rawX + target - objectStopsX[index];
        nextGuides.push({ orientation: 'vertical', position: target });
        break;
      }
    }

    for (const target of snapYStops) {
      const index = objectStopsY.findIndex((stop) => Math.abs(stop - target) <= threshold);
      if (index >= 0) {
        nextY = rawY + target - objectStopsY[index];
        nextGuides.push({ orientation: 'horizontal', position: target });
        break;
      }
    }

    node.x(object.type === 'image' && object.flipX ? nextX + width : nextX);
    node.y(object.type === 'image' && object.flipY ? nextY + height : nextY);
    setGuides(nextGuides);
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
      <div className="pageLabels" style={{ width: canvasWidth * scale }}>
        {Array.from({ length: project.pageCount }).map((_, index) => (
          <span key={index} style={{ left: index * PAGE_WIDTH * scale }}>
            PAGE {String(index + 1).padStart(2, '0')}
          </span>
        ))}
      </div>
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
          </Layer>

          <Layer>
            {project.objects.map((object) => {
              if (object.type === 'image') {
                return (
                <EditableImage
                  key={object.id}
                  object={object}
                  upload={uploadMap.get(object.imageId)}
                  selected={selectedId === object.id}
                  registerNode={registerNode}
                  onSelect={onSelect}
                  onChangeObject={onChangeObject}
                  onDragMove={(event) => snapNode(object, event.target)}
                  onDragComplete={() => setGuides([])}
                  onContextMenu={onContextMenu}
                  onEditImage={onEditImage}
                  cropMode={cropModeId === object.id}
                />
                );
              }

              if (object.type === 'placeholder') {
                return (
                  <EditablePlaceholder
                    key={object.id}
                    object={object}
                    selected={selectedId === object.id}
                    registerNode={registerNode}
                    onSelect={onSelect}
                    onChangeObject={onChangeObject}
                    onDragMove={(event) => snapNode(object, event.target)}
                    onDragComplete={() => setGuides([])}
                    onContextMenu={onContextMenu}
                  />
                );
              }

              if (object.type === 'shape') {
                return (
                  <EditableShape
                    key={object.id}
                    object={object}
                    selected={selectedId === object.id}
                    registerNode={registerNode}
                    onSelect={onSelect}
                    onChangeObject={onChangeObject}
                    onDragMove={(event) => snapNode(object, event.target)}
                    onDragComplete={() => setGuides([])}
                    onContextMenu={onContextMenu}
                  />
                );
              }

              return (
                <EditableText
                  key={object.id}
                  object={object}
                  selected={selectedId === object.id}
                  registerNode={registerNode}
                  onSelect={onSelect}
                  onChangeObject={onChangeObject}
                  onEditText={onEditText}
                  onDragMove={(event) => snapNode(object, event.target)}
                  onDragComplete={() => setGuides([])}
                  onContextMenu={onContextMenu}
                />
              );
            })}
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
            {guides.map((guide, index) =>
              guide.orientation === 'vertical' ? (
                <Line
                  key={`snap-${index}`}
                  points={[guide.position, 0, guide.position, PAGE_HEIGHT]}
                  stroke="#38bdf8"
                  strokeWidth={4}
                  dash={[12, 10]}
                  listening={false}
                />
              ) : (
                <Line
                  key={`snap-${index}`}
                  points={[0, guide.position, canvasWidth, guide.position]}
                  stroke="#38bdf8"
                  strokeWidth={4}
                  dash={[12, 10]}
                  listening={false}
                />
              ),
            )}
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
