import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback } from 'react';

import '@xyflow/react/dist/style.css';

import { DisplayNodeType } from "@/components/flow/DisplayNode";
import { JavaScriptNodeType } from "@/components/flow/JavaScriptNode";
import { LLMNodeType } from "@/components/flow/LLMNode";
import { TextNodeType } from '@/components/flow/TextNode';
import { useTheme } from "@/components/theme-provider";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IEdge, INodeConfig, INodeIO, INodeState, INodeStateRun, INodeType, runFlow } from '@/lib/flow/flow';
import { toast } from 'sonner';
// 注册节点类型
const nodeTypeList = [TextNodeType, DisplayNodeType, JavaScriptNodeType, LLMNodeType];
const nodeTypeMap = nodeTypeList.reduce<Record<string, INodeType<any, any, any, any>>>((acc, nodeType) => {
  acc[nodeType.id] = nodeType;
  return acc;
}, {});

// 注册节点UI供ReactFlow使用
const nodeTypeUIMap = nodeTypeList.reduce<Record<string, React.ComponentType<any>>>((acc, nodeType) => {
  acc[nodeType.id] = nodeType.ui;
  return acc;
}, {});

// 初始化节点和边
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, updateNodeData } = useReactFlow();
  const { isDarkMode } = useTheme();

  // 连接边
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  // 拖拽添加节点
  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();

      // 获取节点类型
      const type = event.dataTransfer.getData('application/reactflow');
      if (!nodeTypeMap[type]) return;

      // 获取节点位置
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      // 生成节点ID
      const id = String(Math.random());
      // 创建节点
      const newNode = {
        id: id,
        type: type,
        position,
        data: {
          config: nodeTypeMap[type].defaultConfig,
          state: nodeTypeMap[type].defaultState,
        },
      };
      // 添加节点
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

  // 拖拽节点时
  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // 将节点转换为运行时节点
  const toINode = (node: Node) => ({
    id: node.id,
    type: nodeTypeMap[node.type as string],
    config: node.data.config as INodeConfig,
    state: node.data.state as INodeState,
    runState: node.data.runState as INodeStateRun<INodeIO, INodeIO>,
  });

  // 将边转换为运行时边
  const toIEdge = (edge: Edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return null;
    return {
      id: edge.id,
      source: {
        node: toINode(sourceNode),
        key: edge.sourceHandle
      },
      target: {
        node: toINode(targetNode),
        key: edge.targetHandle
      }
    };
  };

  // 运行流
  const run = useCallback(() => {
    const iNodes = nodes.map((node) => toINode(node));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    runFlow(iNodes, iEdges, (nodeId, data) => updateNodeData(nodeId, { data }), (nodeId, state) => updateNodeData(nodeId, { state }), (nodeId, runState) => updateNodeData(nodeId, { runState }))
      .then(() => {
        toast.success('Flow run success');
      })
      .catch((error: Error) => {
        toast.error(error.message);
        console.error('run flow error', error);
      });
  }, [nodes, edges, updateNodeData]);

  return (
    <div className="w-full h-screen flex flex-row">
      <div className="w-96 h-auto p-4 box-border shadow-medium rounded-r-lg">
        <div className="text-xl font-bold my-2">Auto Vis Code</div>
        <Button className="w-full" onClick={run}>
          Run
        </Button>
        <Separator className="my-2" />
        <div className="text-lg font-bold">Components</div>
        <div className="text-sm text-gray-500">Drag and drop to add nodes</div>
        <Separator className="my-2" />
        <div className="space-y-2">
          {nodeTypeList.map((nodeType) => (
            <Button draggable className="w-full" key={nodeType.id}
              onDragStart={(event) => event.dataTransfer.setData('application/reactflow', nodeType.id)}>
              {nodeType.name}
            </Button>
          ))}
        </div>

      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypeUIMap}
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
