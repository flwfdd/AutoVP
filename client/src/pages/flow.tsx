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
import { Moon, Pencil, Sun, SunMoon, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from 'react';

import '@xyflow/react/dist/style.css';

import { EndNodeType } from "@/components/flow/base/EndNode";
import { StartNodeType } from "@/components/flow/base/StartNode";
import { BranchNodeType } from '@/components/flow/BranchNode';
import { DisplayNodeType } from "@/components/flow/DisplayNode";
import { newFlowNodeType } from '@/components/flow/FlowNode';
import { JavaScriptNodeType } from "@/components/flow/JavaScriptNode";
import { LLMNodeType } from "@/components/flow/LLMNode";
import { TextNodeType } from '@/components/flow/TextNode';
import { useTheme } from "@/components/theme-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { defaultNodeRunState, dumpDSL, IEdge, IFlowDSL, IFlowNodeType, INodeConfig, INodeIO, INodeState, INodeStateRun, INodeType, INodeWithPosition, loadDSL, runFlow } from '@/lib/flow/flow';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';

// 注册节点类型
const basicNodeTypes = [TextNodeType, DisplayNodeType, JavaScriptNodeType, LLMNodeType, BranchNodeType];
const specialNodeTypes = [StartNodeType, EndNodeType];

// 初始化节点和边
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 50, y: 50 },
    data: {
      config: StartNodeType.defaultConfig,
      state: StartNodeType.defaultState,
      runState: defaultNodeRunState,
    },
    deletable: false,
  },
  {
    id: 'end',
    type: 'end',
    position: { x: 400, y: 200 },
    data: {
      config: EndNodeType.defaultConfig,
      state: EndNodeType.defaultState,
      runState: defaultNodeRunState,
    },
    deletable: false,
  },
];
const initialEdges: Edge[] = [];

const initialFlowNodeTypes: IFlowNodeType[] = [];

