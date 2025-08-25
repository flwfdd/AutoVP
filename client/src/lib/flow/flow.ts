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
  name: z.string().describe('name of the node'),
  description: z.string().describe('description of the node'),
});
export type IBaseNodeConfig = z.infer<typeof BaseNodeConfigSchema>;
export const NodeConfigSchema = BaseNodeConfigSchema.catchall(z.any());
export type INodeConfig = z.infer<typeof NodeConfigSchema>;

// 节点非持久化状态抽象
export interface IBaseNodeState {
  highlight: boolean;
  reviewed: boolean;
}
export interface INodeState extends IBaseNodeState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
export const BaseNodeDefaultState: IBaseNodeState = {
  highlight: false,
  reviewed: true,
}

// 节点运行记录
export interface INodeRunLog<I extends IBaseNodeInput, O extends IBaseNodeOutput> {
  startMs: number;
  endMs?: number;
  input: I;
  output?: O;
  error?: unknown;
}

// 节点运行时状态抽象
export interface INodeStateRun<I extends IBaseNodeInput, O extends IBaseNodeOutput> {
  input: I;
  output: O;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: unknown;
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
  value?: unknown;
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
  value: unknown;
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

  // 用于终止所有运行中的节点
  const abortController = new AbortController();
  const signal = abortController.signal;

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
      value: undefined,
    }
    return acc;
  }, {});

  // 重置所有节点状态
  Object.values(nodes).forEach((node) => {
    node.runState = structuredClone(defaultNodeRunState);
    updateNodeRunState(node.id, node.runState);
  });

  // 用于跟踪活跃的节点运行Promise
  const activeNodeRuns = new Map<string, Promise<void>>();

  // 执行单个节点的函数
  const runNode = async (node: INodeRun): Promise<void> => {
    if (signal.aborted) {
      return; // 如果已经中止，不执行节点
    }

    // 设置节点状态为运行中
    node.runState.status = 'running';
    const log = {
      startMs: Date.now() - startTime,
      input: {},
      output: {},
      error: null,
    } as INodeRunLog<INodeInput, INodeOutput>;

    try {
      // 从边获取输入
      const input = node.inputEdges.reduce<Record<string, unknown>>((acc, edge) => {
        if (edges[edge.id].value !== undefined) {
          acc[edge.target.key] = edges[edge.id].value;
        }
        return acc;
      }, {});
      node.runState.input = input;

      // 运行前callback
      console.log('input', node.config.name, node.id, input);
      log.input = input;

      // 更新节点状态
      updateNodeRunState(node.id, node.runState);

      // 验证输入数据
      try {
        node.type.inputSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error(`Input validation failed for node "${node.id}" (${node.config.name}):`, error.errors);
          throw new Error(`Invalid input for node "${node.config.name}": ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
        } else {
          throw error;
        }
      }

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

      // 检查是否已经中止
      if (signal.aborted) {
        throw new Error('Flow execution aborted');
      }

      // 运行成功callback
      console.log('output', node.config.name, node.id, output);
      log.output = output;

      // 验证输出数据
      try {
        node.type.outputSchema.parse(output);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error(`Output validation failed for node "${node.id}" (${node.config.name}):`, error.errors);
          throw new Error(`Invalid output from node "${node.config.name}": ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
        } else {
          throw error;
        }
      }

      // 设置节点状态为成功
      node.runState.status = 'success';
      node.runState.output = output;

      // 更新运行日志和状态
      log.endMs = Date.now() - startTime;
      node.runState.logs.push(log);
      updateNodeRunState(node.id, node.runState);

      // 处理输出边和激活下游节点
      try {
        await processOutputs(node, output);
      } catch (e: unknown) {
        console.error('processOutputs error', node.config.name, node.id, e);
      }
    } catch (e: unknown) {
      // 设置节点状态为失败
      node.runState.status = 'error';
      node.runState.error = e;

      // 更新运行日志和状态
      log.endMs = Date.now() - startTime;
      log.error = e instanceof Error ? e.message : String(e);
      node.runState.logs.push(log);
      updateNodeRunState(node.id, node.runState);

      // 运行失败callback
      console.error('error', node.config.name, node.id, e);

      // 中止所有运行中的节点
      abortController.abort();

      throw e; // 向上传播错误
    } finally {
      // 从活跃列表中移除
      activeNodeRuns.delete(node.id);
    }
  };

  // 处理节点输出和激活下游节点
  const processOutputs = async (node: INodeRun, output: INodeOutput): Promise<void> => {
    const downstreamPromises: Promise<void>[] = [];

    node.outputEdges.forEach((edge) => {
      // 输出为undefined表示不走这条边
      if (output[edge.source.key] === undefined) {
        return;
      }

      edges[edge.id].value = output[edge.source.key];
      // 更新目标节点等待数
      const targetNode = nodes[edge.target.node.id];
      targetNode.waitNum--;

      // 特殊处理 end 节点 只要有一个输入就执行
      if (targetNode.id === endNodeId) {
        const targetRun = runNode(targetNode);
        activeNodeRuns.set(targetNode.id, targetRun);
        downstreamPromises.push(targetRun);
        return;
      }

      // 如果目标节点的所有输入都准备好了，开始执行该节点
      if (targetNode.waitNum === 0 && !activeNodeRuns.has(targetNode.id)) {
        const targetRun = runNode(targetNode);
        activeNodeRuns.set(targetNode.id, targetRun);
        downstreamPromises.push(targetRun);
      }
    });

    // 等待所有新启动的下游节点完成
    if (downstreamPromises.length > 0) {
      await Promise.all(downstreamPromises);
    }
  };

  try {
    // 获取初始可执行节点（入度为0的节点）
    const initialNodes = Object.values(nodes).filter((node) => node.inputEdges.length === 0);

    // 并行启动所有初始节点
    const initialPromises = initialNodes.map(node => {
      const nodeRun = runNode(node);
      activeNodeRuns.set(node.id, nodeRun);
      return nodeRun;
    });

    // 等待所有初始节点及其级联的下游节点完成
    await Promise.all(initialPromises);

    // 检查终止节点是否成功完成
    if (nodes[endNodeId].runState.status !== 'success') {
      throw new Error('End node did not complete successfully');
    }

    return nodes[endNodeId].runState.output;

  } catch (error) {
    // 确保中止所有活跃节点
    abortController.abort();

    // 等待所有活跃节点结束
    if (activeNodeRuns.size > 0) {
      try {
        await Promise.allSettled(Array.from(activeNodeRuns.values()));
      } catch {
        // 忽略等待期间的错误
      }
    }

    // 重新抛出原始错误
    throw error;
  }
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
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// 节点 DSL Schema
export const NodeDSLSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PositionSchema.default({ x: 0, y: 0 }),
  config: NodeConfigSchema,
});

