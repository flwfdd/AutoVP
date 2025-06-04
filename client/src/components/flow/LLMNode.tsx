import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import configGlobal from '@/lib/config';
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { llm } from '@/lib/llm';
import { Position } from '@xyflow/react';
import { useCallback } from 'react';
import { z } from 'zod';
import { Textarea } from "../ui/textarea";
import BaseNode from './base/BaseNode';

const LLMNodeInputSchema = BaseNodeInputSchema.extend({
  prompt: z.any().describe('prompt to send to the LLM, if the prompt is not a string, it will be converted to a string by JSON.stringify'),
});
type ILLMNodeInput = z.infer<typeof LLMNodeInputSchema>;

const LLMNodeOutputSchema = BaseNodeOutputSchema.extend({
  output: z.string().describe('output of the LLM'),
});
type ILLMNodeOutput = z.infer<typeof LLMNodeOutputSchema>;

const LLMNodeConfigSchema = BaseNodeConfigSchema.extend({
  systemPrompt: z.string().describe('system prompt to send to the LLM'),
  model: z.string().describe('model to use, available models: ' + configGlobal.llm.models.join(', ')),
});
type ILLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;

interface ILLMNodeState extends IBaseNodeState { }

export const LLMNodeType: INodeType<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput> = {
  configSchema: LLMNodeConfigSchema,
  inputSchema: LLMNodeInputSchema,
  outputSchema: LLMNodeOutputSchema,
  id: 'llm',
  name: 'LLM',
  description: 'LLM node runs Large Language Models.',
  defaultConfig: {
    name: 'New LLM',
    description: '',
    systemPrompt: '',
    model: configGlobal.llm.models.length > 0 ? configGlobal.llm.models[0] : ''
  },
  defaultState: { highlight: false },
  ui: LLMNodeUI,
  async run(context: INodeContext<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput>): Promise<ILLMNodeOutput> {
    if (!context.config.model) {
      throw new Error("No LLM model selected or configured.");
    }
    const response = await llm(context.config.model, [
      { role: 'system', content: context.config.systemPrompt },
      { role: 'user', content: typeof context.input.prompt === 'string' ? context.input.prompt : JSON.stringify(context.input.prompt) },
    ]);
    return { output: response || '' };
  }
};

function LLMNodeUI(props: INodeProps<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);

  const handleModelChange = useCallback((modelValue: string) => {
    setConfig({ model: modelValue });
  }, [setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={LLMNodeType}
      handles={[
        {
          id: 'prompt',
          type: 'target',
          position: Position.Left,
        },
        {
          id: 'output',
          type: 'source',
          position: Position.Right,
          label: "Output",
        }
      ]}
    >
      <div className="nodrag flex flex-col gap-2 p-2">
        <Label htmlFor={`llm-system-prompt-input-${props.id}`}>System Prompt</Label>
        <Textarea
          id={`llm-system-prompt-input-${props.id}`}
          value={config.systemPrompt}
          onChange={(e) => setConfig({ systemPrompt: e.target.value })}
          className="nowheel nodrag whitespace-pre-wrap break-all max-h-32"
        />
        <Label htmlFor={`llm-model-select-${props.id}`}>Model</Label>
        <Select
          value={config.model}
          onValueChange={handleModelChange}
        >
          <SelectTrigger id={`llm-model-select-${props.id}`} className="w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {configGlobal.llm.models.map((modelId) => (
              <SelectItem key={modelId} value={modelId}>
                {modelId}
              </SelectItem>
            ))}
            {configGlobal.llm.models.length === 0 && (
              <SelectItem value="no-models" disabled>
                No models configured
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </BaseNode>
  );
}