function Flow() {
  // 注册节点类型
  const [flowNodeTypes, setFlowNodeTypes] = useState(initialFlowNodeTypes);
  const allNodeTypes = useMemo(() => [...basicNodeTypes, ...specialNodeTypes, ...flowNodeTypes], [flowNodeTypes]);
  const nodeTypeMap = useMemo(() => allNodeTypes.reduce<Record<string, INodeType<any, any, any, any>>>((acc, nodeType) => {
    acc[nodeType.id] = nodeType;
    return acc;
  }, {}), [allNodeTypes]);

  // 注册节点UI供ReactFlow使用
  const nodeTypeUIMap = useMemo(() => allNodeTypes.reduce<Record<string, React.ComponentType<any>>>((acc, nodeType) => {
    acc[nodeType.id] = nodeType.ui;
    return acc;
  }, {}), [allNodeTypes]);


  // ReactFlow
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, updateNodeData, fitView } = useReactFlow();

  // 主题
  const { isDarkMode, setTheme, theme } = useTheme();

  // 文件输入
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 对话框
  const [isEditFlowDialogOpen, setIsEditFlowDialogOpen] = useState(false);
  const [editingFlowType, setEditingFlowType] = useState<IFlowNodeType | null>(null);
  const [editFlowName, setEditFlowName] = useState('');
  const [editFlowDescription, setEditFlowDescription] = useState('');

  const [isDeleteFlowDialogOpen, setIsDeleteFlowDialogOpen] = useState(false);
  const [deletingFlowType, setDeletingFlowType] = useState<IFlowNodeType | null>(null);

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
    [nodeTypeMap, screenToFlowPosition, setNodes]
  );

  // 拖拽节点时
  const onDragOver = (event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // 将节点转换为运行时节点
  const toINode = useCallback((node: Node) => ({
    id: node.id,
    type: nodeTypeMap[node.type as string],
    config: node.data.config as INodeConfig,
    state: node.data.state as INodeState,
    runState: node.data.runState as INodeStateRun<INodeIO, INodeIO>,
  }), [nodeTypeMap]);

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

  const fromIDSLNode = (node: INodeWithPosition): Node => ({
    id: node.id,
    type: node.type.id,
    position: node.position,
    data: {
      config: node.config,
      state: node.state,
      runState: node.runState,
    },
  });

  const fromIDSLEdge = (edge: IEdge): Edge => ({
    id: edge.id,
    source: edge.source.node.id,
    target: edge.target.node.id,
    sourceHandle: edge.source.key,
    targetHandle: edge.target.key,
  });

  // 运行流
  const handleRun = useCallback(() => {
    const iNodes = nodes.map((node) => toINode(node));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    const updateConfig = (nodeId: string, config: INodeConfig) => updateNodeData(nodeId, { config: structuredClone(config) });
    const updateState = (nodeId: string, state: INodeState) => updateNodeData(nodeId, { state: structuredClone(state) });
    const updateRunState = (nodeId: string, runState: INodeStateRun<INodeIO, INodeIO>) => updateNodeData(nodeId, { runState: structuredClone(runState) });

    runFlow({}, iNodes, iEdges, updateConfig, updateState, updateRunState)
      .then(() => {
        toast.success('Flow run success');
      })
      .catch((error: Error) => {
        toast.error(error.message);
        console.error('Flow run error', error);
      });
  }, [nodes, edges, updateNodeData, toINode, toIEdge]);

  // 导出流
  const handleExport = useCallback(() => {
    const iNodes = nodes.map((node) => ({ ...toINode(node), position: node.position }));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    const flowDSL = dumpDSL({
      main: {
        id: 'main',
        name: 'Main',
        description: 'Main flow',
        nodes: iNodes,
        edges: iEdges,
      },
      flowNodeTypes: Object.values(flowNodeTypes),
    });
    // 导出为json
    const flowDSLJSON = JSON.stringify(flowDSL, null, 2);
    const blob = new Blob([flowDSLJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, toINode, toIEdge, flowNodeTypes]);

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
        const { main, flowNodeTypes } = loadDSL(dsl, nodeTypeMap, newFlowNodeType);

        // 设置节点和边
        setNodes(main.nodes.map(fromIDSLNode));
        setEdges(main.edges.map(fromIDSLEdge));
        setFlowNodeTypes(flowNodeTypes);
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

  // --- Dialog Handlers ---
  const handleOpenEditFlowDialog = useCallback((flowType: IFlowNodeType) => {
    setEditingFlowType(flowType);
    setEditFlowName(flowType.name);
    setEditFlowDescription(flowType.description);
    setIsEditFlowDialogOpen(true);
  }, []);

  const handleSaveEditFlow = useCallback(() => {
    if (!editingFlowType) return;
    setFlowNodeTypes(prevTypes =>
      prevTypes.map(ft => {
        if (ft.id === editingFlowType.id) {
          ft.name = editFlowName;
          ft.description = editFlowDescription;
        }
        return ft;
      })
    );
    setIsEditFlowDialogOpen(false);
    setEditingFlowType(null);
    toast.success(`Flow updated.`);
  }, [editingFlowType, editFlowName, editFlowDescription]);

  const handleOpenDeleteFlowDialog = useCallback((flowType: IFlowNodeType) => {
    setDeletingFlowType(flowType);
    setIsDeleteFlowDialogOpen(true);
  }, []);

  const handleConfirmDeleteFlow = useCallback(() => {
    if (!deletingFlowType) return;
    setFlowNodeTypes(prevTypes =>
      prevTypes.filter(ft => ft.id !== deletingFlowType.id)
    );
    // Also remove nodes of this type from the canvas? Optional, might be complex.
    // setNodes(nds => nds.filter(n => n.type !== deletingFlowType.id));
    setIsDeleteFlowDialogOpen(false);
    toast.warning(`Flow type "${deletingFlowType.name}" deleted.`);
    setDeletingFlowType(null);
  }, [deletingFlowType]);
  // --- End Dialog Handlers ---

  // 将当前Flow注册为类型
  const handleAddFlow = useCallback(() => {
    const iNodes = nodes.map((node) => ({ ...toINode(node), position: node.position }));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    // Provide a unique ID, name, and description for the new flow type
    const newId = 'flow_' + generateId();
    const newName = `Flow ${flowNodeTypes.length + 1}`;
    const newDescription = `Custom flow type created on ${new Date().toLocaleString()}`;
    const flowNodeType = newFlowNodeType(newId, newName, newDescription, iNodes, iEdges);
    setFlowNodeTypes(prevTypes => [...prevTypes, flowNodeType]);
    toast.info(`New flow type "${newName}" added.`);
  }, [flowNodeTypes, nodes, edges, toINode, toIEdge]); // Added flowNodeTypes to dependencies


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
      <div className="flex flex-col min-w-64 max-w-64 h-auto p-4 shadow-lg rounded-r-lg">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xl font-bold">Auto Vis Code</div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}>
            {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <SunMoon />}
          </Button>
        </div>
        <div className='space-y-2'>
          <Button className="w-full" onClick={handleRun}>
            Run
          </Button>
          <Button className="w-full" onClick={handleExport}>
            Export
          </Button>
          <Button className="w-full" onClick={handleImportClick}>
            Import
          </Button>
          <Button className="w-full" onClick={() => handleAddFlow()}>
            Add Flow
          </Button>
        </div>

        <Separator className="my-2" />

        <div className="flex flex-col overflow-y-auto">
          <div className="text-lg font-bold">Nodes</div>
          <div className="text-sm text-muted-foreground">Drag and drop to add nodes</div>
          <Separator className="my-2" />
          <div className="space-y-2">
            {basicNodeTypes
              .map((nodeType) => (
                <Button draggable className="w-full" key={nodeType.id}
                  onDragStart={(event) => event.dataTransfer.setData('application/reactflow', nodeType.id)}>
                  {nodeType.name}
                </Button>
              ))}
          </div>

          <Separator className="my-2" />

          <div className="text-lg font-bold">Flows</div>
          <div className="text-sm text-muted-foreground">Drag and drop to add flows</div>
          <Separator className="my-2" />
          <div className="space-y-2">
            {flowNodeTypes
              .map((nodeType) => (
                <div key={nodeType.id} className="flex items-center gap-1">
                  <Button
                    draggable
                    className="flex-1 min-w-0"
                    onDragStart={(event) => event.dataTransfer.setData('application/reactflow', nodeType.id)}
                  >
                    <span className="truncate">{nodeType.name}</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEditFlowDialog(nodeType)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteFlowDialog(nodeType)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
          </div>
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

      <Dialog open={isEditFlowDialogOpen} onOpenChange={setIsEditFlowDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Flow</DialogTitle>
            <DialogDescription>
              ID: {editingFlowType?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flow-name" className="text-right">
                Name
              </Label>
              <Input
                id="flow-name"
                value={editFlowName}
                onChange={(e) => setEditFlowName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flow-description" className="text-right">
                Description
              </Label>
              <Input
                id="flow-description"
                value={editFlowDescription}
                onChange={(e) => setEditFlowDescription(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsEditFlowDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSaveEditFlow}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteFlowDialogOpen} onOpenChange={setIsDeleteFlowDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the flow type
              <span className="font-semibold"> "{deletingFlowType?.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingFlowType(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteFlow}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
