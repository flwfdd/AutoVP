import { Textarea } from "@/components/ui/textarea";
import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position, useReactFlow } from '@xyflow/react';
import React, { useCallback } from 'react';
import BaseNode from './base/BaseNode';

interface ITextNodeInput extends INodeIO { }
interface ITextNodeOutput extends INodeIO {
  text: string;
}
interface ITextNodeData extends INodeData {
  text: string;
}
interface ITextNodeState extends INodeState { }

export const TextNodeType: INodeType<ITextNodeData, ITextNodeState, ITextNodeInput, ITextNodeOutput> = {
  id: 'text',
  name: 'Text',
  description: 'Text node provides a text source.',
  defaultData: { text: '' },
  defaultState: {},
  ui: TextNodeElement,
  async run(context: INodeContext<ITextNodeData, ITextNodeState, ITextNodeInput>): Promise<ITextNodeOutput> {
    return { text: context.data.text };
  }
};

export default function TextNodeElement(props: INodeProps<ITextNodeData, ITextNodeState>) {
  const [text, setText] = React.useState('');
  const { updateNodeData } = useReactFlow();
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(evt.target.value);
    updateNodeData(props.id, { data: { text: evt.target.value } });
  }, [props.id, updateNodeData]);

  return (
    <BaseNode
      {...props}
      title="Text"
      description="Text node provides a text source."
      handles={[
        {
          id: 'text',
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Enter text"
        value={text}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}
