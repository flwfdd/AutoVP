import React, { useCallback } from 'react';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import { Textarea } from "@/components/ui/textarea";
import BaseNode from './base/BaseNode';

interface TextNodeProps extends NodeProps {
  data: { output: { [key: string]: any } };
}

function TextNode(props: TextNodeProps) {
  const [outputHandleId] = React.useState(String(Math.random()));
  const [text, setText] = React.useState('');
  const { updateNodeData } = useReactFlow();
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(evt.target.value);
    updateNodeData(props.id, { output: { [outputHandleId]: evt.target.value } });
  }, [props.id, outputHandleId, updateNodeData]);

  return (
    <BaseNode
      {...props}
      title="Text"
      description="Text node provides a text source."
      handles={[
        {
          id: outputHandleId,
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Enter text"
        value={text}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}

export default TextNode;