import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from 'zod';
import BaseNode from './BaseNode';

const EndNodeInputSchema = BaseNodeInputSchema.extend({
  value: z.any(),
});
type IEndNodeInput = z.infer<typeof EndNodeInputSchema>;

const EndNodeOutputSchema = BaseNodeOutputSchema.extend({});
type IEndNodeOutput = z.infer<typeof EndNodeOutputSchema>;

const EndNodeConfigSchema = BaseNodeConfigSchema.extend({});
type IEndNodeConfig = z.infer<typeof EndNodeConfigSchema>;

interface IEndNodeState extends INodeState { }

export const EndNodeType: INodeType<IEndNodeConfig, IEndNodeState, IEndNodeInput, IEndNodeOutput> = {
  inputSchema: EndNodeInputSchema,
  outputSchema: EndNodeOutputSchema,
  configSchema: EndNodeConfigSchema,
  id: 'end',
  name: 'End',
  description: 'End node is the only ending node of the flow.',
  defaultConfig: {
    name: 'End',
    description: '',
  },
  defaultState: { highlight: false },
  ui: EndNodeUI,
  async run(context: INodeContext<IEndNodeConfig, IEndNodeState, IEndNodeInput>): Promise<IEndNodeOutput> {
    return context.input.value;
  }
};

function EndNodeUI(props: INodeProps<IEndNodeConfig, IEndNodeState, IEndNodeInput, IEndNodeOutput>) {
  const { runState } = useNodeUIContext(props);
  return (
    <BaseNode
      {...props}
      nodeType={EndNodeType}
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
        className='nowheel nodrag max-h-[50vh]'
      />
    </BaseNode>
  );
}