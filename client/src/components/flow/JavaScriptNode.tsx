import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from "@/lib/flow/flow";
import { workerEval } from '@/lib/utils';
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
interface IJavaScriptNodeData extends INodeData {
  params: { id: string, name: string }[];
  code: string;
}
interface IJavaScriptNodeState extends INodeState { }

export const JavaScriptNodeType: INodeType<IJavaScriptNodeData, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput> = {
  id: 'javascript',
  name: 'JavaScript',
  description: 'JavaScript node runs JavaScript code in an async function. You can use the input parameters as variables in your code. The value returned will be the output.',
  defaultData: { code: '', params: [] },
  defaultState: {},
  ui: JavaScriptNodeUI,
  async run(context: INodeContext<IJavaScriptNodeData, IJavaScriptNodeState, IJavaScriptNodeInput>): Promise<IJavaScriptNodeOutput> {
    const params = context.data.params.reduce<Record<string, any>>((acc, param) => {
      acc[param.name] = context.input[param.id];
      return acc;
    }, {});
    const output = await workerEval(context.data.code, params);
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

function JavaScriptNodeUI(props: INodeProps<IJavaScriptNodeData, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput>) {
  const { data, setData } = useNodeUIContext(props);

  // 编辑代码更新data
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setData({ code: evt.target.value });
  }, [setData]);

  // 添加输入参数 id作为输入map的key不会变
  const onAddParam = useCallback(() => {
    const newParams = [...data.params, { id: String(Math.random()), name: '' }];
    setData({ params: newParams });
  }, [data, setData]);

  // 编辑输入参数
  const onPramChange = useCallback((id: string, evt: React.ChangeEvent<HTMLInputElement>) => {
    const newParams = data.params.map(param => param.id === id ? { ...param, name: evt.target.value } : param);
    setData({ params: newParams });
  }, [data, setData]);

  // 删除输入参数
  const onRemoveParam = useCallback((id: string) => {
    const newParams = data.params.filter(param => param.id !== id);
    setData({ params: newParams });
  }, [data, setData]);

  return (
    <BaseNode
      {...props}
      title="JavaScript"
      description="JavaScript node runs JavaScript code. You can use the input parameters as variables in your code. The value of the last expression will be the output."
      handles={[
        ...data.params.map(param => ({
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
        value={data.code}
        onChange={onCodeChange}
        className='nowheel nodrag'
      />
      <Separator className='my-2' />
    </BaseNode>
  );
}