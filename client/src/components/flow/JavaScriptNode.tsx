/*
 * @Author: flwfdd
 * @Date: 2025-02-06 13:43:27
 * @LastEditTime: 2025-04-17 19:28:17
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlayCircle, XCircle } from "lucide-react";
import {
  Edge,
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import BaseNode from './base/BaseNode';
import { toast } from 'sonner';
import { workerEval } from '@/lib/utils';

interface JavaScriptNodeProps extends NodeProps {
  data: {
    code: string,
    output: { [key: string]: any },
    edges: Edge[],
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  };
}

const ParamLabel = React.memo(({
  index,
  name,
  onPramChange,
  onRemoveParam
}: {
  index: number;
  name: string;
  onPramChange: (index: number, evt: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveParam: (index: number) => void;
}) => {
  return (
    <div className="flex items-center justify-center space-x-2 p-1">
      <Input
        placeholder="Input Name"
        className="text-xs nowheel nodrag"
        value={name}
        onChange={(evt) => onPramChange(index, evt)}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { onRemoveParam(index) }}
      >
        <XCircle />
      </Button>
    </div>
  );
});

function JavaScriptNode(props: JavaScriptNodeProps) {
  // Init Output
  const { updateNodeData } = useReactFlow();
  const [outputHandleId] = React.useState(String(Math.random()));
  // Init code editor
  const [code, setCode] = React.useState(props.data.code || '');
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(evt.target.value);
  }, []);

  // Init input params
  const [params, setParams] = React.useState<{ id: string, name: string, value: any }[]>([]);

  const onAddParam = useCallback(() => {
    setParams([...params, { id: String(Math.random()), name: '', value: '' }]);
  }, [params]);

  const onPramChange = useCallback((index: number, evt: React.ChangeEvent<HTMLInputElement>) => {
    setParams(prevParams => {
      const newParams = [...prevParams];
      newParams[index].name = evt.target.value;
      return newParams;
    });
  }, []);

  const onRemoveParam = useCallback((index: number) => {
    const paramId = params[index].id;
    props.data.setEdges((prevEdges) => prevEdges.filter((edge) => edge.sourceHandle !== paramId && edge.targetHandle !== paramId));
    setParams((prevParams) => prevParams.filter((_, i) => i !== index));
  }, [params, props.data.setEdges]);

  const [running, setRunning] = React.useState(false);
  const onRun = useCallback(async () => {
    setRunning(true);

    try {
      const output = await workerEval(code, params);
      updateNodeData(props.id, { output: { [outputHandleId]: output } });
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [params, code, outputHandleId, updateNodeData, props.id]);

  return (
    <BaseNode
      {...props}
      title="JavaScript"
      description="JavaScript node runs JavaScript code. You can use the input parameters as variables in your code. The value of the last expression will be the output."
      handles={[
        ...params.map((param, index) => ({
          id: param.id,
          type: 'target' as const,
          position: Position.Left,
          limit: 1,
          onChange: (value: any) => {
            params[index].value = value;
            setParams(params);
          },
          label: <ParamLabel
            index={index}
            name={param.name}
            onPramChange={onPramChange}
            onRemoveParam={onRemoveParam}
          />
        })),
        {
          id: outputHandleId,
          type: 'source' as const,
          position: Position.Right,
          label: "Output",
          className: 'mb-2'
        }
      ]}
      actions={[
        {
          icon: running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />,
          onClick: onRun,
          disabled: running,
          tooltip: "Run code"
        }
      ]}
    >
      <Button variant="outline" className='w-full' onClick={() => onAddParam()}>
        Add Input
      </Button>
      <Separator className='my-2' />
      <Textarea
        placeholder='JavaScript Code'
        value={code}
        onChange={onCodeChange}
        className='nowheel nodrag'
      />
      <Separator className='my-2' />
    </BaseNode>
  );
}

export default JavaScriptNode;