import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyEdgeChanges, applyNodeChanges, Background, ConnectionLineType, ConnectionMode, ReactFlow,
  ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import {
  ArrowDownToLine, ChevronDown, FilePlus2, FolderOpen, Keyboard, MousePointer2,
  Redo2, Save, Trash2, Undo2,
} from 'lucide-react';
import {
  arrow, block, blockSize, clean, deserialize, height, maxArrows, maxBlocks, maxCoordinate, sample, serialize, shapes, sides, width,
} from './diagram';
import type { Arrow, Block, Diagram, Shape, Side } from './diagram';
import { download, exportImage, imageFormats } from './export';
import type { ImageFormat } from './export';
import { edgeTypes, fitOptions, nodeTypes, ShapePreview, ZoomControls } from './graph';
import { serializeProgramForYou } from './program-for-you';
import '@xyflow/react/dist/style.css';
import './style.css';

const shapeKinds = Object.keys(shapes) as Shape[];
const historyLimit = 60;

function Editor() {
  const [diagram, setDiagram] = useState(sample);
  const current = useRef(diagram);
  const [history, setHistory] = useState<{ past: Diagram[]; future: Diagram[] }>({ past: [], future: [] });
  const [name, setName] = useState('Проверка числа');
  const [dirty, setDirty] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const textEditor = useRef<HTMLTextAreaElement>(null);
  const geometryStart = useRef<Diagram | null>(null);
  const textSaved = useRef(false);
  const flow = useReactFlow<Block, Arrow>();
  const selectedBlocks = diagram.nodes.filter(node => node.selected);
  const selectedEdges = diagram.edges.filter(edge => edge.selected);
  const node = selectedBlocks.length === 1 && selectedEdges.length === 0 ? selectedBlocks[0] : undefined;
  const edge = selectedEdges.length === 1 && selectedBlocks.length === 0 ? selectedEdges[0] : undefined;
  const selectionCount = selectedBlocks.length + selectedEdges.length;

  function update(next: Diagram) {
    current.current = next;
    setDiagram(next);
  }

  function remember(previous = clean(current.current)) {
    setHistory(({ past }) => ({ past: [...past.slice(1 - historyLimit), previous], future: [] }));
    setDirty(true);
  }

  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [clean(current.current), ...history.future] });
    update(previous);
    setDirty(true);
  }

  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, clean(current.current)], future: history.future.slice(1) });
    update(next);
    setDirty(true);
  }

  function reset(next: Diagram, title: string) {
    update(next);
    setHistory({ past: [], future: [] });
    setName(title);
    setDirty(false);
    if (next.nodes.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => void flow.fitView({ ...fitOptions, duration: 180 })));
    } else {
      void flow.setViewport({ x: 0, y: 0, zoom: 1 });
    }
  }

  function newProject() {
    if (dirty && !window.confirm('Начать новую схему? Несохранённые изменения будут потеряны.')) return;
    reset({ nodes: [], edges: [] }, 'Без названия');
  }

  function save() {
    download(new Blob([serialize(current.current)], { type: 'application/json' }), `${filename()}.json`);
    setDirty(false);
    textSaved.current = false;
    setNotice('Файл схемы подготовлен к загрузке.');
  }

  async function load(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error('Файл схемы превышает 2 МБ.');
      const next = deserialize(await file.text());
      if (dirty && !window.confirm('Открыть другую схему? Несохранённые изменения будут потеряны.')) return;
      reset(next, file.name.replace(/\.json$/i, '') || 'Без названия');
      setNotice('Схема открыта.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось открыть файл.');
    }
  }

  function filename() {
    return (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/[. ]+$/, '') || 'Схема').slice(0, 80);
  }

  async function exportAs(format: ImageFormat) {
    setMenu(false);
    setBusy(true);
    try {
      const image = await exportImage(current.current, format);
      download(image, `${filename()}.${format}`);
      setNotice(`${imageFormats[format].label} подготовлен к загрузке.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось экспортировать схему.');
    } finally {
      setBusy(false);
    }
  }

  function exportProgramForYou() {
    setMenu(false);
    try {
      const json = serializeProgramForYou(current.current);
      download(new Blob([json], { type: 'application/json' }), `${filename()}-programforyou.json`);
      setNotice('JSON для ProgramForYou подготовлен к загрузке.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось подготовить JSON для ProgramForYou.');
    }
  }

  function addBlock(kind: Shape) {
    const bounds = stage.current?.getBoundingClientRect();
    if (!bounds) return;
    const state = current.current;
    if (state.nodes.length >= maxBlocks) {
      setNotice(`В схеме может быть до ${maxBlocks} блоков.`);
      return;
    }
    const point = flow.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    const x = Math.max(-maxCoordinate, Math.min(maxCoordinate - width, point.x - width / 2));
    let y = Math.max(-maxCoordinate, Math.min(maxCoordinate - height, point.y - height / 2));
    const moveUp = y > maxCoordinate / 2;
    const rectangles = state.nodes.map(item => ({ ...item.position, ...blockSize(item) }));
    while (y >= -maxCoordinate && y + height <= maxCoordinate) {
      const overlapping = rectangles.find(rect => x < rect.x + rect.width && rect.x < x + width
        && y < rect.y + rect.height && rect.y < y + height);
      if (!overlapping) break;
      y = moveUp ? overlapping.y - height - 12 : overlapping.y + overlapping.height + 12;
    }
    if (y < -maxCoordinate || y + height > maxCoordinate) {
      setNotice('Переместите поле, чтобы освободить место для блока.');
      return;
    }
    const next = block(crypto.randomUUID(), kind, shapes[kind].text, x, y);
    remember();
    update({
      nodes: [...state.nodes.map(item => ({ ...item, selected: false })), { ...next, selected: true }],
      edges: state.edges.map(item => ({ ...item, selected: false })),
    });
  }

  function removeSelected() {
    const state = current.current;
    const ids = new Set(state.nodes.filter(item => item.selected).map(item => item.id));
    if (!ids.size && !state.edges.some(item => item.selected)) return;
    remember();
    update({
      nodes: state.nodes.filter(item => !ids.has(item.id)),
      edges: state.edges.filter(item => !item.selected && !ids.has(item.source) && !ids.has(item.target)),
    });
  }

  function validConnection(connection: Connection | Arrow) {
    return connection.source !== connection.target
      && sides.some(side => side === connection.sourceHandle)
      && sides.some(side => side === connection.targetHandle);
  }

  function connect(connection: Connection) {
    const state = current.current;
    if (!validConnection(connection)) return;
    if (state.edges.length >= maxArrows) {
      setNotice(`В схеме может быть до ${maxArrows} стрелок.`);
      return;
    }
    if (state.edges.some(item => item.source === connection.source && item.target === connection.target
      && item.sourceHandle === connection.sourceHandle && item.targetHandle === connection.targetHandle)) return;
    const next = arrow(crypto.randomUUID(), connection.source, connection.target,
      connection.sourceHandle as Side, connection.targetHandle as Side);
    remember();
    update({ ...state, edges: [...state.edges, next] });
  }

  function changeNodes(changes: NodeChange<Block>[]) {
    const state = current.current;
    if (changes.some(change => change.type === 'dimensions' && change.resizing)) {
      geometryStart.current ??= clean(state);
    }
    const moved = changes.some(change => change.type === 'position' && change.position);
    if (moved && !geometryStart.current) remember();
    update({ ...state, nodes: applyNodeChanges(changes, state.nodes) });
    if (changes.some(change => change.type === 'dimensions' && change.resizing === false)) finishGeometryChange();
  }

  function changeEdges(changes: EdgeChange<Arrow>[]) {
    const state = current.current;
    update({ ...state, edges: applyEdgeChanges(changes, state.edges) });
  }

  function finishGeometryChange() {
    const previous = geometryStart.current;
    geometryStart.current = null;
    if (previous?.nodes.some((item, index) => {
      const now = current.current.nodes[index];
      if (!now || now.id !== item.id) return false;
      const beforeSize = blockSize(item);
      const afterSize = blockSize(now);
      return now.position.x !== item.position.x || now.position.y !== item.position.y
        || beforeSize.width !== afterSize.width || beforeSize.height !== afterSize.height;
    })) remember(previous);
  }

  function changeNodeKind(kind: Shape) {
    if (!node || node.data.kind === kind) return;
    remember();
    const state = current.current;
    update({ ...state, nodes: state.nodes.map(item =>
      item.id === node.id ? { ...item, data: { ...item.data, kind } } : item,
    ) });
  }

  function changeText(text: string) {
    if (!textSaved.current) {
      remember();
      textSaved.current = true;
    }
    const state = current.current;
    if (node) update({ ...state, nodes: state.nodes.map(item =>
      item.id === node.id ? { ...item, data: { ...item.data, text } } : item,
    ) });
    if (edge) update({ ...state, edges: state.edges.map(item =>
      item.id === edge.id ? { ...item, data: { text } } : item,
    ) });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!menu) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !menuRoot.current?.contains(event.target)) setMenu(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menu]);

  useEffect(() => {
    if (!dirty) return;
    function confirmExit(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener('beforeunload', confirmExit);
    return () => window.removeEventListener('beforeunload', confirmExit);
  }, [dirty]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(false);
      const inField = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.code;
      if (modifier && !event.altKey && key === 'KeyS') {
        event.preventDefault();
        save();
      }
      if (modifier && !event.altKey && key === 'KeyO') {
        event.preventDefault();
        fileInput.current?.click();
      }
      if (inField) return;
      if (modifier && !event.altKey && (key === 'KeyZ' || key === 'KeyY')) {
        event.preventDefault();
        if (key === 'KeyY' || event.shiftKey) redo();
        else undo();
      }
      if (!modifier && (key === 'Delete' || key === 'Backspace')) {
        event.preventDefault();
        removeSelected();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });

  return (
    <main className="editor">
      <header className="app-header">
        <div className="brand">
          <img className="brand-mark" src="/icon.png" width="44" height="44" alt="" />
          <div><strong>LES<span>chema</span></strong><small>Редактор блок-схем</small></div>
        </div>
        <div className="header-actions">
          <button className="button header-save" type="button" title="Сохранить схему (Ctrl+S)" onClick={save}><Save size={17} /><span>Сохранить</span></button>
          <div className="export-root" ref={menuRoot}>
            <button type="button" className="button export-button" aria-expanded={menu} disabled={!diagram.nodes.length || busy} onClick={() => setMenu(!menu)}>
              <ArrowDownToLine size={17} /><span>{busy ? 'Экспорт…' : 'Экспорт'}</span><ChevronDown size={14} />
            </button>
            {menu && (
              <div className="export-menu">
                {(Object.keys(imageFormats) as ImageFormat[]).map(format => (
                  <button type="button" key={format} onClick={() => void exportAs(format)}>
                    <strong>{imageFormats[format].label}</strong><small>{imageFormats[format].description}</small>
                  </button>
                ))}
                <button type="button" onClick={exportProgramForYou}>
                  <strong>JSON</strong><small>Для ProgramForYou</small>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="toolbar">
        <div className="tool-group"><button type="button" className="button" title="Новая схема" onClick={newProject}><FilePlus2 size={17} /><span>Новая</span></button>
          <button type="button" className="button" title="Открыть схему (Ctrl+O)" onClick={() => fileInput.current?.click()}><FolderOpen size={17} /><span>Открыть</span></button>
          <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void load(file);
          }} />
        </div>
        <span className="toolbar-divider" />
        <div className="tool-group">
          <button type="button" className="icon-button" title="Отменить (Ctrl+Z)" aria-label="Отменить" disabled={!history.past.length} onClick={undo}><Undo2 size={19} /></button>
          <button type="button" className="icon-button" title="Повторить (Ctrl+Y)" aria-label="Повторить" disabled={!history.future.length} onClick={redo}><Redo2 size={19} /></button>
          <button type="button" className="icon-button danger" title="Удалить выделенное (Delete)" aria-label="Удалить выделенное" disabled={!selectionCount} onClick={removeSelected}><Trash2 size={17} /></button>
        </div>
        <div className="project-name">
          <input aria-label="Название схемы" value={name} maxLength={80} placeholder="Без названия" onChange={event => {
            setName(event.currentTarget.value);
            setDirty(true);
          }} />
          {dirty && <i title="Есть несохранённые изменения" />}
        </div>
      </div>

      <div className="workspace">
        <aside className="sidebar">
          <section className="palette">
            <h2>Блоки</h2>
            {shapeKinds.map(kind => (
              <button type="button" className="palette-item" key={kind} onClick={() => addBlock(kind)}>
                <ShapePreview kind={kind} /><span>{shapes[kind].name}</span>
              </button>
            ))}
          </section>
          <section className="inspector" aria-label="Свойства">
            <h2>Свойства</h2>
            {node && (
              <div key={node.id} className="fields">
                <label>Тип блока
                  <select value={node.data.kind} onChange={event => changeNodeKind(event.currentTarget.value as Shape)}>
                    {shapeKinds.map(kind => <option key={kind} value={kind}>{shapes[kind].name}</option>)}
                  </select>
                </label>
                <label>Текст блока
                  <textarea ref={textEditor} rows={3} value={node.data.text} maxLength={300} onFocus={() => { textSaved.current = false; }} onChange={event => changeText(event.currentTarget.value)} />
                </label>
              </div>
            )}
            {edge && (
              <div key={edge.id} className="fields">
                <label>Подпись стрелки
                  <input value={edge.data?.text ?? ''} placeholder="Да, нет или другой текст" maxLength={60} onFocus={() => { textSaved.current = false; }} onChange={event => changeText(event.currentTarget.value)} />
                </label>
              </div>
            )}
            {!node && !edge && <p className="selection-hint"><MousePointer2 size={16} />{selectionCount ? `Выбрано элементов: ${selectionCount}` : 'Выберите блок или стрелку'}</p>}
          </section>
          <div className="sidebar-hint"><Keyboard size={17} /><div>Перетащите точку на блоке к точке другого блока, чтобы провести стрелку.</div></div>
        </aside>

        <div className="stage" ref={stage}>
          <ReactFlow
            nodes={diagram.nodes} edges={diagram.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={changeNodes} onEdgesChange={changeEdges}
            onNodeDragStart={() => { geometryStart.current ??= clean(current.current); }}
            onNodeDragStop={finishGeometryChange}
            onSelectionDragStart={() => { geometryStart.current ??= clean(current.current); }}
            onSelectionDragStop={finishGeometryChange}
            onNodeDoubleClick={() => requestAnimationFrame(() => textEditor.current?.focus())}
            onConnect={connect} isValidConnection={validConnection} connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep} connectionLineStyle={{ stroke: '#5de7a3', strokeWidth: 2 }}
            deleteKeyCode={null} minZoom={0.15} maxZoom={2.5} nodeExtent={[[-maxCoordinate, -maxCoordinate], [maxCoordinate, maxCoordinate]]}
            edgesReconnectable={false} elevateEdgesOnSelect
            fitView fitViewOptions={fitOptions} proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1.2} color="#344358" />
          </ReactFlow>
          {!diagram.nodes.length && (
            <div className="empty-stage">
              <img src="/icon.png" width="48" height="48" alt="" />
              <p>Добавьте блок из панели слева</p>
            </div>
          )}
          <ZoomControls />
        </div>
      </div>
      <footer className="status-bar">
        <span>Блоков: {diagram.nodes.length} <span className="status-dot">·</span> Стрелок: {diagram.edges.length}</span>
        <span className="status-offline"><i /> Офлайн</span>
      </footer>
      {notice && <div className="notice" role="status">{notice}</div>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<ReactFlowProvider><Editor /></ReactFlowProvider>);
