// Visual editor: React Flow bound to the canonical model. Editing gestures
// (drag, connect, delete, double-click rename) are committed to the model via
// store.mutate(), which re-emits the code text. A floating inspector edits the
// selected node's shape/label or the selected edge's style/label. Code-side
// edits flow back in through a resync effect keyed on the model identity.

import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  connect,
  moveNode,
  removeEdge,
  removeNode,
  renameNode,
  setEdgeKind,
  setEdgeLabel,
  setNodeShape,
} from "../flow/flowToModel";
import { isGroupId, modelToFlow, type AppNode, type FlowEdge } from "../flow/modelToFlow";
import { useEditorStore } from "../model/store";
import type { EdgeKind, GEdge, GNode, NodeShape } from "../model/types";
import { GroupNode } from "./nodes/GroupNode";
import { ShapeNode } from "./nodes/ShapeNode";

const nodeTypes = { shape: ShapeNode, group: GroupNode };

const SHAPE_OPTIONS: [NodeShape, string][] = [
  ["rect", "Rectangle"],
  ["round", "Rounded"],
  ["stadium", "Stadium"],
  ["subroutine", "Subroutine"],
  ["cylinder", "Cylinder"],
  ["circle", "Circle"],
  ["doublecircle", "Double circle"],
  ["rhombus", "Decision"],
  ["hexagon", "Hexagon"],
  ["parallelogram", "Parallelogram"],
  ["parallelogram_alt", "Parallelogram alt"],
  ["trapezoid", "Trapezoid"],
  ["trapezoid_alt", "Trapezoid alt"],
];

const EDGE_OPTIONS: [EdgeKind, string][] = [
  ["arrow", "Arrow  -->"],
  ["open", "Line  ---"],
  ["dotted", "Dotted  -.->"],
  ["dotted_open", "Dotted line  -.-"],
  ["thick", "Thick  ==>"],
  ["thick_open", "Thick line  ==="],
];

export function VisualView() {
  const model = useEditorStore((s) => s.model);
  const mutate = useEditorStore((s) => s.mutate);

  const flow = useMemo(() => modelToFlow(model), [model]);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(flow.edges);
  const [selNodeId, setSelNodeId] = useState<string | null>(null);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);

  // Resync local React Flow state when the model changes from the code side.
  useEffect(() => {
    const { nodes: n, edges: e } = modelToFlow(model);
    setNodes(n);
    setEdges(e);
  }, [model, setNodes, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if ("id" in c && isGroupId(c.id)) continue; // ignore decorative containers
        if (c.type === "position" && c.dragging === false && c.position) {
          mutate((m) => moveNode(m, c.id, c.position!));
        } else if (c.type === "remove") {
          mutate((m) => removeNode(m, c.id));
        }
      }
    },
    [onNodesChange, mutate],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      onEdgesChange(changes);
      for (const c of changes) {
        if (c.type === "remove") mutate((m) => removeEdge(m, c.id));
      }
    },
    [onEdgesChange, mutate],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      if (params.source && params.target && !isGroupId(params.source) && !isGroupId(params.target)) {
        mutate((m) => connect(m, params.source!, params.target!));
      }
    },
    [setEdges, mutate],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      if (isGroupId(node.id) || node.type !== "shape") return;
      const next = window.prompt("Rename node", node.data.label);
      if (next != null) mutate((m) => renameNode(m, node.id, next));
    },
    [mutate],
  );

  const onSelectionChange = useCallback(
    ({ nodes: sn, edges: se }: { nodes: AppNode[]; edges: FlowEdge[] }) => {
      const n = sn.find((x) => !isGroupId(x.id));
      setSelNodeId(n ? n.id : null);
      setSelEdgeId(se[0] ? se[0].id : null);
    },
    [],
  );

  const selNode = selNodeId ? model.nodes.find((n) => n.id === selNodeId) ?? null : null;
  const selEdge = selEdgeId ? model.edges.find((e) => e.id === selEdgeId) ?? null : null;

  return (
    <div className="pane visual-pane">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="system"
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onSelectionChange={onSelectionChange}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background />
        <Controls />
        {(selNode || selEdge) && (
          <Panel position="top-right">
            {selNode ? (
              <NodeInspector node={selNode} />
            ) : selEdge ? (
              <EdgeInspector edge={selEdge} />
            ) : null}
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function NodeInspector({ node }: { node: GNode }) {
  const mutate = useEditorStore((s) => s.mutate);
  const [label, setLabel] = useState(node.label);
  useEffect(() => setLabel(node.label), [node.id, node.label]);

  const commitLabel = () => {
    if (label !== node.label) mutate((m) => renameNode(m, node.id, label));
  };

  return (
    <div className="inspector">
      <div className="inspector-title">Node {node.id}</div>
      <label className="inspector-row">
        <span>Label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <label className="inspector-row">
        <span>Shape</span>
        <select
          value={node.shape}
          onChange={(e) => mutate((m) => setNodeShape(m, node.id, e.target.value as NodeShape))}
        >
          {SHAPE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button className="inspector-delete" onClick={() => mutate((m) => removeNode(m, node.id))}>
        Delete node
      </button>
    </div>
  );
}

function EdgeInspector({ edge }: { edge: GEdge }) {
  const mutate = useEditorStore((s) => s.mutate);
  const [label, setLabel] = useState(edge.label ?? "");
  useEffect(() => setLabel(edge.label ?? ""), [edge.id, edge.label]);

  const commitLabel = () => {
    if (label !== (edge.label ?? "")) mutate((m) => setEdgeLabel(m, edge.id, label));
  };

  return (
    <div className="inspector">
      <div className="inspector-title">
        Edge {edge.source} → {edge.target}
      </div>
      <label className="inspector-row">
        <span>Label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <label className="inspector-row">
        <span>Style</span>
        <select
          value={edge.kind}
          onChange={(e) => mutate((m) => setEdgeKind(m, edge.id, e.target.value as EdgeKind))}
        >
          {EDGE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button className="inspector-delete" onClick={() => mutate((m) => removeEdge(m, edge.id))}>
        Delete edge
      </button>
    </div>
  );
}
