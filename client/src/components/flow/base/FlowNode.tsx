import { FlowNodeConfigSchema, FlowNodeInputSchema, FlowNodeOutputSchema, IEdge, IFlowNodeConfig, IFlowNodeInput, IFlowNodeOutput, IFlowNodeState, IFlowNodeType, INode, INodeContext, INodeInput, INodeOutput, INodeProps, INodeStateRun, INodeWithPosition, IRunFlowStack, runFlow, useNodeUIContext } from '@/lib/flow/flow';
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
    ui: FlowNodeUI,
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
      const fakeUpdate = (_a: any, _b: any) => { }
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

      const output = await runFlow(context.input.input, context.state.runNodes, context.state.type.edges, fakeUpdate, fakeUpdate, updateRunState, flowStack);
      return { output };
    }
  };

  flowNodeType.defaultState = {
    type: flowNodeType,
    runNodes: []
  } as IFlowNodeState;

  return flowNodeType as IFlowNodeType;
}

function FlowNodeUI(props: INodeProps<IFlowNodeConfig, IFlowNodeState, IFlowNodeInput, IFlowNodeOutput>) {
  const { state } = useNodeUIContext(props);
  return (
    <BaseNode
      {...props}
      nodeType={state.type}
      handles={[
        {
          id: 'input',
          type: 'target',
          position: Position.Left,
        },
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