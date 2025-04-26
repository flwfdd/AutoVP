import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';

interface IDisplayNodeInput extends INodeIO {
  text: string;
}
interface IDisplayNodeOutput extends INodeIO { }
interface IDisplayNodeConfig extends INodeConfig { }
interface IDisplayNodeState extends INodeState { }
export const DisplayNodeType: INodeType<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput> = {
  id: 'display',
  name: 'Display',
  description: 'Display node displays the output.',
  defaultConfig: {
    name: 'New Display',
    description: '',
  },
  defaultState: {},
  ui: DisplayNodeUI,
  async run(_context: INodeContext<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput>): Promise<IDisplayNodeOutput> {
    return {};
  }
};

function DisplayNodeUI(props: INodeProps<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput>) {
  const { runState } = useNodeUIContext(props);
  return (
    <BaseNode
      {...props}
      nodeType={DisplayNodeType}
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