import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeRunLog, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
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
  defaultConfig: { name: 'New Text', description: '', text: '' },
  defaultState: {},
  logFormatter: (_config: ITextNodeConfig, _state: ITextNodeState, log: INodeRunLog<ITextNodeInput, ITextNodeOutput>) => ({
    input: 'No input',
    output: log.output?.text ?? ''
  }),
  ui: TextNodeUI,
  async run(context: INodeContext<ITextNodeConfig, ITextNodeState, ITextNodeInput>): Promise<ITextNodeOutput> {
    return { text: context.config.text };
  }
};

function TextNodeUI(props: INodeProps<ITextNodeConfig, ITextNodeState, ITextNodeInput, ITextNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ text: evt.target.value });
  }, [setConfig]);

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
        value={config.text}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}
