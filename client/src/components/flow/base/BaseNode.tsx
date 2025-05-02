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
import { INode, INodeConfig, INodeIO, INodeProps, INodeRunLog, INodeState, INodeStateRun, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { useReactFlow } from '@xyflow/react';
import { CircleAlert, CircleCheckBig, Hourglass, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import LabelHandle from './LabelHandle';
import NodeRunLogDetail from "../log/NodeRunLogDetail";


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

      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Node
          </DialogTitle>
          <DialogDescription>
            Type: {nodeType.name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
      </DialogContent >
    </Dialog >
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

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  {!runState || runState?.status === 'idle' && <Hourglass className="h text-gray-600" />}
                  {runState?.status === 'running' && <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />}
                  {runState?.status === 'success' && <CircleCheckBig className="h-4 w-4 text-green-600" />}
                  {runState?.status === 'error' && <CircleAlert className="h-4 w-4 text-red-600" />}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[600px]">
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
                  <NodeRunLogDetail
                    nodeType={nodeType}
                    config={config}
                    state={state}
                    runState={runState}
                  />
                </div>
              </DialogContent>
            </Dialog>
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