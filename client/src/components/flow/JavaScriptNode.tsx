import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeRunLog, INodeState, INodeType, useNodeUIContext } from "@/lib/flow/flow";
import { generateId, workerEval } from '@/lib/utils';
import {
  Position
} from '@xyflow/react';
import { XCircle } from "lucide-react";
import React, { useCallback } from 'react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const JavaScriptNodeInputSchema = BaseNodeInputSchema.catchall(z.any())
type IJavaScriptNodeInput = z.infer<typeof JavaScriptNodeInputSchema>;

const JavaScriptNodeOutputSchema = BaseNodeOutputSchema.extend({
  output: z.any(),
});
type IJavaScriptNodeOutput = z.infer<typeof JavaScriptNodeOutputSchema>;

const JavaScriptNodeConfigSchema = BaseNodeConfigSchema.extend({
  params: z.array(z.object({ id: z.string(), name: z.string() })),
  code: z.string(),
});
type IJavaScriptNodeConfig = z.infer<typeof JavaScriptNodeConfigSchema>;

interface IJavaScriptNodeState extends INodeState { }

export const JavaScriptNodeType: INodeType<IJavaScriptNodeConfig, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput> = {
  configSchema: JavaScriptNodeConfigSchema,
  inputSchema: JavaScriptNodeInputSchema,
  outputSchema: JavaScriptNodeOutputSchema,
  id: 'javascript',
  name: 'JavaScript',
  description: 'JavaScript node runs code in an async function.\nYou can use the inputs as variables directly.\nThe value returned will be the output.',
  defaultConfig: { name: 'New JavaScript', description: '', code: '', params: [] },
  defaultState: { highlight: false },
  logFormatter: ((config: IJavaScriptNodeConfig, _state: INodeState, log: INodeRunLog<IJavaScriptNodeInput, IJavaScriptNodeOutput>) => {
    return {
      ...log,
      // 将input的key转换为param的name
      input: JSON.stringify(Object.entries(log.input).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[config.params?.find(param => param.id === key)?.name || key] = value;
        return acc;
      }, {}), null, 2),
      output: JSON.stringify(log.output?.output, null, 2),
      error: log.error || ''
    };
  }),
  ui: JavaScriptNodeUI,
  async run(context: INodeContext<IJavaScriptNodeConfig, IJavaScriptNodeState, IJavaScriptNodeInput>): Promise<IJavaScriptNodeOutput> {
    const params = context.config.params.reduce<Record<string, any>>((acc, param) => {
      if (context.input[param.id] === undefined) {
        throw new Error(`Input ${param.name} is undefined`);
      }
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
    const newParams = [...config.params, { id: generateId(), name: 'var' + (config.params.length + 1) }];
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