import { NodeProps, Position, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { z } from 'zod';

// 节点输入输出基础类型
export interface INodeIO {
  [key: string]: any;
}

// 节点持久化数据抽象
const NodeConfigSchema = z.object({
  name: z.string(),
}).catchall(z.any());
export type INodeConfig = z.infer<typeof NodeConfigSchema>;

// 节点非持久化状态抽象
export interface INodeState {
  [key: string]: any;
}

// 节点运行时状态抽象
export interface INodeStateRun<I extends INodeIO, O extends INodeIO> {
  input: I;
  output: O;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: any;
}
const defaultNodeRunState: INodeStateRun<INodeIO, INodeIO> = {
  status: 'idle',
  input: {},
  output: {},
  error: null,
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
export interface INodeProps<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO> extends NodeProps {
  nodeType: INodeType<C, S, I, O>;
  handles?: HandleConfig[];
  children?: React.ReactNode;
  data: { config: C, state: S, runState?: INodeStateRun<I, O> };
}

// 节点运行上下文 Partial方便更新部分数据
export interface INodeContext<C extends INodeConfig, S extends INodeState, I extends INodeIO> {
  config: C;
  updateConfig: (config: Partial<C>) => void;
  state: S;
  updateState: (state: Partial<S>) => void;
  input: I;
}

// 节点类型抽象
export interface INodeType<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO> {
  id: string;
  name: string;
  description: string;
  defaultConfig: C;
  defaultState: S;
  ui: React.ComponentType<INodeProps<C, S, I, O>>;
  run: (context: INodeContext<C, S, I>) => Promise<O>;
}

// 节点抽象
export interface INode {
  id: string;
  type: INodeType<INodeConfig, INodeState, INodeIO, INodeIO>;
  config: INodeConfig;
  state: INodeState;
  runState: INodeStateRun<INodeIO, INodeIO>;
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

// 运行流
export async function runFlow(nodeList: INode[], edgeList: IEdge[], updateNodeConfig: (nodeId: string, config: Partial<INodeConfig>) => void, updateNodeState: (nodeId: string, state: Partial<INodeState>) => void, updateNodeRunState: (nodeId: string, runState: Partial<INodeStateRun<INodeIO, INodeIO>>) => void) {
  // 节点列表
  const nodes = nodeList.reduce<Record<string, INodeRun>>((acc, node) => {
    acc[node.id] = {
      ...node,
      inputEdges: edgeList.filter((edge) => edge.target.node.id === node.id),
      outputEdges: edgeList.filter((edge) => edge.source.node.id === node.id),
      waitNum: edgeList.filter((edge) => edge.target.node.id === node.id).length,
    }
    return acc;
  }, {});

  // 边列表
  const edges = edgeList.reduce<Record<string, IEdgeRun>>((acc, edge) => {
    acc[edge.id] = {
      ...edge,
      value: {},
    }
    return acc;
  }, {});

  // 重制所有节点状态
  Object.values(nodes).forEach((node) => {
    node.runState = defaultNodeRunState;
    updateNodeRunState(node.id, node.runState);
  });

  // 当前序结果都就绪后加入可执行节点列表
  let readyNodes = Object.values(nodes).filter((node) => node.inputEdges.length === 0);
  while (1) {
    if (readyNodes.length === 0) {
      break;
    }
    let newReadyNodes: INodeRun[] = [];
    for (const node of readyNodes) {
      // 设置节点状态为运行中
      node.runState.status = 'running';
      try {
        // 从边获取输入
        const input = node.inputEdges.reduce<Record<string, any>>((acc, edge) => {
          acc[edge.target.key] = edges[edge.id].value;
          return acc;
        }, {});
        node.runState.input = input;
        updateNodeRunState(node.id, node.runState);
        console.log('input', node.config.name, node.id, input);
        // 执行节点
        const output = await node.type.run({
          config: node.config,
          updateConfig: (config: Partial<INodeConfig>) => {
            updateNodeConfig(node.id, config);
          },
          state: node.state,
          updateState: (state: Partial<INodeState>) => {
            updateNodeState(node.id, state);
          },
          input,
        });
        // 将输出写入边
        node.outputEdges.forEach((edge) => {
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
        console.log('output', node.config.name, node.id, output);
      } catch (e: any) {
        // 设置节点状态为失败
        node.runState.status = 'error';
        node.runState.error = e;
        console.error('error', node.config.name, node.id, e);
      } finally {
        updateNodeRunState(node.id, node.runState);
        // 如果节点运行失败，则抛出错误
        if (node.runState.status === 'error') {
          throw new Error(`Error in ${node.type.name}(${node.id}): ${node.runState.error.message || node.runState.error}`);
        }
      }
    }
    readyNodes = newReadyNodes;
  }
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

// 导出流 DSL Schema
export const FlowDSLSchema = z.object({
  nodes: NodeDSLSchema.array(),
  edges: EdgeDSLSchema.array(),
});
export type IFlowDSL = z.infer<typeof FlowDSLSchema>;

export interface INodeWithPosition extends INode {
  position: { x: number, y: number };
}

// 导出流
export function dumpFlow(
  nodeList: INodeWithPosition[],
  edgeList: IEdge[]
): IFlowDSL {
  return {
    nodes: nodeList.map((node) => ({
      id: node.id,
      type: node.type.id,
      position: node.position,
      config: node.config,
      state: node.state,
    })),
    edges: edgeList.map((edge) => ({
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

// 节点类型映射
type NodeTypeMap = Record<string, INodeType<any, any, any, any>>;

// 从DSL加载流
export function loadFlow(
  unvalidatedDsl: unknown,
  nodeTypeMap: NodeTypeMap
): { nodes: INodeWithPosition[], edges: IEdge[] } {
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

  return { nodes, edges };
}

// 节点 UI 上下文
interface IUseNodeUIContext<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO> {
  config: C;
  customState: S;
  runState: INodeStateRun<I, O>;
  setConfig: (newConfig: Partial<C>) => void;
  setState: (newState: Partial<S>) => void;
}

// 节点 UI 上下文 Helper 函数
export function useNodeUIContext<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO>(
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
    customState: props.data.state as S, // 明确类型
    runState: props.data.runState as INodeStateRun<I, O>,
    setConfig,
    setState,
  };
}