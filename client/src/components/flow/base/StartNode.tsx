import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import React, { useCallback } from 'react';
import { z } from 'zod';
import BaseNode from './BaseNode';

const StartNodeInputSchema = BaseNodeInputSchema.extend({});
type IStartNodeInput = z.infer<typeof StartNodeInputSchema>;

const StartNodeOutputSchema = BaseNodeOutputSchema.extend({
  value: z.any(),
});
type IStartNodeOutput = z.infer<typeof StartNodeOutputSchema>;

const StartNodeConfigSchema = BaseNodeConfigSchema.extend({});
type IStartNodeConfig = z.infer<typeof StartNodeConfigSchema>;

interface IStartNodeState extends INodeState {
  value: any;
}

export const StartNodeType: INodeType<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput> = {
  inputSchema: StartNodeInputSchema,
  outputSchema: StartNodeOutputSchema,
  configSchema: StartNodeConfigSchema,
  id: 'start',
  name: 'Start',
  description: 'Start node is the only starting node of the flow.',
  defaultConfig: { name: 'Start', description: '' },
  defaultState: { highlight: false, value: '' },
  ui: StartNodeUI,
  async run(context: INodeContext<IStartNodeConfig, IStartNodeState, IStartNodeInput>): Promise<IStartNodeOutput> {
    if (context.input === undefined) {
      throw new Error('No input');
    }
    return { value: Object.keys(context.input).length ? context.input : context.state.value };
  }
};

function StartNodeUI(props: INodeProps<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput>) {
  const { state, setState } = useNodeUIContext(props);
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ value: evt.target.value });
  }, [setState]);

  return (
    <BaseNode
      {...props}
      nodeType={StartNodeType}
      handles={[
        {
          id: 'value',
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Input text"
        value={state.value}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}
