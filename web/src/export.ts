import { anchor, blockLines, contours, edgeColor, height, positions, route, shapes, textWidth, typeface, width } from './diagram';
import type { Diagram, Side } from './diagram';

export const imageFormats = {
  png: { label: 'PNG', mime: 'image/png', description: 'Изображение без потерь' },
  jpg: { label: 'JPG', mime: 'image/jpeg', description: 'Компактное изображение' },
  webp: { label: 'WebP', mime: 'image/webp', description: 'Изображение для веба' },
  svg: { label: 'SVG', mime: 'image/svg+xml', description: 'Векторное изображение' },
};
export type ImageFormat = keyof typeof imageFormats;

function escapeXml(text: string) {
  return text.replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '�')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function renderSvg(diagram: Diagram) {
  const nodes = new Map(diagram.nodes.map(node => [node.id, node]));
  const margin = 58;
  let left = Math.min(...diagram.nodes.map(node => node.position.x)) - margin;
  let top = Math.min(...diagram.nodes.map(node => node.position.y)) - margin;
  let right = Math.max(...diagram.nodes.map(node => node.position.x + width)) + margin;
  let bottom = Math.max(...diagram.nodes.map(node => node.position.y + height)) + margin;

  const labels: string[] = [];
  const paths = diagram.edges.map(edge => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const from = edge.sourceHandle as Side;
    const to = edge.targetHandle as Side;
    if (!source || !target) return '';
    const sourceAnchor = anchor(source.data.kind, from);
    const targetAnchor = anchor(target.data.kind, to);
    const [path, x, y] = route(
      { x: source.position.x + sourceAnchor.x, y: source.position.y + sourceAnchor.y },
      { x: target.position.x + targetAnchor.x, y: target.position.y + targetAnchor.y },
      positions[from], positions[to],
    );
    const label = edge.data?.text ?? '';
    if (label) {
      const half = textWidth(label, 12, 600) / 2 + 8;
      left = Math.min(left, x - half - 12);
      right = Math.max(right, x + half + 12);
      top = Math.min(top, y - 24);
      bottom = Math.max(bottom, y + 24);
      labels.push(`<g><rect x="${x - half}" y="${y - 10}" width="${half * 2}" height="20" rx="5" fill="white" /><text x="${x}" y="${y + 4}" font-size="12" fill="${edgeColor}">${escapeXml(label)}</text></g>`);
    }
    return `<path d="${path}" fill="none" stroke="${edgeColor}" stroke-width="2" marker-end="url(#arrow)" />`;
  });

  const blocks = diagram.nodes.map(({ position, data }) => {
    const style = shapes[data.kind];
    const lines = blockLines(data.kind, data.text);
    const lineHeight = data.kind === 'decision' ? 16 : 18;
    const text = lines.map((line, index) =>
      `<text x="${width / 2}" y="${height / 2 + (index - (lines.length - 1) / 2) * lineHeight + 4.5}">${escapeXml(line)}</text>`,
    );
    return `<g transform="translate(${position.x} ${position.y})"><path d="${contours[data.kind]}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.8" /><g fill="${style.color}" font-size="${data.kind === 'decision' ? 13 : 14}">${text.join('')}</g></g>`;
  });

  const imageWidth = Math.ceil(right - left);
  const imageHeight = Math.ceil(bottom - top);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="${left} ${top} ${imageWidth} ${imageHeight}" font-family="${typeface}" font-weight="600" text-anchor="middle">
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4 0 8Z" fill="${edgeColor}" /></marker></defs>
  <rect x="${left}" y="${top}" width="${imageWidth}" height="${imageHeight}" fill="white" />
  ${paths.join('')}${blocks.join('')}${labels.join('')}
</svg>`;
  return { svg, imageWidth, imageHeight };
}

export async function exportImage(diagram: Diagram, format: ImageFormat) {
  if (diagram.nodes.length === 0) throw new Error('Добавьте хотя бы один блок.');
  const { svg, imageWidth, imageHeight } = renderSvg(diagram);
  const vector = new Blob([svg], { type: imageFormats.svg.mime });
  if (format === 'svg') return vector;
  const scale = Math.min(2, 8192 / Math.max(imageWidth, imageHeight), Math.sqrt(16_000_000 / (imageWidth * imageHeight)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(imageWidth * scale));
  canvas.height = Math.max(1, Math.floor(imageHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не смог создать изображение.');
  const url = URL.createObjectURL(vector);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const mime = imageFormats[format].mime;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.93));
    if (!blob || blob.type !== mime) throw new Error(`Браузер не поддерживает экспорт в ${imageFormats[format].label}.`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
