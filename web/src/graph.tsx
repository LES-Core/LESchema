import { useLayoutEffect, useRef } from 'react';
import {
  BaseEdge, Handle, useReactFlow, useUpdateNodeInternals, useViewport,
} from '@xyflow/react';
import type { EdgeProps, NodeProps } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import {
  blockLines, contours, canvasEdgeColor, height, inputInset, positions, route, shapes, sides, width,
} from './diagram';
import type { Arrow, Block, Shape } from './diagram';

export function ShapePreview({ kind }: { kind: Shape }) {
  const style = shapes[kind].canvas;
  return (
    <svg width="30" height="20" viewBox="-5 -6 190 96" aria-hidden="true">
      <path d={contours[kind]} fill={style.fill} stroke={style.stroke} strokeWidth="6" />
    </svg>
  );
}

export function BlockView({ data, id, selected }: NodeProps<Block>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const previousKind = useRef(data.kind);
  useLayoutEffect(() => {
    if (previousKind.current !== data.kind) {
      previousKind.current = data.kind;
      updateNodeInternals(id);
    }
  }, [data.kind, id, updateNodeInternals]);
  const style = shapes[data.kind].canvas;
  const lines = blockLines(data.kind, data.text);
  const lineHeight = data.kind === 'decision' ? 16 : 18;
  return (
    <div className={`diagram-block${selected ? ' is-selected' : ''}`} style={{ width, height }} title={data.text}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path className="selected-outline" d={contours[data.kind]} fill="none" stroke="var(--accent)" strokeWidth="7" />
        <path d={contours[data.kind]} fill={style.fill} stroke={style.stroke} strokeWidth="1.8" />
        <g fill={style.color} textAnchor="middle" fontSize={data.kind === 'decision' ? 13 : 14} fontWeight="600">
          {lines.map((line, index) => (
            <text key={index} x={width / 2} y={height / 2 + (index - (lines.length - 1) / 2) * lineHeight + 4.5}>
              {line}
            </text>
          ))}
        </g>
      </svg>
      {sides.map(side => (
        <Handle
          key={side} id={side} type="source" position={positions[side]}
          style={data.kind === 'input' && (side === 'left' || side === 'right') ? { [side]: inputInset } : undefined}
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
