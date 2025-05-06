import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeProps, INodeType, useNodeUIContext, IBaseNodeState, INodeContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import BaseNode from './base/BaseNode';
import { z } from "zod";

const DisplayNodeInputSchema = BaseNodeInputSchema.extend({
  value: z.any(),
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
  description: 'Display node displays the output.',
  defaultConfig: {
    name: 'New Display',
    description: '',
  },
  defaultState: {},
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
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}