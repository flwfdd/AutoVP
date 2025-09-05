import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IBaseNodeConfig, IBaseNodeInput, IBaseNodeOutput, IBaseNodeState, INodeProps, useNodeUIContext } from '@/lib/flow/flow';
import { cn } from "@/lib/utils";
import { useReactFlow } from '@xyflow/react';
import { CircleAlert, CircleCheckBig, Hourglass, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import NodeRunLogDetail from "../log/NodeRunLogDetail";
import LabelHandle from './LabelHandle';
import EditInfoDialog from '../editor/EditInfoDialog';


function BaseNode<C extends IBaseNodeConfig, S extends IBaseNodeState, I extends IBaseNodeInput, O extends IBaseNodeOutput>(props: INodeProps<C, S, I, O>) {
  const { nodeType, handles = [], children } = props;
  const { setEdges } = useReactFlow();
  const prevHandlesRef = useRef<string[]>([]);
  const { config, state, runState, setConfig, setState } = useNodeUIContext(props);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const currentHandles = handles.map(handle => handle.id);
    const prevHandles = prevHandlesRef.current;
    const removedHandles = prevHandles.filter(handle => !currentHandles.includes(handle));
    if (removedHandles.length > 0) {
      setEdges(prevEdges => prevEdges.filter(edge => !removedHandles.includes(edge.sourceHandle || '') && !removedHandles.includes(edge.targetHandle || '')));
    }
    prevHandlesRef.current = currentHandles;
  }, [handles, setEdges]);

  const handleFocus = () => {
    setState({ ...state, reviewed: true });
  };

  const hasDescription = config.description && config.description.trim().length > 0;

  const handleSaveEdit = (name: string, description: string) => {
    setConfig({ ...config, name, description });
  };

  return (
    <div>
      <Card
        className={cn("focus:ring focus:ring-ring p-0 pb-2 gap-0 w-60", state.highlight && "ring-2 ring-orange-600 animate-pulse", !state.reviewed && "ring-2 ring-purple-500/50")}
        tabIndex={-1}
        onFocus={handleFocus}
      >
        <CardHeader className="flex items-center justify-between p-2 pb-0">
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
              <TooltipContent>
                <p className='max-w-xs whitespace-pre-wrap'>{config.name}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              title="Edit Node Info"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Pencil />
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Run Log">
                  {!runState || runState?.status === 'idle' && <Hourglass className="h text-gray-600" />}
                  {runState?.status === 'running' && <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />}
                  {runState?.status === 'success' && <CircleCheckBig className="h-4 w-4 text-green-600" />}
                  {runState?.status === 'error' && <CircleAlert className="h-4 w-4 text-red-600" />}
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-[80vw]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm">{nodeType.name}</Badge>
                    {config.name}
                  </DialogTitle>
                  <DialogDescription>
                    {config.description}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh]">
                  <NodeRunLogDetail
                    nodeType={nodeType}
                    config={config}
                    state={state}
                    runState={runState}
                  />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        {hasDescription && (
          <Button
            variant="ghost"
            size="sm"
            className="mx-1 p-2 text-sm text-left h-auto"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            title={isDescriptionExpanded ? "Collapse description" : "Expand description"}
          >
            <p className={cn("w-full", isDescriptionExpanded ? "whitespace-pre-wrap" : "truncate")}>
              {config.description}
            </p>
          </Button>
        )}

        <Separator className="mt-1" />
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

      <EditInfoDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Edit Node"
        subtitle={`Type: ${nodeType.name}`}
        name={config.name}
        descriptionText={config.description || ''}
        contextPrompt={`Node Type: ${nodeType.name}
Node Name: ${config.name}
Node Description: ${config.description || 'No description'}
Node Config: ${JSON.stringify(config)}`}
        onSave={handleSaveEdit}
      />
    </div >
  );
}

export default BaseNode; 