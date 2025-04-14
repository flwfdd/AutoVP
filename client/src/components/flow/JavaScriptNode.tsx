/*
 * @Author: flwfdd
 * @Date: 2025-02-06 13:43:27
 * @LastEditTime: 2025-02-11 13:26:51
 * @Description: _(:з」∠)_
 */
import React, { useCallback } from 'react';
import { Card, CardHeader, CardBody, Divider, Textarea, Input, Spacer, Popover, PopoverTrigger, PopoverContent, CircularProgress } from "@heroui/react";
import {
  Edge,
  NodeProps,
  Position,
  useReactFlow,
} from '@xyflow/react';
import LabelHandle from './LabelHandle';
import { Button } from '@heroui/button';
import { PlayCircleIcon, QuestionMarkCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
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
        size="sm"
        placeholder="Var Name"
        className="text-xs"
        value={name}
        color={name ? undefined : 'warning'}
        onChange={(evt) => onPramChange(index, evt)}
      />
      <Button
        isIconOnly
        size="sm"
        variant='light'
        onPress={() => { onRemoveParam(index) }}
      >
        <XCircleIcon className='p-1' />
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
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
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
  } ,[params, code, outputHandleId, updateNodeData]);

  return (
    <div>
      <Card className="focus:ring-2 overflow-visible">
        <CardHeader className='flex items-center justify-between'>
          <div className='flex items-center space-x-1'>
            <span>JavaScript</span>
            <Popover placement="top">
              <PopoverTrigger>
                <Button isIconOnly size="sm" variant='light' >
                  <QuestionMarkCircleIcon className='p-1' />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="px-1 py-2">
                  JavaScript node runs JavaScript code. <br />
                  You can use the input parameters as variables in your code. <br />
                  The value of the last expression will be the output.
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className='flex items-center space-x-1'>
            <Button isIconOnly size="sm" variant='light' onPress={onRun} isDisabled={running}>
              {running ? <CircularProgress size="sm" strokeWidth={4} className='p-1' aria-label='running'/> : <PlayCircleIcon className='p-1' />}
            </Button>
          </div>
        </CardHeader>

        <Divider className='mb-2' />
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
        <CardBody className='pb-0'>
          <Button size="sm" variant='shadow' onPress={() => onAddParam()}>
            Add Input
          </Button>
          <Divider className='my-2' />
          <Textarea
            placeholder='JavaScript Code'
            isClearable
            value={code}
            onChange={onCodeChange}
            onClear={() => setCode('')}
            className='nowheel nodrag'
          />
          <Divider className='my-2' />
        </CardBody>

        <LabelHandle
          id={outputHandleId}
          type="source"
          position={Position.Right}
          label="Output"
          className='mb-2'
        />
        <Spacer className='h-2' />
      </Card>
    </div>
  );
}

export default JavaScriptNode;