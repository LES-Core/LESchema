import { getSmoothStepPath, MarkerType, Position } from '@xyflow/react';
import type { Dimensions, Edge, Node, XYPosition } from '@xyflow/react';

export const shapes = {
  process: { name: 'Действие', text: 'Действие', color: '#244a9c', fill: '#ebf1ff', stroke: '#8da7e8', canvas: { color: '#ccdeff', fill: '#1b304d', stroke: '#608ac0' } },
  decision: { name: 'Условие', text: 'Условие?', color: '#845213', fill: '#fff5de', stroke: '#d5a44c', canvas: { color: '#ffe3a5', fill: '#3b3020', stroke: '#b68a46' } },
  terminal: { name: 'Начало / конец', text: 'Начало', color: '#106c53', fill: '#e5f8ef', stroke: '#70b49b', canvas: { color: '#b1f7d6', fill: '#143a32', stroke: '#399e74' } },
  subroutine: { name: 'Подпрограмма', text: 'Подпрограмма', color: '#29488e', fill: '#eef2ff', stroke: '#7f97d3', canvas: { color: '#dbe5ff', fill: '#202f52', stroke: '#7a99db' } },
  input: { name: 'Ввод / вывод', text: 'Ввод данных', color: '#634199', fill: '#f4ecff', stroke: '#aa91d7', canvas: { color: '#ecd9ff', fill: '#302441', stroke: '#9876bb' } },
  display: { name: 'Дисплей', text: 'Показать на экране', color: '#11616b', fill: '#e6f7f8', stroke: '#72adba', canvas: { color: '#b2edf1', fill: '#17383d', stroke: '#519cac' } },
  loop: { name: 'Цикл for', text: 'Цикл for', color: '#884318', fill: '#fff0e5', stroke: '#d49b6a', canvas: { color: '#ffdab8', fill: '#3c2b21', stroke: '#bc895c' } },
  link: { name: 'Ссылка', text: 'A', color: '#43546d', fill: '#edf3f8', stroke: '#8b9fb3', canvas: { color: '#dce8f6', fill: '#27384a', stroke: '#849caf' } },
  comment: { name: 'Текст / комментарий', text: 'Комментарий', color: '#394b62', fill: 'none', stroke: 'none', canvas: { color: '#c1d0e3', fill: 'none', stroke: 'none' } },
} as const;

export type Shape = keyof typeof shapes;
export type Block = Node<{ kind: Shape; text: string }, 'block'>;
export type Arrow = Edge<{ text: string }, 'arrow'>;
export type Diagram = { nodes: Block[]; edges: Arrow[] };
export type Side = 'top' | 'right' | 'bottom' | 'left';
export const sides = ['top', 'right', 'bottom', 'left'] as const;
export const width = 180;
export const height = 84;
export const minBlockWidth = 96;
export const minBlockHeight = 48;
export const maxBlockSize = 1200;
const defaultBlockSize = { width, height };
export const edgeColor = '#586477';
export const canvasEdgeColor = '#93a7c0';
export const typeface = 'system-ui, sans-serif';

export const positions = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const anchors: Record<Side, XYPosition> = {
  top: { x: width / 2, y: 0 },
  right: { x: width, y: height / 2 },
  bottom: { x: width / 2, y: height },
  left: { x: 0, y: height / 2 },
};

const horizontalInsets: Partial<Record<Shape, number>> = { input: 17.5, link: 49 };

export function anchor(kind: Shape, side: Side, size = defaultBlockSize): XYPosition {
  const point = anchors[side];
  const inset = horizontalInsets[kind] ?? 0;
  const x = side === 'left' ? inset : side === 'right' ? width - inset : point.x;
  return { x: x * size.width / width, y: point.y * size.height / height };
}

