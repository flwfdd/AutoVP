import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INodeConfig, INodeIO, INodeProps, INodeState, INodeStateRun, INodeType } from '@/lib/flow/flow';
import { useReactFlow } from '@xyflow/react';
import { CircleAlert, CircleCheckBig, Hourglass, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import LabelHandle from './LabelHandle';

interface RunStateDialogButtonProps<C extends INodeConfig, I extends INodeIO, O extends INodeIO> {
  nodeType: INodeType<any, any, any, any>;
  nodeId: string;
  config: C;
  runState: INodeStateRun<I, O> | undefined;
}

function RunStateDialogButton<C extends INodeConfig, I extends INodeIO, O extends INodeIO>(
  { nodeType, nodeId, config, runState }: RunStateDialogButtonProps<C, I, O>
) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className='flex-shrink-0 flex items-center space-x-1 p-1'>
          {!runState || runState?.status === 'idle' && <Hourglass className="h-4 w-4 text-gray-600" />}
          {runState?.status === 'running' && <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />}
          {runState?.status === 'success' && <CircleCheckBig className="h-4 w-4 text-green-600" />}
          {runState?.status === 'error' && <CircleAlert className="h-4 w-4 text-red-600" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">{nodeType.name}</Badge>
            {config.name}
          </DialogTitle>
          <DialogDescription>
            {nodeId}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {runState && runState.log.length ?
            runState.log.map((log, index) => (
              <div key={index} className="flex flex-col gap-2 bg-muted p-2 rounded-md">
                <div className="flex gap-2 justify-between">
                  <Badge variant="outline" className="text-xs text-center border-green-600 bg-green-600/10">
                    Input <br />
                    {log.startMs} ms
                  </Badge>
                  <Badge variant="outline" className="text-xs text-center border-yellow-600 bg-yellow-600/10">
                    Duration <br />
                    {log.endMs ? log.endMs - log.startMs : ''} ms
                  </Badge>
                  <Badge variant="outline" className="text-xs text-center border-red-600 bg-red-600/10">
                    Output <br />
                    {log.endMs} ms
                  </Badge>
                </div>
                <div className="flex gap-4">
                  <pre className="flex-1 text-sm  overflow-auto whitespace-pre-wrap">{JSON.stringify(log.input, null, 2)}</pre>
                  <pre className="flex-1 text-sm  overflow-auto whitespace-pre-wrap">{JSON.stringify(log.output, null, 2)}</pre>
                </div>
              </div>
            ))
            : (
              <p>No run state available yet.</p>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BaseNode<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO>({ id, nodeType, handles = [], children, data }: INodeProps<C, S, I, O>) {
  const { setEdges } = useReactFlow();
  const prevHandlesRef = useRef<string[]>([]);

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
        <CardHeader className='flex items-center justify-between p-2'>
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">{nodeType.name}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs whitespace-pre-wrap'>{nodeType.description || `${nodeType.name} node`}</p>
              </TooltipContent>
            </Tooltip>
            <div className='text font-medium whitespace-nowrap overflow-hidden text-ellipsis'>{data.config.name}</div>
          </div>
          <RunStateDialogButton
            nodeType={nodeType}
            nodeId={id}
            config={data.config}
            runState={data.runState}
          />
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