import React from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { Textarea } from "@/components/ui/textarea";
import BaseNode from './base/BaseNode';

interface DisplayNodeProps extends NodeProps {
}

function DisplayNode(props: DisplayNodeProps) {
  const [text, setText] = React.useState('');

  return (
    <BaseNode
      {...props}
      title="Display"
      description="Display node displays the output."
      handles={[
        {
          type: 'target',
          position: Position.Left,
          limit: 1,
          onChange: (display) => { setText(display) }
        }
      ]}
    >
      <Textarea
        placeholder="Empty"
        value={text}
        readOnly
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}

export default DisplayNode;