/*
 * @Author: flwfdd
 * @Date: 2025-02-06 13:43:27
 * @LastEditTime: 2025-04-16 02:09:56
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, PlayCircle, XCircle } from "lucide-react";
import {
  Edge,
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { toast } from 'sonner';

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
        placeholder="Var Name"
        className="text-xs"
        value={name}
        onChange={(evt) => onPramChange(index, evt)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => { onRemoveParam(index) }}
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  );
});

function JavaScriptNode({ id, data }: JavaScriptNodeProps) {
  // Init Output
  const { updateNodeData } = useReactFlow();
  const [outputHandleId] = React.useState(String(Math.random()));
  // Init code editor
  const [code, setCode] = React.useState(data.code || '');
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
    data.setEdges((prevEdges) => prevEdges.filter((edge) => edge.sourceHandle !== paramId && edge.targetHandle !== paramId));
    setParams((prevParams) => prevParams.filter((_, i) => i !== index));
  }, [params, data.setEdges]);

  const [running, setRunning] = React.useState(false);
  const onRun = useCallback(() => {
    setRunning(true);
    let evalCode = '';
    // Compile params
    params.forEach((param) => {
      evalCode += `const ${param.name} = ${JSON.stringify(param.value)};`;
    });
    // Append user code
    evalCode += '\n' + code;
    // Run
    try {
      const output = eval(evalCode);
      updateNodeData(id, { output: { [outputHandleId]: output } });
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [params, code, outputHandleId, updateNodeData]);

  return (
    <div>
      <Card className="focus:ring-2 overflow-visible">
        <CardHeader className='flex items-center justify-between'>
          <div className='flex items-center space-x-1'>
            <span>JavaScript</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>JavaScript node runs JavaScript code.</p>
                <p>You can use the input parameters as variables in your code.</p>
                <p>The value of the last expression will be the output.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRun} disabled={running}>
              {running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        <Separator className='mb-2' />
        {
          params.map((param, index) => (
            <LabelHandle
              key={param.id}
              id={param.id}
              type="target"
              limit={1}
              position={Position.Left}
              onChange={(value) => {
                params[index].value = value;
                setParams(params);
              }}
              label={<ParamLabel
                index={index}
                name={param.name}
                onPramChange={onPramChange}
                onRemoveParam={onRemoveParam}
              />}
            />
          ))
        }
        <CardContent className='pb-0'>
          <Button variant="outline" size="sm" onClick={() => onAddParam()}>
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
        </CardContent>

        <LabelHandle
          id={outputHandleId}
          type="source"
          position={Position.Right}
          label="Output"
          className='mb-2'
        />
        <div className="h-2" />
      </Card>
    </div>
  );
}

export default JavaScriptNode;