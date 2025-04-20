import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INodeData, INodeIO, INodeProps, INodeState } from '@/lib/flow/flow';
import { useReactFlow } from '@xyflow/react';
import { CircleAlert, CircleCheckBig, HelpCircle, Hourglass, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import LabelHandle from './LabelHandle';

function BaseNode<D extends INodeData, S extends INodeState, I extends INodeIO, O extends INodeIO>({ title, description, handles = [], children, data }: INodeProps<D, S, I, O>) {
  const { setEdges } = useReactFlow();
  const prevHandlesRef = useRef<string[]>([]);

  // 移除Handle的同时移除连接的边
  useEffect(() => {
    const currentHandles = handles.map(handle => handle.id);
    const prevHandles = prevHandlesRef.current;
    const removedHandles = prevHandles.filter(handle => !currentHandles.includes(handle));
    if (removedHandles.length > 0) {
      setEdges(prevEdges => prevEdges.filter(edge => !removedHandles.includes(edge.sourceHandle || '') && !removedHandles.includes(edge.targetHandle || '')));
    }
    prevHandlesRef.current = currentHandles;
  }, [handles, setEdges]);
  return (
    <div>
      <Card className="focus:ring focus:ring-ring p-0 pb-2 gap-0 w-60" tabIndex={-1}>
        <CardHeader className='flex items-center justify-between px-4 py-2'>
          <div className='flex items-center space-x-1'>
            <span>{title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs'>{description || `${title} node`}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
            {data.runState?.status === 'idle' && <Hourglass className="h-4 w-4" />}
            {data.runState?.status === 'running' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {data.runState?.status === 'success' && <CircleCheckBig className="h-4 w-4" />}
            {data.runState?.status === 'error' && <CircleAlert className="h-4 w-4" />}
          </div>
        </CardHeader>
        <Separator />
        {handles
          .filter((handle) => handle.type === 'target')
          .map((handle, index) => (
            <LabelHandle
              key={handle.id || index}
              id={handle.id}
              type={handle.type}
              position={handle.position}
              limit={handle.limit}
              label={handle.label}
              className={handle.className}
            />
          ))}
        <CardContent className='p-2'>
          {children}
        </CardContent>
        {handles
          .filter((handle) => handle.type === 'source')
          .map((handle, index) => (
            <LabelHandle
              key={handle.id || index}
              id={handle.id}
              type={handle.type}
              position={handle.position}
              limit={handle.limit}
              label={handle.label}
              className={handle.className}
            />
          ))}
      </Card>
    </div>
  );
}

export default BaseNode; 