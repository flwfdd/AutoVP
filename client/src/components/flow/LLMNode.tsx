import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { PlayCircle } from "lucide-react";
import { toast } from 'sonner';
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
interface ILLMNodeData extends INodeData {
}
interface ILLMNodeState extends INodeState {
  running: boolean;
}

export const LLMNodeType: INodeType<ILLMNodeData, ILLMNodeState, ILLMNodeInput, ILLMNodeOutput> = {
  id: 'llm',
  name: 'LLM',
  description: 'LLM node runs Large Language Models.',
  defaultData: {},
  defaultState: { running: false },
  ui: LLMNodeElement,
  async run(context: INodeContext<ILLMNodeData, ILLMNodeState, ILLMNodeInput>): Promise<ILLMNodeOutput> {
    context.updateState({ running: true });
    let output: any;
    try {
      // const response = await openai.chat.completions.create({
      //   model: '',
      //   messages: [
      //     { role: 'system', content: 'You are a helpful assistant.' },
      //     { role: 'user', content: context.input.prompt },
      //   ],
      // });
      const response = await fakeLLM(context.input.prompt);
      output = response.choices[0].message.content;
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      context.updateState({ running: false });
    }
    return { output: output };
  }
};

function LLMNodeElement(props: INodeProps<ILLMNodeData, ILLMNodeState>) {
  return (
    <BaseNode
      {...props}
      title="LLM"
      description="LLM node runs Large Language Models."
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
      actions={[
        {
          icon: props.data.state.running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />,
          onClick: () => { },
          disabled: props.data.state.running,
          tooltip: "Run LLM"
        }
      ]}
    />
  );
}