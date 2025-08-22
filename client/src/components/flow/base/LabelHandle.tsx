import { generateId } from '@/lib/utils';
import { Handle, HandleProps, useNodeConnections } from '@xyflow/react';
import { useMemo, useState } from 'react';

const flexDirections = {
  top: "flex-col pt-2",
  right: "flex-row-reverse pr-2",
  bottom: "flex-col-reverse pb-2",
  left: "flex-row pl-2",
};

interface LabelHandleProps extends HandleProps {
  label?: React.ReactNode; // 显示标签
  limit?: number; // 最大连接数
}


const LabelHandle = (props: LabelHandleProps) => {
  const [id] = useState(props.id ? props.id : generateId());
  const connections = useNodeConnections({ handleId: id, handleType: props.type })
  const limit = useMemo(() => props.limit !== undefined ? props.limit : props.type === 'target' ? 1 : 0, [props.limit, props.type])

  const handle = (<Handle
    {...props}
    id={id}
    isConnectable={limit ? connections.length < limit : true}
  />)

  return props.label ? (
    <div className={`relative flex items-center text-sm ${flexDirections[props.position]}`}>
      {handle}
      {props.label}
    </div>
  ) : (
    handle
  );
};

export default LabelHandle;