import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from 'zod';
import BaseNode from './base/BaseNode';
// 初始化OpenAI
// const openai = new OpenAI({
//   baseURL: '',
//   apiKey: '',
//   dangerouslyAllowBrowser: true,
// });

const fakeLLM = async (prompt: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    choices: [{
      message: { content: 'Prompt: ' + prompt }
    }]
  }
}

const LLMNodeInputSchema = BaseNodeInputSchema.extend({
  prompt: z.string(),
});
type ILLMNodeInput = z.infer<typeof LLMNodeInputSchema>;

const LLMNodeOutputSchema = BaseNodeOutputSchema.extend({
  output: z.string(),
});
type ILLMNodeOutput = z.infer<typeof LLMNodeOutputSchema>;

const LLMNodeConfigSchema = BaseNodeConfigSchema.extend({});
type ILLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;

interface ILLMNodeState extends IBaseNodeState { }

export const LLMNodeType: INodeType<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput> = {
  configSchema: LLMNodeConfigSchema,
  inputSchema: LLMNodeInputSchema,
  outputSchema: LLMNodeOutputSchema,
  id: 'llm',
  name: 'LLM',
  description: 'LLM node runs Large Language Models.',
  defaultConfig: { name: 'New LLM', description: '' },
  defaultState: { highlight: false },
  ui: LLMNodeUI,
  async run(context: INodeContext<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput>): Promise<ILLMNodeOutput> {
    // const response = await openai.chat.completions.create({
    //   model: 'gpt-4.1-nano',
    //   messages: [
    //     { role: 'system', content: 'You are a helpful assistant.' },
    //     { role: 'user', content: context.input.prompt },
    //   ],
    // });
    const response = await fakeLLM(context.input.prompt);
    return { output: response.choices[0].message.content };
  }
};

function LLMNodeUI(props: INodeProps<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput>) {
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
    />
  );
}