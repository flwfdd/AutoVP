/*
 * @Author: flwfdd
 * @Date: 2025-02-06 13:43:27
 * @LastEditTime: 2025-04-16 01:31:25
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import {
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';

interface TextNodeProps extends NodeProps {
  data: { output: { [key: string]: any } };
}

function TextNode({ id }: TextNodeProps) {
  const [outputHandleId] = React.useState(String(Math.random()));
  const [text, setText] = React.useState('');
  const { updateNodeData } = useReactFlow();
  const onChange = useCallback((evt: any) => {
    setText(evt.target.value);
    updateNodeData(id, { output: { [outputHandleId]: evt.target.value } });
  }, []);

  return (
    <div>
      <Card className="focus:ring-2 overflow-visible">
        <CardHeader className='flex items-center justify-between'>
          <div className='flex items-center space-x-1'>
            <span>Text</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Text node provides a text source.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <Textarea
            placeholder="Enter text"
            value={text}
            onChange={onChange}
            className='nowheel nodrag'
          />
        </CardContent>
        <LabelHandle
          id={outputHandleId}
          type="source"
          position={Position.Right}
        />
      </Card>
    </div>
  );
}

export default TextNode;