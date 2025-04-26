import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';

interface IDisplayNodeInput extends INodeIO {
  value: any;
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
          id: 'value',
          type: 'target',
          position: Position.Left,
        }
      ]}
    >
      <Textarea
        placeholder="Empty"
        value={JSON.stringify(runState.input.value, null, 2)}
        readOnly
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}