import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position, useReactFlow } from '@xyflow/react';
import React, { useCallback } from 'react';
import BaseNode from './base/BaseNode';

interface ITextNodeInput extends INodeIO { }
interface ITextNodeOutput extends INodeIO {
  text: string;
}
interface ITextNodeConfig extends INodeConfig {
  text: string;
}
interface ITextNodeState extends INodeState { }

export const TextNodeType: INodeType<ITextNodeConfig, ITextNodeState, ITextNodeInput, ITextNodeOutput> = {
  id: 'text',
  name: 'Text',
  description: 'Text node provides a text source.',
  defaultConfig: { name: 'New Text', text: '' },
  defaultState: {},
  ui: TextNodeUI,
  async run(context: INodeContext<ITextNodeConfig, ITextNodeState, ITextNodeInput>): Promise<ITextNodeOutput> {
    return { text: context.config.text };
  }
};

function TextNodeUI(props: INodeProps<ITextNodeConfig, ITextNodeState, ITextNodeInput, ITextNodeOutput>) {
  const [text, setText] = React.useState('');
  const { updateNodeData } = useReactFlow();
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(evt.target.value);
    updateNodeData(props.id, { config: { text: evt.target.value } });
  }, [props.id, updateNodeData]);

  return (
    <BaseNode
      {...props}
      nodeType={TextNodeType}
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
