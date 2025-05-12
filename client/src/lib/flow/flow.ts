import { NodeProps, Position, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { z } from 'zod';

// 节点输入输出基础类型
export const BaseNodeInputSchema = z.object({});
export type IBaseNodeInput = z.infer<typeof BaseNodeInputSchema>;
export const NodeInputSchema = BaseNodeInputSchema.catchall(z.any());
export type INodeInput = z.infer<typeof NodeInputSchema>;

export const BaseNodeOutputSchema = z.object({});
export type IBaseNodeOutput = z.infer<typeof BaseNodeOutputSchema>;
export const NodeOutputSchema = BaseNodeOutputSchema.catchall(z.any());
export type INodeOutput = z.infer<typeof NodeOutputSchema>;


// 节点持久化数据抽象
export const BaseNodeConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
});
export type IBaseNodeConfig = z.infer<typeof BaseNodeConfigSchema>;
export const NodeConfigSchema = BaseNodeConfigSchema.catchall(z.any());
export type INodeConfig = z.infer<typeof NodeConfigSchema>;

// 节点非持久化状态抽象
export interface IBaseNodeState {
  highlight: boolean;
}
export interface INodeState extends IBaseNodeState {
  [key: string]: any;
}

// 节点运行记录
export interface INodeRunLog<I extends IBaseNodeInput, O extends IBaseNodeOutput> {
  startMs: number;
  endMs?: number;
  input: I;
  output?: O;
  error?: any;
}

// 节点运行时状态抽象
export interface INodeStateRun<I extends IBaseNodeInput, O extends IBaseNodeOutput> {
  input: I;
  output: O;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: any;
  logs: INodeRunLog<I, O>[];
}
export const defaultNodeRunState: INodeStateRun<IBaseNodeInput, IBaseNodeOutput> = {
  status: 'idle',
  input: {},
  output: {},
  error: null,
  logs: [],
}

// 连接点配置
interface HandleConfig {
  // 标识输入输出数据map的key
  id: string;
  type: 'source' | 'target';
  position: Position;
  limit?: number;
  label?: React.ReactNode;
  className?: string;
}

// 节点 UI Props 抽象
export interface INodeProps<C extends IBaseNodeConfig, S extends IBaseNodeState, I extends IBaseNodeInput, O extends IBaseNodeOutput> extends NodeProps {
  nodeType: INodeType<C, S, I, O>;
  handles?: HandleConfig[];
  children?: React.ReactNode;
  data: { config: C, state: S, runState?: INodeStateRun<I, O> };
}

// 节点运行上下文
export interface INodeContext<C extends IBaseNodeConfig, S extends IBaseNodeState, I extends IBaseNodeInput> {
  config: C;
  updateConfig: (config: C) => void;
  state: S;
  updateState: (state: S) => void;
  input: I;
  flowStack: IRunFlowStack[];
}

// 节点运行日志格式化
export type INodeLogFormatter<C extends IBaseNodeConfig, S extends IBaseNodeState, I extends IBaseNodeInput, O extends IBaseNodeOutput> = (config: C, state: S, log: INodeRunLog<I, O>) => { input: string, output: string, error: string };

// 节点类型抽象
export interface INodeType<C extends IBaseNodeConfig, S extends IBaseNodeState, I extends IBaseNodeInput, O extends IBaseNodeOutput> {
  configSchema: z.ZodSchema<C>;
  inputSchema: z.ZodSchema<I>;
  outputSchema: z.ZodSchema<O>;
  id: string;
  name: string;
  description: string;
  defaultConfig: C;
  defaultState: S;
  logFormatter?: INodeLogFormatter<C, S, I, O>;
  ui: React.ComponentType<INodeProps<C, S, I, O>>;
  run: (context: INodeContext<C, S, I>) => Promise<O>;
}

// 节点抽象
export interface INode {
  id: string;
  type: INodeType<INodeConfig, INodeState, INodeInput, INodeOutput>;
  config: INodeConfig;
  state: INodeState;
  runState: INodeStateRun<INodeInput, INodeOutput>;
}

// 连接点抽象
export interface IHandle {
  node: INode;
  key: string;
}

