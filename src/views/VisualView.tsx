// Visual editor: React Flow bound to the canonical model. Editing gestures
// (drag, connect, delete, double-click rename) are committed to the model via
// store.mutate(), which re-emits the code text. Code-side edits flow back in
// through a resync effect keyed on the model identity.

import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { connect, moveNode, removeEdge, removeNode, renameNode } from "../flow/flowToModel";
import { modelToFlow, type FlowEdge, type ShapeNode as ShapeNodeType } from "../flow/modelToFlow";
import { useEditorStore } from "../model/store";
import { ShapeNode } from "./nodes/ShapeNode";

const nodeTypes = { shape: ShapeNode };

export function VisualView() {
  const model = useEditorStore((s) => s.model);
  const mutate = useEditorStore((s) => s.mutate);

  const flow = useMemo(() => modelToFlow(model), [model]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ShapeNodeType>(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(flow.edges);

  // Resync local React Flow state when the model changes from the code side.
  useEffect(() => {
    const { nodes: n, edges: e } = modelToFlow(model);
    setNodes(n);
    setEdges(e);
  }, [model, setNodes, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<ShapeNodeType>[]) => {
      onNodesChange(changes);
      for (const c of changes) {
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
      if (params.source && params.target) {
        mutate((m) => connect(m, params.source!, params.target!));
      }
    },
    [setEdges, mutate],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: ShapeNodeType) => {
      const next = window.prompt("Rename node", node.data.label);
      if (next != null) mutate((m) => renameNode(m, node.id, next));
    },
    [mutate],
  );

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
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
