/*
 * @Author: flwfdd
 * @Date: 2025-02-11 12:35:34
 * @LastEditTime: 2025-04-15 01:42:23
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, PlayCircle } from "lucide-react";
import {
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { toast } from 'sonner';
import { OpenAI } from 'openai';

interface LLMNodeProps extends NodeProps {
  data: {
    prompt: string,
    output: { [key: string]: any },
  };
}

function LLMNode({ id }: LLMNodeProps) {
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

      updateNodeData(id, { output: { [outputHandleId]: output } });
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [prompt, outputHandleId, updateNodeData]);

  return (
    <div>
      <Card className="focus:ring-2 overflow-visible">
        <LabelHandle
          type="target"
          limit={1}
          position={Position.Left}
          onChange={(prompt) => { setPrompt(prompt) }}
        />
        <CardHeader className='flex items-center justify-between'>
          <div className='flex items-center space-x-1'>
            <span>LLM</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>LLM node runs Large Language Models.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRun} disabled={running}>
              {running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        <CardContent className='pb-0'>
        </CardContent>

        <LabelHandle
          id={outputHandleId}
          type="source"
          position={Position.Right}
          label="Output"
          className='mb-2'
        />
        <div className="h-2" />
      </Card>
    </div>
  );
}

export default LLMNode;