// 连接点 DSL Schema
export const HandleDSLSchema = z.object({
  node: z.string(),
  key: z.string(),
});

// 边 DSL Schema
export const EdgeDSLSchema = z.object({
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
export function dumpFlow(input: IFlow): IFlowDSL {
  // 验证所有节点的配置
  input.nodes.forEach(node => {
    try {
      node.type.configSchema.parse(node.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`Config validation failed when exporting node "${node.id}" (${node.config.name}):`, error.errors);
        throw new Error(`Invalid config for node "${node.config.name}": ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
      } else {
        throw error;
      }
    }
  });

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
type INodeTypeMap = Record<string, INodeType<INodeConfig, INodeState, INodeInput, INodeOutput>>;

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

  // 检查节点ID是否重复
  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  dsl.nodes.forEach(node => {
    if (nodeIds.has(node.id)) {
      duplicateNodeIds.add(node.id);
    } else {
      nodeIds.add(node.id);
    }
  });

  if (duplicateNodeIds.size > 0) {
    throw new Error(`Duplicate node IDs found: ${Array.from(duplicateNodeIds).join(', ')}`);
  }

  // 检查边ID是否重复
  const edgeIds = new Set<string>();
  const duplicateEdgeIds = new Set<string>();
  dsl.edges.forEach(edge => {
    if (edgeIds.has(edge.id)) {
      duplicateEdgeIds.add(edge.id);
    } else {
      edgeIds.add(edge.id);
    }
  });

  if (duplicateEdgeIds.size > 0) {
    throw new Error(`Duplicate edge IDs found: ${Array.from(duplicateEdgeIds).join(', ')}`);
  }

  const nodes = dsl.nodes.map((nodeDSL) => {
    const nodeType = nodeTypeMap[nodeDSL.type];
    if (!nodeType) {
      throw new Error(`Unknown node type "${nodeDSL.type}".`);
    }

    // 使用节点类型的configSchema验证配置
    let validatedConfig;
    try {
      validatedConfig = nodeType.configSchema.parse(nodeDSL.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`Config validation failed for node "${nodeDSL.id}" of type "${nodeDSL.type}":`, error.errors);
        throw new Error(`Invalid config for node "${nodeDSL.id}": ${error.errors.map(e => `${e.path.join('.')} (${e.message})`).join(', ')}`);
      } else {
        throw error;
      }
    }

    const newNode: INodeWithPosition = {
      id: nodeDSL.id,
      type: nodeType,
      position: nodeDSL.position,
      config: validatedConfig,
      state: nodeType.defaultState,
      runState: defaultNodeRunState,
    };
    return newNode;
  });

  // 预先验证所有边的引用
  for (const edgeDSL of dsl.edges) {
    // 检查源节点是否存在
    if (!nodeIds.has(edgeDSL.source.node)) {
      throw new Error(`Edge "${edgeDSL.id}" references non-existent source node "${edgeDSL.source.node}".`);
    }
    // 检查目标节点是否存在
    if (!nodeIds.has(edgeDSL.target.node)) {
      throw new Error(`Edge "${edgeDSL.id}" references non-existent target node "${edgeDSL.target.node}".`);
    }
    // 当前我们先跳过key验证，因为在我们的系统中key可能是动态的
    // 在未来，我们可以添加更严格的key验证，例如通过收集节点类型支持的输入/输出键
    // 或者在节点类型中添加handler定义等方式
  }

  // 检查入度唯一：确保每个节点的每个输入连接点只连接一条边
  const targetConnectionPoints = new Map<string, string>(); // 格式: "nodeId:key" -> edgeId
  const duplicateTargets = new Set<string>();

  for (const edgeDSL of dsl.edges) {
    const targetKey = `${edgeDSL.target.node}:${edgeDSL.target.key}`;

    if (targetConnectionPoints.has(targetKey)) {
      // 发现重复的目标连接点
      duplicateTargets.add(targetKey);
    } else {
      targetConnectionPoints.set(targetKey, edgeDSL.id);
    }
  }

  if (duplicateTargets.size > 0) {
    const details = Array.from(duplicateTargets).map(target => {
      const [nodeId, key] = target.split(':');
      return `Node "${nodeId}" has multiple edges targeting input "${key}"`;
    }).join(', ');
    throw new Error(`Multiple edges connect to the same input: ${details}. Each input connection point can only connect one edge.`);
  }

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
  input: z.any(),
});
export type IFlowNodeInput = z.infer<typeof FlowNodeInputSchema>;

export const FlowNodeOutputSchema = NodeOutputSchema.extend({
  output: z.any(),
});
export type IFlowNodeOutput = z.infer<typeof FlowNodeOutputSchema>;

export const FlowNodeConfigSchema = NodeConfigSchema.extend({});
export type IFlowNodeConfig = z.infer<typeof FlowNodeConfigSchema>;

export interface IFlowNodeState extends INodeState {
  type: IFlowNodeType;
  runNodes: INode[];
}
// 流节点类型 - 使用组合而不是交集类型 相当于 INodeType<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput, IFlowNodeOutput> & IFlow
export interface IFlowNodeType extends INodeType<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput, IFlowNodeOutput> {
  // 流特有的属性 & IFlow
  nodes: INodeWithPosition[];
  edges: IEdge[];
}
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
  const allNodeTypeMap = { ...nodeTypeMap, ...flowNodeTypeMap } as INodeTypeMap;
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
