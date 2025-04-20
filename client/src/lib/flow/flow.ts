import { NodeProps, Position, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

// 节点输入输出基础类型
export interface INodeIO {
  [key: string]: any;
}

// 节点持久化数据抽象
export interface INodeData {
  [key: string]: any;
}

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
export interface INodeProps<D extends INodeData, S extends INodeState, I extends INodeIO, O extends INodeIO> extends NodeProps {
  title: string;
  description?: string;
  handles?: HandleConfig[];
  children?: React.ReactNode;
  data: { data: D, state: S, runState?: INodeStateRun<I, O> };
}

// 节点运行上下文 Partial方便更新部分数据
export interface INodeContext<D extends INodeData, S extends INodeState, I extends INodeIO> {
  data: D;
  updateData: (data: Partial<D>) => void;
  state: S;
  updateState: (state: Partial<S>) => void;
  input: I;
}

// 节点类型抽象
export interface INodeType<D extends INodeData, S extends INodeState, I extends INodeIO, O extends INodeIO> {
  id: string;
  name: string;
  description: string;
  defaultData: D;
  defaultState: S;
  ui: React.ComponentType<INodeProps<D, S, I, O>>;
  run: (context: INodeContext<D, S, I>) => Promise<O>;
}

// 节点抽象
export interface INode {
  id: string;
  type: INodeType<INodeData, INodeState, INodeIO, INodeIO>;
  data: INodeData;
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
export async function runFlow(nodeList: INode[], edgeList: IEdge[], updateNodeData: (nodeId: string, data: Partial<INodeData>) => void, updateNodeState: (nodeId: string, state: Partial<INodeState>) => void, updateNodeRunState: (nodeId: string, runState: Partial<INodeStateRun<INodeIO, INodeIO>>) => void) {
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
    node.runState = {
      status: 'idle',
      input: {},
      output: {},
      error: null,
    }
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
        console.log('input', node.type.name, node.id, input);
        // 执行节点
        const output = await node.type.run({
          data: node.data,
          updateData: (data: Partial<INodeData>) => {
            updateNodeData(node.id, data);
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
        console.log('output', node.type.name, node.id, output);
      } catch (e: any) {
        // 设置节点状态为失败
        node.runState.status = 'error';
        node.runState.error = e;
        console.error('error', node.type.name, node.id, e);
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


// 节点 UI 上下文
interface IUseNodeUIContext<D extends INodeData, S extends INodeState, I extends INodeIO, O extends INodeIO> {
  data: D;
  customState: S;
  runState: INodeStateRun<I, O>;
  setData: (newData: Partial<D>) => void;
  setState: (newState: Partial<S>) => void;
}

// 节点 UI 上下文 Helper 函数
export function useNodeUIContext<D extends INodeData, S extends INodeState, I extends INodeIO, O extends INodeIO>(
  props: INodeProps<D, S, I, O>
): IUseNodeUIContext<D, S, I, O> {
  const { updateNodeData } = useReactFlow();

  const setData = useCallback((data: Partial<D>) => {
    updateNodeData(props.id, { ...props.data, data: { ...props.data.data, ...data } });
  }, [props.id, props.data, updateNodeData]);

  const setState = useCallback((state: Partial<S>) => {
    updateNodeData(props.id, { ...props.data, state: { ...props.data.state, ...state } });
  }, [props.id, props.data, updateNodeData]);

  return {
    data: props.data.data,
    customState: props.data.state as S, // 明确类型
    runState: props.data.runState as INodeStateRun<I, O>,
    setData,
    setState,
  };
}