// 边抽象
export interface IEdge {
  id: string;
  source: IHandle;
  target: IHandle;
  value?: any;
}

// 带位置的节点
export interface INodeWithPosition extends INode {
  position: { x: number, y: number };
}

// 单个Flow抽象
export interface IFlow {
  id: string;
  name: string;
  description: string;
  nodes: INodeWithPosition[];
  edges: IEdge[];
}


// 运行节点
interface INodeRun extends INode {
  inputEdges: IEdge[];
  outputEdges: IEdge[];
  waitNum: number;
}

// 运行边
interface IEdgeRun extends IEdge {
  value: any;
}

// 运行流栈
export interface IRunFlowStack {
  flow: IFlow;
  startTime: number;
}

// 运行流
export async function runFlow(
  flowInput: INodeInput,
  nodeList: INode[],
  edgeList: IEdge[],
  updateNodeConfig: (nodeId: string, config: INodeConfig) => void,
  updateNodeState: (nodeId: string, state: INodeState) => void,
  updateNodeRunState: (nodeId: string, runState: INodeStateRun<INodeInput, INodeOutput>) => void,
  flowStack: IRunFlowStack[]
) {
  const startTime = flowStack.length ? flowStack[0].startTime : Date.now();
  let startNodeId = '';
  let endNodeId = '';
  // 节点列表
  const nodes = nodeList.reduce<Record<string, INodeRun>>((acc, node) => {
    if (node.type.id === 'start') {
      startNodeId = node.id;
    }
    if (node.type.id === 'end') {
      endNodeId = node.id;
    }
    acc[node.id] = {
      ...node,
      inputEdges: edgeList.filter((edge) => edge.target.node.id === node.id),
      outputEdges: edgeList.filter((edge) => edge.source.node.id === node.id),
      waitNum: edgeList.filter((edge) => edge.target.node.id === node.id).length,
    }
    return acc;
  }, {});

  if (!startNodeId || !endNodeId) {
    throw new Error('Start or end node not found');
  }

  // 边列表
  const edges = edgeList.reduce<Record<string, IEdgeRun>>((acc, edge) => {
    acc[edge.id] = {
      ...edge,
      value: {},
    }
    return acc;
  }, {});

  // 重置所有节点状态
  Object.values(nodes).forEach((node) => {
    node.runState = structuredClone(defaultNodeRunState);
    updateNodeRunState(node.id, node.runState);
  });

  // 初始化可执行节点列表为入度为0的节点
  let readyNodes = Object.values(nodes).filter((node) => node.inputEdges.length === 0);
  while (1) {
    if (readyNodes.length === 0) {
      break;
    }
    let newReadyNodes: INodeRun[] = [];
    for (const node of readyNodes) {
      // 设置节点状态为运行中
      node.runState.status = 'running';
      let log = {
        startMs: Date.now() - startTime,
        input: {},
        output: {},
        error: null,
      } as INodeRunLog<INodeInput, INodeOutput>;
      try {
        // 从边获取输入
        const input = node.inputEdges.reduce<Record<string, any>>((acc, edge) => {
          acc[edge.target.key] = edges[edge.id].value;
          return acc;
        }, {});
        node.runState.input = input;
        // 运行前callback
        console.log('input', node.config.name, node.id, input);
        log.input = input;
        // 更新节点状态
        updateNodeRunState(node.id, node.runState);
        // 执行节点
        const output = await node.type.run({
          config: node.config,
          updateConfig: (config: INodeConfig) => {
            updateNodeConfig(node.id, config);
          },
          state: node.state,
          updateState: (state: INodeState) => {
            updateNodeState(node.id, state);
          },
          // 特殊处理开始节点
          input: node.id === startNodeId ? flowInput : node.runState.input,
          flowStack: flowStack,
        });
        // 运行成功callback
        console.log('output', node.config.name, node.id, output);
        log.output = output;
        // 将输出写入边
        node.outputEdges.forEach((edge) => {
          // 输出为undefined表示不走这条边
          if (output[edge.source.key] === undefined) {
            return;
          }
          edges[edge.id].value = output[edge.source.key];
          // 更新目标节点等待数
          const targetNode = nodes[edge.target.node.id];
          targetNode.waitNum--;
          if (targetNode.waitNum === 0 && !newReadyNodes.includes(targetNode)) {
            newReadyNodes.push(targetNode);
          }
        });
        // 设置节点状态为成功
        node.runState.status = 'success';
        node.runState.output = output;
      } catch (e: any) {
        // 设置节点状态为失败
        node.runState.status = 'error';
        node.runState.error = e;
        // 运行失败callback
        console.error('error', node.config.name, node.id, e);
        log.error = e.message;
      } finally {
        // 运行后callback
        log.endMs = Date.now() - startTime;
        node.runState.logs.push(log);
        updateNodeRunState(node.id, node.runState);
        // 如果节点运行失败，则抛出错误
        if (node.runState.status === 'error') {
          throw new Error(`Error in ${node.config.name}: ${node.runState.error.message || node.runState.error}`);
        }
      }
    }
    readyNodes = newReadyNodes;
  }

  if (nodes[endNodeId].runState.status !== 'success') {
    throw new Error('End node is not success');
  }

  return nodes[endNodeId].runState.output;
}

