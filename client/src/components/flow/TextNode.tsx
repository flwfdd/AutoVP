/*
 * @Author: flwfdd
 * @Date: 2025-02-06 13:43:27
 * @LastEditTime: 2025-02-11 13:18:36
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardBody, Divider, Textarea, Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import {
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

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
            <Popover placement="top">
              <PopoverTrigger>
                <Button isIconOnly size="sm" variant='light' >
                  <QuestionMarkCircleIcon className='p-1' />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="px-1 py-2">
                  Text node provides a text source.
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
            isClearable
            placeholder="Enter text"
            value={text}
            onChange={onChange}
            onClear={() => { onChange({ target: { value: '' } }) }}
            className='nowheel nodrag'
          />
        </CardBody>
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