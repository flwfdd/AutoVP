import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './BaseNode';

interface IEndNodeInput extends INodeIO {
  text: string;
}
interface IEndNodeOutput extends INodeIO { }
interface IEndNodeConfig extends INodeConfig { }
interface IEndNodeState extends INodeState { }
export const EndNodeType: INodeType<IEndNodeConfig, IEndNodeState, IEndNodeInput, IEndNodeOutput> = {
  id: 'end',
  name: 'End',
  description: 'End node is the only ending node of the flow.',
  defaultConfig: {
    name: 'End',
    description: '',
  },
  defaultState: {},
  ui: EndNodeUI,
  async run(_context: INodeContext<IEndNodeConfig, IEndNodeState, IEndNodeInput>): Promise<IEndNodeOutput> {
    return {};
  }
};

function EndNodeUI(props: INodeProps<IEndNodeConfig, IEndNodeState, IEndNodeInput, IEndNodeOutput>) {
  const { runState } = useNodeUIContext(props);
  return (
    <BaseNode
      {...props}
      nodeType={EndNodeType}
      handles={[
        {
          id: 'text',
          type: 'target',
          position: Position.Left,
        }
      ]}
    >
      <Textarea
        placeholder="Empty"
        value={runState.input.text ?? ''}
        readOnly
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}