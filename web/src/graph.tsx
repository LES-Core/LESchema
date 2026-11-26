import { useLayoutEffect, useRef } from 'react';
import {
  BaseEdge, Handle, NodeResizeControl, useReactFlow, useUpdateNodeInternals, useViewport,
} from '@xyflow/react';
import type { Dimensions, EdgeProps, NodeProps, ShouldResize } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import {
  anchor, blockLabel, contours, canvasEdgeColor, height, maxBlockSize, maxCoordinate, minBlockHeight, minBlockWidth,
  outlineTransform, positions, route, shapes, sides, subroutineDividers, width,
} from './diagram';
import type { Arrow, Block, Shape, Side } from './diagram';

export function ShapePreview({ kind }: { kind: Shape }) {
  const style = shapes[kind].canvas;
  return (
    <svg width="30" height="20" viewBox="-5 -6 190 96" aria-hidden="true">
      {kind === 'comment' ? (
        <text x={width / 2} y="71" fill={style.color} textAnchor="middle" fontSize="76" fontWeight="600">T</text>
      ) : (
        <path d={contours[kind]} fill={style.fill} stroke={style.stroke} strokeWidth="6" />
      )}
      {kind === 'subroutine' && <path d={subroutineDividers} fill="none" stroke={style.stroke} strokeWidth="6" />}
    </svg>
  );
}

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const withinCanvas: ShouldResize = (_, rect) => rect.x >= -maxCoordinate && rect.y >= -maxCoordinate
  && rect.x + rect.width <= maxCoordinate && rect.y + rect.height <= maxCoordinate;

function handleStyle(kind: Shape, side: Side, size: Dimensions) {
  if (side === 'left') return { left: anchor(kind, side, size).x };
  if (side === 'right') return { right: size.width - anchor(kind, side, size).x };
  return undefined;
}

export function BlockView({ data, id, selected, width: blockWidth = width, height: blockHeight = height }: NodeProps<Block>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const previousKind = useRef(data.kind);
  useLayoutEffect(() => {
    if (previousKind.current !== data.kind) {
      previousKind.current = data.kind;
      updateNodeInternals(id);
    }
  }, [data.kind, id, updateNodeInternals]);
  const style = shapes[data.kind].canvas;
  const contour = contours[data.kind];
  const size = { width: blockWidth, height: blockHeight };
  const { lines, fontSize } = blockLabel(data.kind, data.text, size);
  return (
    <div className={`diagram-block${selected ? ' is-selected' : ''}`} style={size} title={data.text}>
      <svg viewBox={`0 0 ${blockWidth} ${blockHeight}`} aria-hidden="true">
        <g transform={outlineTransform(size)}>
          <path className="selected-outline" d={contour || contours.process} fill="none" stroke="var(--accent)" strokeWidth="7" vectorEffect="non-scaling-stroke" />
          {contour && <path d={contour} fill={style.fill} stroke={style.stroke} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />}
          {data.kind === 'subroutine' && <path d={subroutineDividers} fill="none" stroke={style.stroke} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />}
        </g>
        <g fill={style.color} textAnchor="middle" fontSize={fontSize} fontWeight="600">
          {lines.map(({ text, y }, index) => <text key={index} x={blockWidth / 2} y={y}>{text}</text>)}
        </g>
      </svg>
      {selected && corners.map(position => (
        <NodeResizeControl
          key={position} position={position} className="resize-corner"
          minWidth={minBlockWidth} minHeight={minBlockHeight} maxWidth={maxBlockSize} maxHeight={maxBlockSize}
          keepAspectRatio={data.kind === 'link'}
          shouldResize={withinCanvas}
        />
      ))}
      {sides.map(side => (
        <Handle
          key={side} id={side} type="source" position={positions[side]}
          style={handleStyle(data.kind, side, size)}
          aria-label={`Точка соединения ${side}`}
        />
      ))}
    </div>
  );
}

export function ArrowView(props: EdgeProps<Arrow>) {
  const [path, labelX, labelY] = route(
    { x: props.sourceX, y: props.sourceY }, { x: props.targetX, y: props.targetY },
    props.sourcePosition, props.targetPosition,
  );
  return (
    <BaseEdge
      id={props.id}
      path={path}
      markerEnd={props.markerEnd}
      style={{ stroke: props.selected ? '#5de7a3' : canvasEdgeColor, strokeWidth: props.selected ? 2.8 : 2 }}
      label={props.data?.text || undefined}
      labelX={labelX}
      labelY={labelY}
      labelShowBg
      labelStyle={{ fill: props.selected ? '#5de7a3' : canvasEdgeColor, fontSize: 12, fontWeight: 600 }}
      labelBgStyle={{ fill: '#111a29' }}
      labelBgPadding={[7, 3]}
      labelBgBorderRadius={5}
    />
  );
}

export const nodeTypes = { block: BlockView };
export const edgeTypes = { arrow: ArrowView };
export const fitOptions = { padding: 0.12, maxZoom: 1 };

export function ZoomControls() {
  const flow = useReactFlow<Block, Arrow>();
  const { zoom } = useViewport();
  return (
    <div className="zoom-controls" aria-label="Масштаб">
      <button type="button" aria-label="Уменьшить" title="Уменьшить" onClick={() => void flow.zoomOut({ duration: 130 })}><Minus size={15} /></button>
      <button type="button" className="zoom-value" title="Вернуть масштаб 100%" onClick={() => void flow.zoomTo(1, { duration: 180 })}>{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="Увеличить" title="Увеличить" onClick={() => void flow.zoomIn({ duration: 130 })}><Plus size={15} /></button>
      <span className="zoom-divider" />
      <button type="button" aria-label="Уместить схему" title="Уместить схему" onClick={() => void flow.fitView({ ...fitOptions, duration: 200 })}><Maximize size={15} /></button>
    </div>
  );
}
