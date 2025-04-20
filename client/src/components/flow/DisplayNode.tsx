import { Textarea } from "@/components/ui/textarea";
import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';

interface IDisplayNodeInput extends INodeIO {
  text: string;
}
interface IDisplayNodeOutput extends INodeIO { }
interface IDisplayNodeData extends INodeData { }
interface IDisplayNodeState extends INodeState { }
export const DisplayNodeType: INodeType<IDisplayNodeData, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput> = {
  id: 'display',
  name: 'Display',
  description: 'Display node displays the output.',
  defaultData: {},
  defaultState: {},
  ui: DisplayNodeUI,
  async run(_context: INodeContext<IDisplayNodeData, IDisplayNodeState, IDisplayNodeInput>): Promise<IDisplayNodeOutput> {
    return {};
  }
};

function DisplayNodeUI(props: INodeProps<IDisplayNodeData, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput>) {
  return (
    <BaseNode
      {...props}
      title="Display"
      description="Display node displays the output."
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