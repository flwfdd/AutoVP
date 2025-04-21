import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
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
  },
  defaultState: {},
  ui: DisplayNodeUI,
  async run(_context: INodeContext<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput>): Promise<IDisplayNodeOutput> {
    return {};
  }
};

function DisplayNodeUI(props: INodeProps<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput>) {
  return (
    <BaseNode
      {...props}
      nodeType={DisplayNodeType}
      handles={[
        {
          id: 'text',
          type: 'target',
          position: Position.Left,
          limit: 1,
        }
      ]}
    >
      <Textarea
        placeholder="Empty"
        value={props.data.runState?.input.text}
        readOnly
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}