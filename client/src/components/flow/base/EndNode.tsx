import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeDefaultState, BaseNodeInputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from 'zod';
import BaseNode from './BaseNode';

const EndNodeInputSchema = BaseNodeInputSchema.extend({
  value: z.any().describe('Output of the flow, corresponding to the only handle'),
});
type IEndNodeInput = z.infer<typeof EndNodeInputSchema>;

const EndNodeOutputSchema = z.any().describe('No output handle');
type IEndNodeOutput = z.infer<typeof EndNodeOutputSchema>;

const EndNodeConfigSchema = BaseNodeConfigSchema;
type IEndNodeConfig = z.infer<typeof EndNodeConfigSchema>;

type IEndNodeState = IBaseNodeState;

export const EndNodeType: INodeType<IEndNodeConfig, IEndNodeState, IEndNodeInput, IEndNodeOutput> = {
  inputSchema: EndNodeInputSchema,
  outputSchema: EndNodeOutputSchema,
  configSchema: EndNodeConfigSchema,
  inputHandlesGetter: () => new Set(['value']),
  outputHandlesGetter: () => new Set(),
  id: 'end',
  name: 'End',
  description: 'End node can be connected to multiple previous nodes.\n' +
    'The value will be the first previous executed node\'s output.\n' +
    'The output of the flow is the value of the end node.',
  defaultConfig: {
    name: 'End',
    description: '',
  },
  defaultState: BaseNodeDefaultState,
  async run(context: INodeContext<IEndNodeConfig, IEndNodeState, IEndNodeInput>): Promise<IEndNodeOutput> {
    return context.input.value;
  },
  ui:
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
              limit: 0,
            }
          ]}
        >
          <Textarea
            placeholder="Empty"
            value={JSON.stringify(runState.input.value, null, 2)}
            readOnly
            className='nowheel nodrag max-h-32'
          />
        </BaseNode>
      );
    }
};
