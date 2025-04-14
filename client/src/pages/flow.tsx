/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-02-11 12:58:32
 * @Description: _(:з」∠)_
 */
import DefaultLayout from "@/layouts/default";
import { Button, Divider } from "@heroui/react";
import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import TextNode from '@/components/flow/TextNode';
import JavaScriptNode from "@/components/flow/JavaScriptNode";
import { useTheme } from "@/hooks/use-theme";
import DisplayNode from "@/components/flow/DisplayNode";
import LLMNode from "@/components/flow/LLMNode";

const nodeTypes = { text: TextNode, display: DisplayNode, javascript: JavaScriptNode, llm: LLMNode };

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNodes, updateNodeData } = useReactFlow();
  const { isDark } = useTheme();

  // Update for nodes
  useEffect(() => {
    getNodes().forEach((node) => {
      updateNodeData(node.id, { edges, setEdges });
    });
  }, [edges, setNodes]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!(type in nodeTypes)) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const id = String(Math.random());
      const newNode = {
        id: id,
        type: type,
        position,
        data: { edges, setEdges },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, edges, setEdges]
  );

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="w-full h-full border flex flex-row">
      <div className="w-96 h-auto p-4 box-border shadow-medium rounded-r-lg">
        <div className="text-lg font-bold">Components</div>
        <div className="text-sm text-gray-500">Drag and drop to add nodes</div>
        <Divider className="my-2" />
        <div className="space-y-2">
          <Button draggable color="primary" variant="shadow" className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'text')}>
            Text
          </Button>
          <Button draggable color="primary" variant="shadow" className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'display')}>
            Display
          </Button>
          <Button draggable color="primary" variant="shadow" className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'javascript')}>
            JavaScript
          </Button>
          <Button draggable color="primary" variant="shadow" className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'llm')}>
            LLM
          </Button>
        </div>

      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        colorMode={isDark ? 'dark' : 'light'}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </div>
  );
}

export default function FlowPage() {
  return (
    <DefaultLayout>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </DefaultLayout>
  );
}
