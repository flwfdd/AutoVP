/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-04-16 01:52:19
 * @Description: _(:з」∠)_
 */
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
import { useTheme } from "@/components/theme-provider";
import DisplayNode from "@/components/flow/DisplayNode";
import LLMNode from "@/components/flow/LLMNode";
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const nodeTypes = { text: TextNode, display: DisplayNode, javascript: JavaScriptNode, llm: LLMNode };

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNodes, updateNodeData } = useReactFlow();
  const { isDarkMode } = useTheme();

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
    <div className="w-full h-screen flex flex-row">
      <div className="w-96 h-auto p-4 box-border shadow-medium rounded-r-lg">
        <div className="text-lg font-bold">Components</div>
        <div className="text-sm text-gray-500">Drag and drop to add nodes</div>
        <Separator className="my-2" />
        <div className="space-y-2">
          <Button draggable className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'text')}>
            Text
          </Button>
          <Button draggable className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'display')}>
            Display
          </Button>
          <Button draggable className="w-full"
            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'javascript')}>
            JavaScript
          </Button>
          <Button draggable className="w-full"
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
        colorMode={isDarkMode ? 'dark' : 'light'}
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
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
