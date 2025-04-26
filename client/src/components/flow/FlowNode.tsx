import { IEdge, IFlowNodeConfig, IFlowNodeInput, IFlowNodeOutput, IFlowNodeState, IFlowNodeType, INodeContext, INodeProps, INodeWithPosition, runFlow, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';

export function newFlowNodeType(id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]): IFlowNodeType {
  const flowNodeType: Partial<IFlowNodeType> = {
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
      const updateAny = (_nodeId: string, _data: any) => { }
      const output = await runFlow(context.input.input, context.state.type.nodes, context.state.type.edges, updateAny, updateAny, updateAny);
      return { output };
    }
  };

  flowNodeType.defaultState = {
    type: flowNodeType as IFlowNodeType
  };

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