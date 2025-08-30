import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeDefaultState, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { Text } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import BaseNode from './base/BaseNode';
import MarkdownRenderer from "./editor/MarkdownRenderer";

const DisplayNodeInputSchema = BaseNodeInputSchema.extend({
  value: z.any().describe('Value to display, if the value is a string, it can be viewed as markdown'),
});
type IDisplayNodeInput = z.infer<typeof DisplayNodeInputSchema>;

const DisplayNodeOutputSchema = BaseNodeOutputSchema.describe('No output handle');
type IDisplayNodeOutput = z.infer<typeof DisplayNodeOutputSchema>;

const DisplayNodeConfigSchema = BaseNodeConfigSchema;
type IDisplayNodeConfig = z.infer<typeof DisplayNodeConfigSchema>;

type IDisplayNodeState = IBaseNodeState;

export const DisplayNodeType: INodeType<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput> = {
  configSchema: DisplayNodeConfigSchema,
  inputSchema: DisplayNodeInputSchema,
  outputSchema: DisplayNodeOutputSchema,
  id: 'display',
  name: 'Display',
  description: 'Display node displays the value by JSON stringify.',
  defaultConfig: {
    name: 'New Display',
    description: '',
  },
  defaultState: BaseNodeDefaultState,
  async run() {
    return {};
  },
  ui: function DisplayNodeUI(props: INodeProps<IDisplayNodeConfig, IDisplayNodeState, IDisplayNodeInput, IDisplayNodeOutput>) {
    const { runState } = useNodeUIContext(props);
    const [isMarkdownDialogOpen, setIsMarkdownDialogOpen] = useState(false);

    // 获取要显示的内容
    const content = JSON.stringify(runState.input.value, null, 2);
    const isText = typeof runState.input.value === 'string'

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
        <div className="gap-2 flex flex-col">
          <Textarea
            placeholder="Empty"
            value={content}
            readOnly
            className='nowheel nodrag max-h-32'
          />

          {isText && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsMarkdownDialogOpen(true)}
            >
              <Text /> View as Markdown
            </Button>
          )}
        </div>

        <Dialog open={isMarkdownDialogOpen} onOpenChange={setIsMarkdownDialogOpen}>
          <DialogContent className="min-w-[80vw] max-w-[80vw] min-h-[90vh] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{props.data.config.name} - Markdown View</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-4">
              <MarkdownRenderer content={runState.input.value} />
            </div>
          </DialogContent>
        </Dialog>
      </BaseNode>
    );
  }
};
