/*
 * @Author: flwfdd
 * @Date: 2025-02-06 19:11:30
 * @LastEditTime: 2025-02-07 17:10:48
 * @Description: _(:з」∠)_
 */
import { Handle, HandleProps, useNodeConnections, useNodesData } from '@xyflow/react';
import { useEffect, useState } from 'react';

const flexDirections = {
  top: "flex-col pt-2",
  right: "flex-row-reverse pr-2",
  bottom: "flex-col-reverse pb-2",
  left: "flex-row pl-2",
};

interface LabelHandleProps extends HandleProps {
  label?: React.ReactNode;
  limit?: number; // Max number of connections
  onChange?: (output:any) => void; // Update data from source node
}


const LabelHandle = (props: LabelHandleProps) => {
  const [id] = useState(props.id ? props.id : String(Math.random()));
  const connections = useNodeConnections({handleId:id, handleType: props.type});

  const sourceNodeData = useNodesData(connections[0]?.source) as { data: { output: { [key: string]: any } } } | null;

  useEffect(() => {
    if (props.onChange && sourceNodeData?.data.output && connections[0].sourceHandle) {
      props.onChange(sourceNodeData.data.output[connections[0].sourceHandle]);
    }
  }, [sourceNodeData]);

  const handle = (<Handle
    {...props}
    id={id}
    isConnectable={props.limit ? connections.length < props.limit : true}
  />)

  return props.label ? (
    <div className={`relative flex items-center ${flexDirections[props.position]}`}>
      {handle}
      {props.label}
    </div>
  ) : (
    handle
  );
};

export default LabelHandle;