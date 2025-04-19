import { Edge, NodeProps, Position } from "@xyflow/react";

// 节点输入输出基础类型
export interface INodeIO {
  [key: string]: any;
}

// 节点持久化数据抽象
export interface INodeData {
  [key: string]: any;
}

// 节点运行时状态抽象
export interface INodeState {
  [key: string]: any;
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

// 节点操作配置
interface ActionConfig {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

// 节点 UI Props 抽象
export interface INodeProps<D extends INodeData, S extends INodeState> extends NodeProps {
  title: string;
  description?: string;
  handles?: HandleConfig[];
  actions?: ActionConfig[];
  children?: React.ReactNode;
  data: { data: D, state: S, edges: Edge[], setEdges: React.Dispatch<React.SetStateAction<Edge[]>> };
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
  ui: React.ComponentType<INodeProps<D, S>>;
  run: (context: INodeContext<D, S, I>) => Promise<O>;
}

// 节点抽象
export interface INode {
  id: string;
  type: INodeType<INodeData, INodeState, INodeIO, INodeIO>;
  data: INodeData;
  state: INodeState;
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

interface INodeRun extends INode {
  inputEdges: IEdge[];
  outputEdges: IEdge[];
  waitNum: number;
}

interface IEdgeRun extends IEdge {
  value: any;
}

// 运行流
export async function runFlow(nodeList: INode[], edgeList: IEdge[], updateNodeData: (nodeId: string, data: Partial<INodeData>) => void, updateNodeState: (nodeId: string, state: Partial<INodeState>) => void) {
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

  // 当前序结果都就绪后加入可执行节点列表
  let readyNodes = Object.values(nodes).filter((node) => node.inputEdges.length === 0);
  while (1) {
    if (readyNodes.length === 0) {
      break;
    }
    let newReadyNodes: INodeRun[] = [];
    for (const node of readyNodes) {
      // 从边获取输入
      const input = node.inputEdges.reduce<Record<string, any>>((acc, edge) => {
        acc[edge.target.key] = edges[edge.id].value;
        return acc;
      }, {});
      console.log('input', node.type.name, input);
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
      console.log('output', node.type.name, output);
    }
    readyNodes = newReadyNodes;
  }
}