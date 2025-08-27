import { BaseNodeDefaultState, FlowNodeConfigSchema, FlowNodeInputSchema, FlowNodeOutputSchema, IEdge, IFlowNodeConfig, IFlowNodeInput, IFlowNodeOutput, IFlowNodeState, IFlowNodeType, INode, INodeContext, INodeInput, INodeOutput, INodeProps, INodeStateRun, INodeWithPosition, IRunFlowStack, runFlow, useNodeUIContext } from '@/lib/flow/flow';
import { useMemo } from 'react';
import { Position } from '@xyflow/react';
import BaseNode from './BaseNode';

export function newFlowNodeType(id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]): IFlowNodeType {
  const flowNodeType: Partial<IFlowNodeType> = {
    inputSchema: FlowNodeInputSchema,
    outputSchema: FlowNodeOutputSchema,
    configSchema: FlowNodeConfigSchema,
    id: id,
    name: name,
    description: description,
    nodes: nodes,
    edges: edges,
    defaultConfig: {
      name: name + ' Node',
      description: '',
    },
    async run(context: INodeContext<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput>): Promise<IFlowNodeOutput> {
      const runNodeMap: Record<string, INode> = {}
      context.state.runNodes = context.state.type.nodes.map(node => {
        const runNode = {
          id: node.id,
          type: node.type,
          config: node.config,
          state: node.type.defaultState,
          runState: structuredClone(node.runState),
        } as INode;
        runNodeMap[runNode.id] = runNode;
        return runNode;
      }
      )
      const updateRunState = (nodeId: string, runState: INodeStateRun<INodeInput, INodeOutput>) => runNodeMap[nodeId].runState = structuredClone(runState)
      context.flowStack.forEach(stack => {
        if (stack.flow.id === context.state.type.id) {
          throw new Error('Cannot run flow inside itself: ' + context.state.type.name);
        }
      })
      const flowStack: IRunFlowStack[] = context.flowStack.concat({
        flow: context.state.type,
        startTime: Date.now(),
      })

      // 获取子流程的 start 节点
      const startNode = context.state.type.nodes.find(node => node.type.id === 'start');

      // 准备传递给子流程的输入
      let flowInput: Record<string, unknown>;
      if (startNode && startNode.config.params && startNode.config.params.length > 0) {
        // 如果 start 节点有自定义参数，将输入映射到对应的参数
        flowInput = {};
        startNode.config.params.forEach((param: { id: string, name: string }) => {
          flowInput[param.id] = context.input[param.name] ?? null;
        });
      } else {
        // 如果没有自定义参数，使用传统的输入方式
        flowInput = context.input.input ?? context.input;
      }

      const output = await runFlow(flowInput, context.state.runNodes, context.state.type.edges, () => { }, () => { }, updateRunState, flowStack);
      return { output };
    },
    ui:
      function FlowNodeUI(props: INodeProps<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput, IFlowNodeOutput>) {
        const { state } = useNodeUIContext(props);

        // 获取子流程的 start 节点来确定输入参数
        const inputHandles = useMemo(() => {
          const startNode = state.type.nodes.find(node => node.type.id === 'start');

          if (startNode && startNode.config.params && startNode.config.params.length > 0) {
            // 如果 start 节点有自定义参数，为每个参数创建输入handle
            return startNode.config.params.map((param: { id: string, name: string }) => ({
              id: param.name,
              type: 'target' as const,
              position: Position.Left,
              label: param.name
            }));
          }
          return [];
        }, [state.type.nodes]);

        return (
          <BaseNode
            {...props}
            nodeType={state.type}
            handles={[
              ...inputHandles,
              {
                id: 'output',
                type: 'source',
                position: Position.Right,
                label: "Output",
              }
            ]}
          />
        );
      }
  };

  flowNodeType.defaultState = {
    ...BaseNodeDefaultState,
    type: flowNodeType,
    runNodes: [],
  } as IFlowNodeState;

  return flowNodeType as IFlowNodeType;
}

