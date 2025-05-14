import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const DisplayNodeInputSchema = BaseNodeInputSchema.extend({
  value: z.any().describe('value to display'),
});
type IDisplayNodeInput = z.infer<typeof DisplayNodeInputSchema>;

const DisplayNodeOutputSchema = BaseNodeOutputSchema.extend({});
type IDisplayNodeOutput = z.infer<typeof DisplayNodeOutputSchema>;

const DisplayNodeConfigSchema = BaseNodeConfigSchema.extend({});
type IDisplayNodeConfig = z.infer<typeof DisplayNodeConfigSchema>;

interface IDisplayNodeState extends IBaseNodeState { }

export const DisplayNodeType: INodeType<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput> = {
  configSchema: DisplayNodeConfigSchema,
  inputSchema: DisplayNodeInputSchema,
  outputSchema: DisplayNodeOutputSchema,
  id: 'display',
  name: 'Display',
  description: 'Display node displays the output by JSON stringify.',
  defaultConfig: {
    name: 'New Display',
    description: '',
  },
  defaultState: { highlight: false },
  ui: DisplayNodeUI,
  async run(_context: INodeContext<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput>): Promise<IDisplayNodeOutput> {
    return {};
  }
};

function DisplayNodeUI(props: INodeProps<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput>) {
  const { runState } = useNodeUIContext(props);
  return (
    <BaseNode
      {...props}
      nodeType={DisplayNodeType}
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