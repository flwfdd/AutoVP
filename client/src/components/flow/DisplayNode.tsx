/*
 * @Author: flwfdd
 * @Date: 2025-02-07 16:11:04
 * @LastEditTime: 2025-02-07 16:36:15
 * @Description: _(:з」∠)_
 */
import React from 'react';
import { Card, CardHeader, CardBody, Divider, Textarea, Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import {
  NodeProps,
  Position,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

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
            <Popover placement="top">
              <PopoverTrigger>
                <Button isIconOnly size="sm" variant='light' >
                  <QuestionMarkCircleIcon className='p-1' />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="px-1 py-2">
                  Display node displays the output.
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className='flex items-center space-x-1'>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <Textarea
            placeholder="Empty"
            value={text}
            isReadOnly
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default DisplayNode;