export const contours: Record<Shape, string> = {
  terminal: 'M42 1H138A41 41 0 0 1 138 83H42A41 41 0 0 1 42 1Z',
  process: 'M11 1H169Q179 1 179 11V73Q179 83 169 83H11Q1 83 1 73V11Q1 1 11 1Z',
  decision: 'M90 1L179 42 90 83 1 42Z',
  subroutine: 'M1 1H179V83H1Z',
  input: 'M25 1H170L155 83H10Z',
  display: 'M35 1H138A41 41 0 0 1 138 83H35L1 42Z',
  loop: 'M36 1H144L179 42 144 83H36L1 42Z',
  link: 'M90 1A41 41 0 1 1 90 83A41 41 0 1 1 90 1Z',
  comment: '',
};

export const subroutineDividers = 'M24 1V83M156 1V83';

export function blockSize(node: Pick<Block, 'width' | 'height' | 'initialWidth' | 'initialHeight'>): Dimensions {
  return { width: node.width ?? node.initialWidth ?? width, height: node.height ?? node.initialHeight ?? height };
}

export function outlineTransform(size: Dimensions) {
  return `scale(${size.width / width} ${size.height / height})`;
}

export function block(id: string, kind: Shape, text: string, x: number, y: number, size = defaultBlockSize): Block {
  return {
    id, type: 'block', data: { kind, text }, position: { x, y },
    initialWidth: size.width, initialHeight: size.height,
    ...(size.width !== width || size.height !== height ? size : {}),
  };
}

export function arrow(id: string, source: string, target: string, sourceHandle: Side, targetHandle: Side, label = ''): Arrow {
  return {
    id, source, target, sourceHandle, targetHandle,
    type: 'arrow', data: { text: label },
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: canvasEdgeColor },
  };
}

export function sample(): Diagram {
  return {
    nodes: [
      block('start', 'terminal', 'Начало', 215, 0),
      block('input', 'input', 'Ввести число', 215, 126),
      block('condition', 'decision', 'Число > 0?', 215, 256),
      block('positive', 'process', 'Сообщить: положительное', 0, 401),
      block('other', 'process', 'Сообщить: ноль или меньше', 430, 401),
      block('end', 'terminal', 'Конец', 215, 535),
    ],
    edges: [
      arrow('start-input', 'start', 'input', 'bottom', 'top'),
      arrow('input-condition', 'input', 'condition', 'bottom', 'top'),
      arrow('condition-positive', 'condition', 'positive', 'left', 'top', 'Да'),
      arrow('condition-other', 'condition', 'other', 'right', 'top', 'Нет'),
      arrow('positive-end', 'positive', 'end', 'bottom', 'left'),
      arrow('other-end', 'other', 'end', 'bottom', 'right'),
    ],
  };
}

export function route(start: XYPosition, end: XYPosition, from: Position, to: Position, borderRadius = 9) {
  return getSmoothStepPath({
    sourceX: start.x, sourceY: start.y, targetX: end.x, targetY: end.y,
    sourcePosition: from, targetPosition: to, borderRadius, offset: 22,
  });
}

let measure: CanvasRenderingContext2D | null = null;

export function textWidth(text: string, size: number, weight: number) {
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure) return text.length * size;
  measure.font = `${weight} ${size}px ${typeface}`;
  return measure.measureText(text).width;
}

function wrapLabel(value: string, size: number, maxWidth: number, maxLines: number) {
  const lines: string[] = [];

  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const combined = line ? `${line} ${word}` : word;
      if (textWidth(combined, size, 600) <= maxWidth) {
        line = combined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && textWidth(line + character, size, 600) > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }

  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = Array.from(visible[maxLines - 1].trimEnd());
  while (last.length && textWidth(last.join('') + '…', size, 600) > maxWidth) last.pop();
  visible[maxLines - 1] = last.join('') + '…';
  return visible;
}

const labelLayout: Partial<Record<Shape, { fontSize: number; maxWidth: number; maxLines: number }>> = {
  decision: { fontSize: 13, maxWidth: 92, maxLines: 2 },
  subroutine: { fontSize: 14, maxWidth: 118, maxLines: 3 },
  display: { fontSize: 14, maxWidth: 118, maxLines: 3 },
  loop: { fontSize: 14, maxWidth: 118, maxLines: 3 },
  link: { fontSize: 14, maxWidth: 54, maxLines: 2 },
  comment: { fontSize: 14, maxWidth: 164, maxLines: 4 },
};