// 节点 UI 上下文
interface IUseNodeUIContext<C extends INodeConfig, S extends INodeState, I extends INodeInput, O extends INodeOutput> {
  config: C;
  state: S;
  runState: INodeStateRun<I, O>;
  setConfig: (newConfig: Partial<C>) => void;
  setState: (newState: Partial<S>) => void;
}

// 节点 UI 上下文 Helper 函数
export function useNodeUIContext<C extends INodeConfig, S extends INodeState, I extends INodeInput, O extends INodeOutput>(
  props: INodeProps<C, S, I, O>
): IUseNodeUIContext<C, S, I, O> {
  const { updateNodeData } = useReactFlow();

  const setConfig = useCallback((config: Partial<C>) => {
    updateNodeData(props.id, { ...props.data, config: { ...props.data.config, ...config } });
  }, [props.id, props.data, updateNodeData]);

  const setState = useCallback((state: Partial<S>) => {
    updateNodeData(props.id, { ...props.data, state: { ...props.data.state, ...state } });
  }, [props.id, props.data, updateNodeData]);

  return {
    config: props.data.config,
    state: props.data.state as S, // 明确类型
    runState: props.data.runState as INodeStateRun<I, O>,
    setConfig,
    setState,
  };
}

// 位置抽象
const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// 节点 DSL Schema
const NodeDSLSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PositionSchema.default({ x: 0, y: 0 }),
  config: NodeConfigSchema,
});

// 连接点 DSL Schema
const HandleDSLSchema = z.object({
  node: z.string(),
  key: z.string(),
});

// 边 DSL Schema
const EdgeDSLSchema = z.object({
  id: z.string(),
  source: HandleDSLSchema,
  target: HandleDSLSchema,
});

// 流 DSL Schema
export const FlowDSLSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodes: NodeDSLSchema.array(),
  edges: EdgeDSLSchema.array(),
});
export type IFlowDSL = z.infer<typeof FlowDSLSchema>;

// 导出 DSL Schema
export const DSLSchema = z.object({
  main: FlowDSLSchema,
  flows: FlowDSLSchema.array(),
});
export type IDSL = z.infer<typeof DSLSchema>;

// 导出单个Flow
function dumpFlow(input: IFlow): IFlowDSL {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    nodes: input.nodes.map((node) => ({
      id: node.id,
      type: node.type.id,
      position: node.position,
      config: node.config,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: {
        node: edge.source.node.id,
        key: edge.source.key,
      },
      target: {
        node: edge.target.node.id,
        key: edge.target.key,
      },
    })),
  }
}

// 和DSL相互转换的抽象
interface IDumpDSLIO {
  main: IFlow;
  flowNodeTypes: IFlowNodeType[];
}

// 导出完整工程DSL
export function dumpDSL(input: IDumpDSLIO): IDSL {
  return {
    main: dumpFlow(input.main),
    flows: input.flowNodeTypes.map(dumpFlow),
  }
}

// 节点类型映射
type INodeTypeMap = Record<string, INodeType<any, any, any, any>>;

