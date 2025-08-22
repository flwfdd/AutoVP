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
import { ArrowLeft, EllipsisVertical, FileDown, FileUp, Loader, Moon, PanelLeftClose, PanelRightClose, PlayCircle, Plus, ScrollText, Sparkles, Sun, SunMoon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import '@xyflow/react/dist/style.css';

import { EndNodeType } from "@/components/flow/base/EndNode";
import { newFlowNodeType } from '@/components/flow/base/FlowNode';
import { StartNodeType } from "@/components/flow/base/StartNode";
import { BranchNodeType } from '@/components/flow/BranchNode';
import { DisplayNodeType } from "@/components/flow/DisplayNode";
import AICopilotDialog from '@/components/flow/editor/AICopilotDialog';
import MarkdownRenderer from "@/components/flow/editor/MarkdownRenderer";
import { ImageNodeType } from '@/components/flow/ImageNode';
import { JavaScriptNodeType } from "@/components/flow/JavaScriptNode";
import { LLMNodeType } from "@/components/flow/LLMNode";
import TimelineLog from "@/components/flow/log/TimelineLog";
import { PythonNodeType } from '@/components/flow/PythonNode';
import { TextNodeType } from '@/components/flow/TextNode';
import { AgentNodeType, setGlobalFlowNodeTypes } from "@/components/flow/AgentNode";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { Textarea } from "@/components/ui/textarea";
import configGlobal from "@/lib/config";
import { defaultNodeRunState, dumpDSL, IDSL, IEdge, IFlowNodeState, IFlowNodeType, INode, INodeConfig, INodeInput, INodeOutput, INodeState, INodeStateRun, INodeType, INodeWithPosition, IRunFlowStack, loadDSL, runFlow } from '@/lib/flow/flow';
import { llmStream } from '@/lib/llm';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';

// 注册节点类型
const basicNodeTypes = [TextNodeType, DisplayNodeType, ImageNodeType, JavaScriptNodeType, PythonNodeType, LLMNodeType, BranchNodeType, AgentNodeType];
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

  // 更新全局流程类型，供 Agent 节点使用
  useEffect(() => {
    const flowTypeMap = flowNodeTypes.reduce<Record<string, IFlowNodeType>>((acc, ft) => {
      acc[ft.id] = ft;
      return acc;
    }, {});
    setGlobalFlowNodeTypes(flowTypeMap);
  }, [flowNodeTypes]);
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

  // 编辑Flow时缓存的主流
  interface IMainFlow {
    nodes: INodeWithPosition[];
    edges: IEdge[];
  }
  const [mainFlow, setMainFlow] = useState<IMainFlow | null>(null);

  const [editingFlow, setEditingFlow] = useState<IFlowNodeType | null>(null);

  // 主题
  const { isDarkMode, setTheme, theme } = useTheme();

  // 文件输入
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 对话框
  const [isEditFlowDialogOpen, setIsEditFlowDialogOpen] = useState(false);
  const [editingFlowInfoType, setEditingFlowInfoType] = useState<IFlowNodeType | null>(null);
  const [editFlowInfo, setEditFlowInfo] = useState<{ name: string, description: string }>({ name: '', description: '' });

  const [isDeleteFlowDialogOpen, setIsDeleteFlowDialogOpen] = useState(false);
  const [deletingFlowType, setDeletingFlowType] = useState<IFlowNodeType | null>(null);

  const [isRunLogDialogOpen, setIsRunLogDialogOpen] = useState(false);
  const [isAICopilotDialogOpen, setIsAICopilotDialogOpen] = useState(false);

  // 连接边
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params }, eds)),
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
  const toINode = useCallback((node: Node, withRunState: boolean = false, withPosition: boolean = true) => ({
    id: node.id,
    type: nodeTypeMap[node.type as string],
    config: node.data.config,
    state: node.data.state,
    runState: withRunState ? node.data.runState : structuredClone(defaultNodeRunState),
    position: withPosition ? node.position : undefined,
  } as INodeWithPosition), [nodeTypeMap]);

  // 将边转换为运行时边
  const toIEdge = useCallback((edge: Edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return null;
    return {
      id: edge.id,
      source: {
        node: toINode(sourceNode) as INode,
        key: edge.sourceHandle
      },
      target: {
        node: toINode(targetNode) as INode,
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
    deletable: node.type.id !== 'start' && node.type.id !== 'end',
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
    const updateRunState = (nodeId: string, runState: INodeStateRun<INodeInput, INodeOutput>) => updateNodeData(nodeId, { runState: structuredClone(runState) });
    const flowStack: IRunFlowStack[] = [{
      flow: {
        id: 'main',
        name: 'Main',
        description: 'Main flow',
        nodes: iNodes,
        edges: iEdges,
      },
      startTime: Date.now(),
    }];
    runFlow({}, iNodes, iEdges, updateConfig, updateState, updateRunState, flowStack)
      .then(() => {
        toast.success('Flow run success');
      })
      .catch((error: Error) => {
        toast.error(error.message);
        console.error('Flow run error', error);
      });
  }, [nodes, edges, updateNodeData, toINode, toIEdge]);

  // 处理Flow AI Dialog
  const handleOpenAICopilotDialog = useCallback(() => {
    setIsAICopilotDialogOpen(true);
  }, []);

  const handleDSLUpdate = useCallback((dsl: IDSL) => {
    try {
      importDSL(dsl);
      toast.success('流程已成功更新');
    } catch (error: any) {
      console.error("流程更新失败", error);
      toast.error(`流程更新失败: ${error.message || '未知错误'}`);
    }
  }, [nodeTypeMap, setNodes, setEdges, setFlowNodeTypes, fromIDSLNode, fromIDSLEdge, fitView]);

  // 导入流
  const importDSL = useCallback((dsl: IDSL) => {
    const { main, flowNodeTypes } = loadDSL(dsl, nodeTypeMap, newFlowNodeType);
    setNodes(main.nodes.map(fromIDSLNode));
    setEdges(main.edges.map(fromIDSLEdge));
    setFlowNodeTypes(flowNodeTypes);
    fitView();
  }, [nodeTypeMap, setNodes, setEdges, setFlowNodeTypes, fromIDSLNode, fromIDSLEdge, fitView]);

  // 获取当前流的DSL
  const exportDSL = useCallback(() => {
    const iNodes = nodes.map((node) => toINode(node));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    return dumpDSL({
      main: {
        id: 'main',
        name: 'Main',
        description: 'Main flow',
        nodes: iNodes,
        edges: iEdges,
      },
      flowNodeTypes: Object.values(flowNodeTypes),
    });
  }, [nodes, edges, toINode, toIEdge, flowNodeTypes]);

  // 导出流
  const handleExport = useCallback(() => {
    // 导出为json
    const flowDSLJSON = JSON.stringify(exportDSL(), null, 2);
    const blob = new Blob([flowDSLJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportDSL]);

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
        const dsl: IDSL = JSON.parse(String(e.target?.result));
        importDSL(dsl);
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
  }, [importDSL]);


  const handleOpenEditFlowInfoDialog = useCallback((flowType: IFlowNodeType) => {
    setEditingFlowInfoType(flowType);
    setEditFlowInfo({ name: flowType.name, description: flowType.description });
    setIsEditFlowDialogOpen(true);
  }, [setEditingFlowInfoType, setEditFlowInfo, setIsEditFlowDialogOpen]);

  const handleSaveEditFlowInfo = useCallback(() => {
    if (!editingFlowInfoType) return;
    setFlowNodeTypes(prevTypes =>
      prevTypes.map(ft => {
        if (ft.id === editingFlowInfoType.id) {
          ft.name = editFlowInfo.name;
          ft.description = editFlowInfo.description;
        }
        return ft;
      })
    );
    setIsEditFlowDialogOpen(false);
    setEditingFlowInfoType(null);
    toast.success(`Flow info updated.`);
  }, [editingFlowInfoType, editFlowInfo, setFlowNodeTypes, setIsEditFlowDialogOpen, setEditingFlowInfoType]);

  const handleOpenDeleteFlowDialog = useCallback((flowType: IFlowNodeType) => {
    setDeletingFlowType(flowType);
    setIsDeleteFlowDialogOpen(true);
  }, [setDeletingFlowType, setIsDeleteFlowDialogOpen]);

  const handleConfirmDeleteFlow = useCallback(() => {
    if (!deletingFlowType) return;
    setFlowNodeTypes(prevTypes =>
      prevTypes.filter(ft => ft.id !== deletingFlowType.id)
    );
    // TODO: Also remove nodes of this type from the canvas? Optional, might be complex.
    // setNodes(nds => nds.filter(n => n.type !== deletingFlowType.id));
    setIsDeleteFlowDialogOpen(false);
    toast.warning(`Flow "${deletingFlowType.name}" deleted.`);
    setDeletingFlowType(null);
  }, [deletingFlowType, setFlowNodeTypes, setIsDeleteFlowDialogOpen, setDeletingFlowType]);

  const highlightNode = useCallback((nodeId: string) => {
    // 关闭Log Dialog
    setIsRunLogDialogOpen(false);
    // 设置高亮
    updateNodeData(nodeId, (node) => ({
      state: {
        ...(node.data.state as INodeState),
        highlight: true,
      },
    }));
    // 5秒后取消高亮
    setTimeout(() => {
      updateNodeData(nodeId, (node) => ({
        state: {
          ...(node.data.state as INodeState),
          highlight: false,
        },
      }));
    }, 5000);
  }, [setIsRunLogDialogOpen, updateNodeData]);

  const saveEditingFlow = useCallback(() => {
    if (!editingFlow) return;
    setFlowNodeTypes(prevTypes => prevTypes.map(ft => {
      if (ft.id === editingFlow.id) {
        ft.nodes = nodes.map((node) => toINode(node));
        ft.edges = edges.map(toIEdge).filter((edge): edge is IEdge => edge !== null);
      }
      return ft;
    }))
  }, [editingFlow, setFlowNodeTypes, toINode, toIEdge]);

  const handleEditFlow = useCallback((flowType: IFlowNodeType) => {
    setIsEditFlowDialogOpen(false);
    if (editingFlow) {
      // 如果正在编辑其他Flow，则先保存
      saveEditingFlow();
    } else {
      // 否则保存主Flow
      setMainFlow({
        nodes: nodes.map((node) => toINode(node)),
        edges: edges.map(toIEdge).filter((edge): edge is IEdge => edge !== null),
      })
    }
    setEditingFlow(flowType);
    setNodes(flowType.nodes.map(fromIDSLNode));
    setEdges(flowType.edges.map(fromIDSLEdge));
  }, [setIsEditFlowDialogOpen, nodes, setNodes, edges, setEdges, setMainFlow, fromIDSLNode, fromIDSLEdge, toINode, toIEdge, editingFlow, setEditingFlow, saveEditingFlow])

  const handleBackToMainFlow = useCallback(() => {
    if (!editingFlow) return;
    saveEditingFlow();
    setEditingFlow(null);
    setNodes(mainFlow?.nodes.map(fromIDSLNode) ?? []);
    setEdges(mainFlow?.edges.map(fromIDSLEdge) ?? []);
  }, [editingFlow, saveEditingFlow, setEditingFlow, setNodes, setEdges, mainFlow, fromIDSLNode, fromIDSLEdge]);

  // 将当前Flow注册为类型
  const handleRegisterFlow = useCallback(() => {
    const iNodes = nodes.map((node) => toINode(node));
    const iEdges = edges.map((edge) => toIEdge(edge)).filter((edge): edge is IEdge => edge !== null);
    // 保证flow节点的id由flow_开头
    const newId = 'flow_' + generateId();
    const newName = `Flow ${flowNodeTypes.length + 1}`;
    const newDescription = `Custom flow type created on ${new Date().toLocaleString()}`;
    const flowNodeType = newFlowNodeType(newId, newName, newDescription, iNodes, iEdges);
    setFlowNodeTypes(prevTypes => [...prevTypes, flowNodeType]);
    toast.info(`New flow type "${newName}" added.`);
  }, [flowNodeTypes, nodes, edges, toINode, toIEdge]);


  return (
    <div className="w-full h-screen flex flex-row">
      <div className="flex flex-col min-w-64 max-w-64 h-auto shadow-lg rounded-r-lg">
        <div className='p-4 pb-0'>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xl font-bold">Auto Vis Code</div>
            <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}>
              {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <SunMoon />}
            </Button>
          </div>
          <div className='space-y-2'>
            <Button variant="outline" className="w-full" onClick={handleRun}>
              <PlayCircle />
              Run
            </Button>
            <div className="flex flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={handleImportClick}>
                <FileDown />
                Import
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleExport}>
                <FileUp />
                Export
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setIsRunLogDialogOpen(true) }}>
              <ScrollText />
              Run Logs
            </Button>
            <Button variant="outline" className="w-full" onClick={handleOpenAICopilotDialog}>
              <Sparkles />
              AI Copilot
            </Button>
            {editingFlow ? (
              <Button className="w-full" onClick={handleBackToMainFlow}>
                <ArrowLeft />
                Back to Main Flow
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleRegisterFlow}>
                <Plus />
                Register Flow
              </Button>
            )}
          </div>

          <Separator className="mt-2" />
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex flex-col">
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
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleOpenEditFlowInfoDialog(nodeType)}>Edit Info</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditFlow(nodeType)}>Edit Flow</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenDeleteFlowDialog(nodeType)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
            </div>
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
        defaultEdgeOptions={{ style: { strokeWidth: 3 }, animated: true }}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />

      <Dialog open={isEditFlowDialogOpen} onOpenChange={setIsEditFlowDialogOpen}>
        <DialogContent className="max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Flow</DialogTitle>
            <DialogDescription>
              ID: {editingFlowInfoType?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flow-name" className="text-right">
                Name
              </Label>
              <Input
                id="flow-name"
                value={editFlowInfo.name}
                onChange={(e) => setEditFlowInfo({ ...editFlowInfo, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flow-description" className="text-right">
                Description
              </Label>
              <Input
                id="flow-description"
                value={editFlowInfo.description}
                onChange={(e) => setEditFlowInfo({ ...editFlowInfo, description: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsEditFlowDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSaveEditFlowInfo}>Save</Button>
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

      <LogDialog
        isLogDialogOpen={isRunLogDialogOpen}
        setIsLogDialogOpen={setIsRunLogDialogOpen}
        nodes={nodes.map(node => toINode(node, true, false))}
        highlightNode={highlightNode}
      ></LogDialog>

      <AICopilotDialog
        isOpen={isAICopilotDialogOpen}
        onClose={() => setIsAICopilotDialogOpen(false)}
        DSL={exportDSL()}
        onUpdateDSL={handleDSLUpdate}
        nodeTypeMap={nodeTypeMap}
        newFlowNodeType={newFlowNodeType}
      />

    </div >
  );
}

interface LogDialogProps {
  isLogDialogOpen: boolean
  setIsLogDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  nodes: INode[]
  highlightNode: (nodeId: string) => void
}

function LogDialog({ isLogDialogOpen, setIsLogDialogOpen, nodes, highlightNode }: LogDialogProps) {
  const [isShowAiPanel, setIsShowAiPanel] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [responseRef, setResponseRef] = useState<HTMLDivElement | null>(null);

  // 自动滚动到响应区域底部
  useEffect(() => {
    if (responseRef && isAiLoading) {
      responseRef.scrollTop = responseRef.scrollHeight;
    }
  }, [aiResponse, responseRef, isAiLoading]);

  const handleAiLogAnalysis = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    setAiResponse('');

    // 定义节点日志数据类型
    interface NodeLogData {
      id: string;
      type: string;
      typeName: string;
      name: string;
      runState: INodeStateRun<any, any>;
      children?: NodeLogData[];
    }

    // 获取完整的日志数据，包括嵌套的Flow节点日志
    const extractFullLogData = (node: INode): NodeLogData => {
      const nodeData: NodeLogData = {
        id: node.id,
        type: node.type.id,
        typeName: node.type.name,
        name: node.config.name,
        runState: node.runState,
      };

      // 对过长的输入输出进行截断
      const MAX_LOG_IO_LENGTH = 1000;
      const truncate = (value: any) => {
        let text = JSON.stringify(value);
        if (text.length > MAX_LOG_IO_LENGTH) {
          return text.slice(0, MAX_LOG_IO_LENGTH) + '...[truncated]';
        }
        return text;
      }
      nodeData.runState.input = truncate(nodeData.runState.input);
      nodeData.runState.output = truncate(nodeData.runState.output);
      nodeData.runState.logs = nodeData.runState.logs.map(log => ({
        ...log,
        input: truncate(log.input),
        output: truncate(log.output),
      }));

      // 如果是Flow节点，递归获取其子节点日志
      if (node.type.id.startsWith('flow_')) {
        const state = node.state as IFlowNodeState;
        if (state.runNodes && state.runNodes.length > 0) {
          nodeData.children = state.runNodes.map(childNode => extractFullLogData(childNode));
        }
      }

      return nodeData;
    };

    const fullLogData = JSON.stringify(nodes.map(node => extractFullLogData(node)), null, 2);

    const systemPrompt = `You are an expert log analysis assistant.
The user will provide you with logs from a flow execution and a question for analysis.
Analyze the logs based on the user's question and provide insights.
Think step by step and explain your analysis, You need to answer in the language of the user's question.

Current Logs:
\`\`\`json
${fullLogData}
\`\`\`
`;

    try {
      let fullResponse = '';

      const stream = llmStream(configGlobal.codeEditorModel, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ]);

      for await (const chunk of stream) {
        fullResponse += chunk;
        setAiResponse(fullResponse);
      }

      if (!fullResponse) {
        toast.error('AI returned an empty response.');
        setAiResponse('AI returned an empty response.');
      }
    } catch (error: any) {
      toast.error('Error during AI log analysis: ' + error.message);
      setAiResponse('Error during AI log analysis: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
      <DialogContent className="min-w-full min-h-full max-w-full max-h-full flex flex-col p-4 rounded-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>Run Logs</DialogTitle>
          <DialogDescription>
            <div className="flex justify-between items-center">
              Timeline logs of recent flow run. You can also use the AI assistant to analyze logs.
              <Button variant="ghost" size="icon" onClick={() => setIsShowAiPanel(!isShowAiPanel)}>
                {isShowAiPanel ? <PanelRightClose /> : <PanelLeftClose />}
              </Button>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-row gap-4 overflow-hidden min-h-0">
          <div className="flex-1 h-full overflow-y-auto">
            <TimelineLog nodes={nodes} highlightNode={highlightNode} />
          </div>
          {isShowAiPanel && (
            <div className="w-1/3 flex flex-col gap-2">
              <div className="font-medium text-center">AI Log Analysis</div>
              <div
                ref={setResponseRef}
                className="flex-1 min-h-0 overflow-auto border rounded-md px-4 text-sm"
              >
                {aiResponse ? (
                  <MarkdownRenderer content={aiResponse} />
                ) : (
                  <div className="text-center text-muted-foreground">Ask AI to analyze logs...</div>
                )}
              </div>
              <Textarea
                placeholder={`Ask AI to analyze logs... (e.g., "Which nodes failed?", "Summarize the run.")`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none text-sm h-24 shrink-0"
                disabled={isAiLoading}
              />
              <Button type="button" onClick={handleAiLogAnalysis} disabled={isAiLoading || !prompt.trim()}>
                {isAiLoading ? (
                  <>
                    <Loader className="animate-spin" /> Analyzing...
                  </>
                ) : (
                  `Analyze Logs`
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function FlowPage() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
