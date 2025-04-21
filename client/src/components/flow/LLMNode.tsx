import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
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


interface ILLMNodeInput extends INodeIO {
  [key: string]: any
}
interface ILLMNodeOutput extends INodeIO {
  [key: string]: any
}
interface ILLMNodeConfig extends INodeConfig {
}
interface ILLMNodeState extends INodeState { }

export const LLMNodeType: INodeType<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput> = {
  id: 'llm',
  name: 'LLM',
  description: 'LLM node runs Large Language Models.',
  defaultConfig: { name: 'New LLM' },
  defaultState: {},
  ui: LLMNodeUI,
  async run(context: INodeContext<ILLMNodeConfig, ILLMNodeState, ILLMNodeInput>): Promise<ILLMNodeOutput> {
    // const response = await openai.chat.completions.create({
    //   model: '',
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
          limit: 1,
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