// 从单个Flow加载节点和边
function loadFlow(
  unvalidatedDsl: unknown,
  nodeTypeMap: INodeTypeMap
): IFlow {
  let dsl: IFlowDSL;
  try {
    // 解析和验证格式
    dsl = FlowDSLSchema.parse(unvalidatedDsl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Flow DSL validation failed:", error.errors);
      throw new Error(`Invalid flow file format: ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
    } else {
      throw error;
    }
  }

  const nodes = dsl.nodes.map((nodeDSL) => {
    const nodeType = nodeTypeMap[nodeDSL.type];
    if (!nodeType) {
      throw new Error(`Unknown node type "${nodeDSL.type}".`);
    }

    const newNode: INodeWithPosition = {
      id: nodeDSL.id,
      type: nodeType,
      position: nodeDSL.position,
      config: { ...nodeType.defaultConfig, ...(nodeDSL.config ?? {}) },
      state: nodeType.defaultState,
      runState: defaultNodeRunState,
    };
    return newNode;
  });

  const edges = dsl.edges.map((edgeDSL) => {
    const sourceNode = nodes.find(n => n.id === edgeDSL.source.node);
    const targetNode = nodes.find(n => n.id === edgeDSL.target.node);
    if (!sourceNode || !targetNode) {
      throw new Error(`Edge "${edgeDSL.id}" connects to non-existent node(s).`);
    }
    const newEdge: IEdge = {
      id: edgeDSL.id,
      source: {
        node: sourceNode,
        key: edgeDSL.source.key,
      },
      target: {
        node: targetNode,
        key: edgeDSL.target.key,
      },
    };
    return newEdge;
  });

  return {
    id: dsl.id,
    name: dsl.name,
    description: dsl.description,
    nodes: nodes,
    edges: edges,
  };
}

// 子流节点类型
export const FlowNodeInputSchema = NodeInputSchema.extend({
  input: NodeInputSchema,
});
export type IFlowNodeInput = z.infer<typeof FlowNodeInputSchema>;

export const FlowNodeOutputSchema = NodeOutputSchema.extend({
  output: NodeOutputSchema,
});
export type IFlowNodeOutput = z.infer<typeof FlowNodeOutputSchema>;

export const FlowNodeConfigSchema = NodeConfigSchema.extend({});
export type IFlowNodeConfig = z.infer<typeof FlowNodeConfigSchema>;

export interface IFlowNodeState extends INodeState {
  type: IFlowNodeType;
  runNodes: INode[];
}
export type IFlowNodeType = INodeType<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput, IFlowNodeOutput> & IFlow;
export type INewFlowNodeType = (id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]) => IFlowNodeType;

// 从DSL加载完整工程
export function loadDSL(
  unvalidatedDsl: unknown,
  nodeTypeMap: INodeTypeMap,
  newFlowNodeType: INewFlowNodeType
): IDumpDSLIO {
  let dsl: IDSL;
  try {
    // 解析和验证格式
    dsl = DSLSchema.parse(unvalidatedDsl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("DSL validation failed:", error.errors);
      throw new Error(`Invalid flow file format: ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
    } else {
      throw error;
    }
  }
  // 构建子流类型映射 节点和边先留空避免循环依赖
  const flowNodeTypeMap = dsl.flows.reduce<Record<string, IFlowNodeType>>((acc, flow) => {
    const flowNodeType = newFlowNodeType(flow.id, flow.name, flow.description, [], []);
    acc[flowNodeType.id] = flowNodeType;
    return acc;
  }, {});
  const allNodeTypeMap = { ...nodeTypeMap, ...flowNodeTypeMap };
  // 注入子流类型的节点和边
  const flows = dsl.flows.map(flow => loadFlow(flow, allNodeTypeMap));
  flows.forEach(flow => {
    const flowNodeType = flowNodeTypeMap[flow.id];
    flowNodeType.nodes = flow.nodes;
    flowNodeType.edges = flow.edges;
  });
  // 加载主流程
  return {
    main: loadFlow(dsl.main, allNodeTypeMap),
    flowNodeTypes: flows.map(flow => flowNodeTypeMap[flow.id]),
  }
}