export function blockLabel(kind: Shape, value: string, size = defaultBlockSize) {
  const { fontSize, maxWidth, maxLines } = labelLayout[kind] ?? { fontSize: 14, maxWidth: 136, maxLines: 3 };
  const lineHeight = kind === 'decision' ? 16 : 18;
  const widthLimit = maxWidth * size.width / width;
  const lineLimit = Math.max(1, Math.floor(maxLines * size.height / height));
  const wrapped = wrapLabel(value, fontSize, widthLimit, lineLimit);
  return {
    fontSize,
    lines: wrapped.map((text, index) => ({
      text,
      y: size.height / 2 + (index - (wrapped.length - 1) / 2) * lineHeight + 4.5,
    })),
  };
}

export const maxBlocks = 500;
export const maxArrows = 1000;
export const maxCoordinate = 100_000;

export function clean(diagram: Diagram): Diagram {
  return {
    nodes: diagram.nodes.map(node => {
      const { id, data, position } = node;
      return block(id, data.kind, data.text, position.x, position.y, blockSize(node));
    }),
    edges: diagram.edges.map(({ id, source, target, sourceHandle, targetHandle, data }) =>
      arrow(id, source, target, sourceHandle as Side, targetHandle as Side, data?.text)),
  };
}

export function serialize(diagram: Diagram) {
  return JSON.stringify({ version: 1, ...clean(diagram) }, null, 2);
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Некорректная структура схемы.');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, limit: number) {
  if (typeof value !== 'string' || value.length > limit) throw new Error('Некорректный текст или идентификатор.');
  return value;
}

function identifier(value: unknown) {
  const id = string(value, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('В схеме указан некорректный идентификатор.');
  return id;
}

function coordinate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > maxCoordinate) {
    throw new Error('Координаты блока выходят за границы поля.');
  }
  return value;
}

function dimension(value: unknown, minimum: number, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maxBlockSize) {
    throw new Error('В файле указан недопустимый размер блока.');
  }
  return value;
}

function side(value: unknown): Side {
  const found = sides.find(item => item === value);
  if (!found) throw new Error('У стрелки указана неизвестная точка соединения.');
  return found;
}

export function deserialize(value: string): Diagram {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Файл не является корректным JSON.');
  }
  const schema = object(parsed);
  if (schema.version !== 1 || !Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
    throw new Error('Этот формат файла схемы не поддерживается.');
  }
  if (schema.nodes.length > maxBlocks || schema.edges.length > maxArrows) {
    throw new Error('В схеме слишком много блоков или стрелок.');
  }
  const ids = new Set<string>();
  const nodes = schema.nodes.map(entry => {
    const node = object(entry);
    const data = object(node.data);
    const position = object(node.position);
    const id = identifier(node.id);
    const kind = string(data.kind, 20);
    if (ids.has(id) || !Object.hasOwn(shapes, kind)) throw new Error('В файле есть некорректный блок.');
    ids.add(id);
    const size = {
      width: dimension(node.width ?? node.initialWidth, minBlockWidth, width),
      height: dimension(node.height ?? node.initialHeight, minBlockHeight, height),
    };
    return block(id, kind as Shape, string(data.text, 300), coordinate(position.x), coordinate(position.y), size);
  });
  const edgeIds = new Set<string>();
  const edges = schema.edges.map(entry => {
    const edge = object(entry);
    const id = identifier(edge.id);
    const source = identifier(edge.source);
    const target = identifier(edge.target);
    if (edgeIds.has(id) || !ids.has(source) || !ids.has(target) || source === target) {
      throw new Error('В файле есть некорректная стрелка.');
    }
    edgeIds.add(id);
    return arrow(id, source, target, side(edge.sourceHandle), side(edge.targetHandle), string(object(edge.data).text, 60));
  });
  return { nodes, edges };
}
