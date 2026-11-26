import { anchor, blockSize, positions, route, shapes, sides, textWidth } from './diagram';
import type { Diagram, Side } from './diagram';
import type { XYPosition } from '@xyflow/react';

const fontSize = 14;

function exportBlock(x: number, y: number, width: number, height: number, text: string, type: string) {
  return {
    x, y, text, width, height, type, isMenuBlock: false,
    fontSize, textHeight: fontSize, isBold: false, isItalic: false, textAlign: 'center', labelsPosition: 1,
  };
}

function arrowNodes(path: string) {
  // With radius zero, quadratic commands describe zero-length bends.
  // Their coordinates are already present in the preceding line command.
  const points = Array.from(path.matchAll(/[ML]\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi), ([, x, y]) => ({
    x: Number(x), y: Number(y),
  }));
  const unique = points.filter((point, index) =>
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  );
  if (unique.length === 2) {
    const [start, end] = unique;
    unique.splice(1, 0, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
  }
  return unique;
}

export function serializeProgramForYou(diagram: Diagram) {
  const sizes = diagram.nodes.map(blockSize);
  const indices = new Map(diagram.nodes.map(({ id }, index) => [id, index]));
  // Start inside the visible canvas without depending on the website editor's pan.
  const offsetX = 160 - Math.min(...diagram.nodes.map(node => node.position.x));
  const offsetY = 48 - Math.min(...diagram.nodes.map(node => node.position.y));
  const blocks = diagram.nodes.map(({ position, data }, index) => {
    const size = sizes[index];
    const blockWidth = data.kind === 'link'
      ? anchor('link', 'right', size).x - anchor('link', 'left', size).x
      : size.width;
    const type = data.kind === 'process' ? 'Блок' : shapes[data.kind].name;
    return exportBlock(
      position.x + offsetX + size.width / 2, position.y + offsetY + size.height / 2,
      blockWidth, size.height, data.text, type,
    );
  });

  function endpoint(index: number, side: Side): XYPosition {
    const node = diagram.nodes[index];
    const point = anchor(node.data.kind, side, sizes[index]);
    return { x: node.position.x + offsetX + point.x, y: node.position.y + offsetY + point.y };
  }

  const arrows = diagram.edges.map(edge => {
    const startIndex = indices.get(edge.source);
    const endIndex = indices.get(edge.target);
    const from = edge.sourceHandle as Side;
    const to = edge.targetHandle as Side;
    const startConnectorIndex = sides.indexOf(from);
    const endConnectorIndex = sides.indexOf(to);
    if (startIndex === undefined || endIndex === undefined || startConnectorIndex < 0 || endConnectorIndex < 0) {
      throw new Error('У стрелки отсутствует точка соединения.');
    }
    const [path, labelX, labelY] = route(endpoint(startIndex, from), endpoint(endIndex, to), positions[from], positions[to], 0);
    const nodes = arrowNodes(path);
    const label = edge.data?.text;
    if (label?.trim()) {
      const labelWidth = Math.max(50, Math.ceil(textWidth(label, fontSize, 400)) + 20);
      blocks.push(exportBlock(labelX, labelY - 17, labelWidth, 30, label, shapes.comment.name));
    }
    return { startIndex, endIndex, startConnectorIndex, endConnectorIndex, nodes, counts: nodes.map(() => 1) };
  });

  return JSON.stringify({ blocks, arrows, x0: 0, y0: 0 }, null, 2);
}
