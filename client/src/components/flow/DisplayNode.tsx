/*
 * @Author: flwfdd
 * @Date: 2025-02-07 16:11:04
 * @LastEditTime: 2025-04-16 01:29:22
 * @Description: _(:з」∠)_
 */
import React from 'react';
import {
  NodeProps,
  Position,
} from '@xyflow/react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import LabelHandle from './LabelHandle';

interface DisplayNodeProps extends NodeProps {
}

function DisplayNode({ }: DisplayNodeProps) {
  const [text, setText] = React.useState('');

  return (
    <div>
      <Card className="focus:ring-2 overflow-visible">
        <LabelHandle
          type="target"
          limit={1}
          position={Position.Left}
          onChange={(display) => { setText(display) }}
        />
        <CardHeader className='flex items-center justify-between'>
          <div className='flex items-center space-x-1'>
            <span>Display</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Display node displays the output.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <Textarea
            placeholder="Empty"
            value={text}
            readOnly
            className='nowheel nodrag'
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default DisplayNode;