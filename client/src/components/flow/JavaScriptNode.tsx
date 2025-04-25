import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from "@/lib/flow/flow";
import { generateId, workerEval } from '@/lib/utils';
import {
  Position
} from '@xyflow/react';
import { XCircle } from "lucide-react";
import React, { useCallback } from 'react';
import BaseNode from './base/BaseNode';

interface IJavaScriptNodeInput extends INodeIO {
  [key: string]: any
}
interface IJavaScriptNodeOutput extends INodeIO {
  output: any;
}
interface IJavaScriptNodeConfig extends INodeConfig {
  params: { id: string, name: string }[];
  code: string;
}
interface IJavaScriptNodeState extends INodeState { }

export const JavaScriptNodeType: INodeType<IJavaScriptNodeConfig, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput> = {
  id: 'javascript',
  name: 'JavaScript',
  description: 'JavaScript node runs JavaScript code in an async function. You can use the input parameters as variables in your code. The value returned will be the output.',
  defaultConfig: { name: 'New JavaScript', code: '', params: [] },
  defaultState: {},
  ui: JavaScriptNodeUI,
  async run(context: INodeContext<IJavaScriptNodeConfig, IJavaScriptNodeState, IJavaScriptNodeInput>): Promise<IJavaScriptNodeOutput> {
    const params = context.config.params.reduce<Record<string, any>>((acc, param) => {
      acc[param.name] = context.input[param.id];
      return acc;
    }, {});
    const output = await workerEval(context.config.code, params);
    return { output: output };
  }
};

const ParamLabel = React.memo(({
  id,
  name,
  onPramChange,
  onRemoveParam
}: {
  id: string;
  name: string;
  onPramChange: (id: string, evt: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveParam: (id: string) => void;
}) => {
  return (
    <div className="flex items-center justify-center space-x-2 p-1">
      <Input
        placeholder="Input Name"
        className="text-xs nowheel nodrag"
        value={name}
        onChange={(evt) => onPramChange(id, evt)}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { onRemoveParam(id) }}
      >
        <XCircle />
      </Button>
    </div>
  );
});

function JavaScriptNodeUI(props: INodeProps<IJavaScriptNodeConfig, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);

  // 编辑代码更新data
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ code: evt.target.value });
  }, [setConfig]);

  // 添加输入参数 id作为输入map的key不会变
  const onAddParam = useCallback(() => {
    const newParams = [...config.params, { id: generateId(), name: '' }];
    setConfig({ params: newParams });
  }, [config, setConfig]);

  // 编辑输入参数
  const onPramChange = useCallback((id: string, evt: React.ChangeEvent<HTMLInputElement>) => {
    const newParams = config.params.map(param => param.id === id ? { ...param, name: evt.target.value } : param);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  // 删除输入参数
  const onRemoveParam = useCallback((id: string) => {
    const newParams = config.params.filter(param => param.id !== id);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={JavaScriptNodeType}
      handles={[
        ...config.params.map(param => ({
          id: param.id,
          type: 'target' as const,
          position: Position.Left,
          limit: 1,
          // // 输入参数值变化时回调
          // onChange: (value: any) => {
          //   params[index].value = value;
          //   setParams(params);
          // },
          label: <ParamLabel
            id={param.id}
            name={param.name}
            onPramChange={onPramChange}
            onRemoveParam={onRemoveParam}
          />
        })),
        {
          id: 'output',
          type: 'source' as const,
          position: Position.Right,
          label: "Output",
          className: 'mb-2'
        }
      ]}
    >
      <Button variant="outline" className='w-full' onClick={() => onAddParam()}>
        Add Input
      </Button>
      <Separator className='my-2' />
      <Textarea
        placeholder='JavaScript Code'
        value={config.code}
        onChange={onCodeChange}
        className='nowheel nodrag'
      />
      <Separator className='my-2' />
    </BaseNode>
  );
}