import { Textarea } from "@/components/ui/textarea";
import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';

interface IDisplayNodeInput extends INodeIO {
  text: string;
}
interface IDisplayNodeOutput extends INodeIO { }
interface IDisplayNodeData extends INodeData { }
interface IDisplayNodeState extends INodeState {
  text: string;
}
export const DisplayNodeType: INodeType<IDisplayNodeData, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput> = {
  id: 'display',
  name: 'Display',
  description: 'Display node displays the output.',
  defaultData: {},
  defaultState: { text: '' },
  ui: DisplayNodeElement,
  async run(context: INodeContext<IDisplayNodeData, IDisplayNodeState, IDisplayNodeInput>): Promise<IDisplayNodeOutput> {
    console.log('display', context.input.text);
    context.updateState({ text: context.input.text });
    return {};
  }
};

function DisplayNodeElement(props: INodeProps<IDisplayNodeData, IDisplayNodeState>) {
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
        value={props.data.state.text}
        readOnly
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}