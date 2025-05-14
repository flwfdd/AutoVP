import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeRunLog, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import React, { useCallback } from 'react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const TextNodeInputSchema = BaseNodeInputSchema.extend({});
type ITextNodeInput = z.infer<typeof TextNodeInputSchema>;

const TextNodeOutputSchema = BaseNodeOutputSchema.extend({
  text: z.string().describe('text to output'),
});
type ITextNodeOutput = z.infer<typeof TextNodeOutputSchema>;

const TextNodeConfigSchema = BaseNodeConfigSchema.extend({
  text: z.string().describe('text to output'),
});
type ITextNodeConfig = z.infer<typeof TextNodeConfigSchema>;

interface ITextNodeState extends IBaseNodeState { }

export const TextNodeType: INodeType<ITextNodeConfig, ITextNodeState, ITextNodeInput, ITextNodeOutput> = {
  inputSchema: TextNodeInputSchema,
  outputSchema: TextNodeOutputSchema,
  configSchema: TextNodeConfigSchema,
  id: 'text',
  name: 'Text',
  description: 'Text node provides a text source.',
  defaultConfig: { name: 'New Text', description: '', text: '' },
  defaultState: { highlight: false },
  logFormatter: (_config: ITextNodeConfig, _state: ITextNodeState, log: INodeRunLog<ITextNodeInput, ITextNodeOutput>) => ({
    input: 'No input',
    output: log.output?.text ?? '',
    error: log.error ?? ''
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
        className='nowheel nodrag max-h-[50vh]'
      />
    </BaseNode>
  );
}
