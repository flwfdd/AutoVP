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
import { Moon, Sun, SunMoon } from "lucide-react";
import { useCallback, useRef } from 'react';

import '@xyflow/react/dist/style.css';

import { BranchNodeType } from '@/components/flow/BranchNode';
import { DisplayNodeType } from "@/components/flow/DisplayNode";
import { JavaScriptNodeType } from "@/components/flow/JavaScriptNode";
import { LLMNodeType } from "@/components/flow/LLMNode";
import { TextNodeType } from '@/components/flow/TextNode';
import { useTheme } from "@/components/theme-provider";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { defaultNodeRunState, dumpFlow, IEdge, IFlowDSL, INodeConfig, INodeIO, INodeState, INodeStateRun, INodeType, INodeWithPosition, loadFlow, runFlow } from '@/lib/flow/flow';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
// 注册节点类型
const nodeTypeList = [TextNodeType, DisplayNodeType, JavaScriptNodeType, LLMNodeType, BranchNodeType];
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
  const { screenToFlowPosition, updateNodeData, fitView } = useReactFlow();
  const { isDarkMode, setTheme, theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const id = generateId();
      // 创建节点
      const newNode = {
        id: id,
        type: type,
        position,
        data: {
          config: nodeTypeMap[type].defaultConfig,
          state: nodeTypeMap[type].defaultState,
          runState: defaultNodeRunState,
        },
      };
      // 添加节点
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  // 拖拽节点时
  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // 将节点转换为运行时节点
  const toINode = useCallback((node: Node) => ({
    id: node.id,
    type: nodeTypeMap[node.type as string],
    config: node.data.config as INodeConfig,
    state: node.data.state as INodeState,
    runState: node.data.runState as INodeStateRun<INodeIO, INodeIO>,
  }), []);

  // 将边转换为运行时边
  const toIEdge = useCallback((edge: Edge) => {
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
  }, [nodes, toINode]);

  const fromIDSLNode = useCallback((node: INodeWithPosition): Node => ({
    id: node.id,
    type: node.type.id,
    position: node.position,
    data: {
      config: node.config,
      state: node.state,
      runState: node.runState,
    },
  }), []);

  const fromIDSLEdge = useCallback((edge: IEdge): Edge => ({
    id: edge.id,
    source: edge.source.node.id,
    target: edge.target.node.id,
    sourceHandle: edge.source.key,
    targetHandle: edge.target.key,
  }), []);

  // 运行流
  const run = useCallback(() => {
    const iNodes = nodes.map((node) => toINode(node));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    const updateConfig = (nodeId: string, config: Partial<INodeConfig>) => updateNodeData(nodeId, { config });
    const updateState = (nodeId: string, state: Partial<INodeState>) => updateNodeData(nodeId, { state });
    const updateRunState = (nodeId: string, runState: Partial<INodeStateRun<INodeIO, INodeIO>>) => updateNodeData(nodeId, { runState });

    runFlow(iNodes, iEdges, updateConfig, updateState, updateRunState)
      .then(() => {
        toast.success('Flow run success');
      })
      .catch((error: Error) => {
        toast.error(error.message);
        console.error('Flow run error', error);
      });
  }, [nodes, edges, updateNodeData, toINode, toIEdge]);

  // 导出流
  const exportFlow = useCallback(() => {
    const iNodes = nodes.map((node) => ({ ...toINode(node), position: node.position }));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    const flowDSL = dumpFlow(iNodes, iEdges);
    // 导出为json
    const flowDSLJSON = JSON.stringify(flowDSL, null, 2);
    const blob = new Blob([flowDSLJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, toINode, toIEdge]);

  // 打开文件选择器
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理导入文件
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dsl: IFlowDSL = JSON.parse(String(e.target?.result));
        const { nodes: loadedNodes, edges: loadedEdges } = loadFlow(dsl, nodeTypeMap);

        // 设置节点和边
        setNodes(loadedNodes.map(fromIDSLNode));
        setEdges(loadedEdges.map(fromIDSLEdge));
        fitView();

        toast.success('Flow import success!');
      } catch (error: any) {
        console.error("Flow import error", error);
        toast.error(`Flow import error: ${error.message || 'Invalid JSON format'}`);
      } finally {
        // 重置文件输入值以允许重新选择相同的文件
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.onerror = () => {
      toast.error('File read error.');
      // 重置文件输入值
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, fitView]);

  return (
    <div className="w-full h-screen flex flex-row">
      {/* 隐藏文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />
      <div className="w-96 h-auto p-4 box-border shadow-medium rounded-r-lg flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xl font-bold">Auto Vis Code</div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}>
            {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <SunMoon />}
          </Button>
        </div>
        <div className='space-y-2'>
          <Button className="w-full" onClick={run}>
            Run
          </Button>
          <Button className="w-full" onClick={exportFlow}>
            Export
          </Button>
          <Button className="w-full" onClick={handleImportClick}>
            Import
          </Button>
        </div>
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
        <div className="mt-auto"></div>
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
