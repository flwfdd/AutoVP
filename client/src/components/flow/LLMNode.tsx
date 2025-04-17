import React, { useCallback } from 'react';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import { PlayCircle } from "lucide-react";
import { toast } from 'sonner';
import { OpenAI } from 'openai';
import BaseNode from './base/BaseNode';

interface LLMNodeProps extends NodeProps {
  data: {
    prompt: string,
    output: { [key: string]: any },
  };
}

function LLMNode(props: LLMNodeProps) {
  // Init Output
  const { updateNodeData } = useReactFlow();
  const [outputHandleId] = React.useState(String(Math.random()));
  // Init LLM
  const [prompt, setPrompt] = React.useState('');
  const openai = new OpenAI({
    apiKey: '',
    dangerouslyAllowBrowser: true,
  });

  const [running, setRunning] = React.useState(false);
  const onRun = useCallback(async () => {
    setRunning(true);
    // Run
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      const output = response.choices[0].message.content;

      console.log(output);

      updateNodeData(props.id, { output: { [outputHandleId]: output } });
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [prompt, outputHandleId, updateNodeData, props.id]);

  return (
    <BaseNode
      {...props}
      title="LLM"
      description="LLM node runs Large Language Models."
      handles={[
        {
          type: 'target',
          position: Position.Left,
          limit: 1,
          onChange: (prompt) => { setPrompt(prompt) }
        },
        {
          id: outputHandleId,
          type: 'source',
          position: Position.Right,
          label: "Output",
        }
      ]}
      actions={[
        {
          icon: running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />,
          onClick: onRun,
          disabled: running,
          tooltip: "Run LLM"
        }
      ]}
    />
  );
}

export default LLMNode;