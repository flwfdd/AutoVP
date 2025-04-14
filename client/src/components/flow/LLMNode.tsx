/*
 * @Author: flwfdd
 * @Date: 2025-02-11 12:35:34
 * @LastEditTime: 2025-04-15 01:42:23
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardBody, Spacer, Popover, PopoverTrigger, PopoverContent, CircularProgress } from "@heroui/react";
import {
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { Button } from '@heroui/button';
import { PlayCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
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
            <Popover placement="top">
              <PopoverTrigger>
                <Button isIconOnly size="sm" variant='light' >
                  <QuestionMarkCircleIcon className='p-1' />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="px-1 py-2">
                  LLM node runs Large Language Models.
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className='flex items-center space-x-1'>
            <Button isIconOnly size="sm" variant='light' onPress={onRun} isDisabled={running}>
              {running ? <CircularProgress size="sm" strokeWidth={4} className='p-1' aria-label='running' /> : <PlayCircleIcon className='p-1' />}
            </Button>
          </div>
        </CardHeader>

        <CardBody className='pb-0'>
        </CardBody>

        <LabelHandle
          id={outputHandleId}
          type="source"
          position={Position.Right}
          label="Output"
          className='mb-2'
        />
        <Spacer className='h-2' />
      </Card>
    </div>
  );
}

export default LLMNode;