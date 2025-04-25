import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INodeConfig, INodeIO, INodeProps, INodeRunLog, INodeState, INodeStateRun, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { useReactFlow } from '@xyflow/react';
import { CircleAlert, CircleCheckBig, Hourglass, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import LabelHandle from './LabelHandle';

interface RunStateDialogButtonProps<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO> {
  nodeType: INodeType<C, S, I, O>;
  config: C;
  state: S;
  runState: INodeStateRun<I, O> | undefined;
}

function RunStateDialogButton<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO>(
  { nodeType, config, state, runState }: RunStateDialogButtonProps<C, S, I, O>
) {
  const logFormatter = useMemo(() => nodeType.logFormatter || ((_config: C, _state: S, log: INodeRunLog<I, O>) => {
    return {
      input: JSON.stringify(log.input, null, 2),
      output: JSON.stringify(log.output, null, 2),
    };
  }), [nodeType.logFormatter]);

  const formattedLogs = useMemo(() => runState?.logs.map((log) => {
    const formattedLog = logFormatter(config, state, log);
    return {
      ...log,
      input: formattedLog.input,
      output: formattedLog.output,
    };
  }), [runState?.logs, logFormatter, config, state]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          {!runState || runState?.status === 'idle' && <Hourglass className="h text-gray-600" />}
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
            {config.description}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {formattedLogs && formattedLogs.length ?
            formattedLogs.map((log, index) => (
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
                  <pre className="flex-1 text-sm  overflow-auto whitespace-pre-wrap">{log.input}</pre>
                  <pre className="flex-1 text-sm  overflow-auto whitespace-pre-wrap">{log.output}</pre>
                </div>
              </div>
            ))
            : (
              <p className="text-center text-muted-foreground">No run log yet.</p>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditNodeDialogProps<C extends INodeConfig> {
  nodeType: INodeType<any, any, any, any>;
  config: C;
  setConfig: (newConfig: Partial<C>) => void;
}

function EditNodeDialog<C extends INodeConfig>(
  { nodeType, config, setConfig }: EditNodeDialogProps<C>
) {
  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    setConfig({ ...config, name, description });
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      setName(config.name);
      setDescription(config.description || '');
    }
  }, [isOpen, config]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">{nodeType.name}</Badge>
            Edit Node: {config.name}
          </DialogTitle>
          <DialogDescription>
            Update the node's display name and description here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-1">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BaseNode<C extends INodeConfig, S extends INodeState, I extends INodeIO, O extends INodeIO>(props: INodeProps<C, S, I, O>) {
  const { nodeType, handles = [], children } = props;
  const { setEdges } = useReactFlow();
  const prevHandlesRef = useRef<string[]>([]);
  const { config, state, runState, setConfig } = useNodeUIContext(props);

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
        <CardHeader className="flex items-center justify-between p-2">
          <div className="flex items-center gap-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">{nodeType.name}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs whitespace-pre-wrap'>{nodeType.description || `${nodeType.name} node`}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className='text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis'>{config.name}</span>
              </TooltipTrigger>
              {config.description && (
                <TooltipContent>
                  <p className='max-w-xs whitespace-pre-wrap'>{config.description}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
          <div className="flex items-center">
            <EditNodeDialog
              nodeType={nodeType}
              config={config}
              setConfig={setConfig}
            />
            <RunStateDialogButton
              nodeType={nodeType}
              config={config}
              state={state}
              runState={runState}
            />
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