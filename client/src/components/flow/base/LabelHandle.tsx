import { generateId } from '@/lib/utils';
import { Handle, HandleProps, useNodeConnections } from '@xyflow/react';
import { useState } from 'react';

const flexDirections = {
  top: "flex-col pt-2",
  right: "flex-row-reverse pr-2",
  bottom: "flex-col-reverse pb-2",
  left: "flex-row pl-2",
};

interface LabelHandleProps extends HandleProps {
  label?: React.ReactNode; // 显示标签
  limit?: number; // 最大连接数
  // onChange?: (output: any) => void; // 数据更新回调 用于实时同步上下游数据
}


const LabelHandle = (props: LabelHandleProps) => {
  const [id] = useState(props.id ? props.id : generateId());
  const connections = useNodeConnections({ handleId: id, handleType: props.type });

  // // 当上游数据更新时通知下游
  // const sourceNodeData = useNodesData(connections[0]?.source) as { data: { output: { [key: string]: any } } } | null;
  // useEffect(() => {
  //   if (props.onChange && sourceNodeData?.data.output && connections[0].sourceHandle) {
  //     props.onChange(sourceNodeData.data.output[connections[0].sourceHandle]);
  //   }
  // }, [sourceNodeData]);

  const handle = (<Handle
    {...props}
    id={id}
    isConnectable={props.limit ? connections.length < props.limit : true}
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