import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { generateId } from '@/lib/utils';
import { Position } from '@xyflow/react';
import { XCircle } from "lucide-react";
import React, { useCallback } from 'react';
import { z } from 'zod';
import BaseNode from './BaseNode';

const StartNodeInputSchema = z.record(z.any());
type IStartNodeInput = z.infer<typeof StartNodeInputSchema>;

const StartNodeOutputSchema = BaseNodeOutputSchema;
type IStartNodeOutput = z.infer<typeof StartNodeOutputSchema>;

const StartNodeConfigSchema = BaseNodeConfigSchema.extend({
  params: z.array(
    z.object({
      id: z.string().describe('id of the param, corresponding to an output key'),
      name: z.string().describe('name of the param, used as output key'),
    })
  ).describe('parameters to output from the start node'),
  defaultValue: z.string().describe('default value for the start node when not used as subflow'),
});
type IStartNodeConfig = z.infer<typeof StartNodeConfigSchema>;

interface IStartNodeState extends INodeState {
  defaultValue: any;
}

export const StartNodeType: INodeType<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput> = {
  inputSchema: StartNodeInputSchema,
  outputSchema: StartNodeOutputSchema,
  configSchema: StartNodeConfigSchema,
  id: 'start',
  name: 'Start',
  description: 'Start node is the starting node of the flow with customizable output parameters.',
  defaultConfig: { name: 'Start', description: '', params: [], defaultValue: '' },
  defaultState: { highlight: false, defaultValue: '' },
  ui: StartNodeUI,
  async run(context: INodeContext<IStartNodeConfig, IStartNodeState, IStartNodeInput>): Promise<IStartNodeOutput> {
    // 如果有输入（作为子流程）则使用输入，否则使用默认值或参数
    if (context.input && Object.keys(context.input).length > 0) {
      // 作为子流程时，将输入映射到输出参数（输出键使用稳定的 param.id，避免重命名导致断连）
      const output: Record<string, any> = {};
      context.config.params.forEach(param => {
        output[param.id] = context.input[param.id] ?? null;
      });
      return output;
    } else {
      // 独立运行时，如果有参数则输出空值，否则输出默认值
      if (context.config.params.length > 0) {
        const output: Record<string, any> = {};
        context.config.params.forEach(param => {
          output[param.id] = null;
        });
        return output;
      } else {
        return { value: context.state.defaultValue };
      }
    }
  }
};

const ParamLabel = React.memo(({
  id,
  name,
  onParamChange,
  onRemoveParam
}: {
  id: string;
  name: string;
  onParamChange: (id: string, evt: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveParam: (id: string) => void;
}) => {
  return (
    <div className="flex items-center justify-center space-x-2 p-1">
      <Input
        placeholder="Output Name"
        className="text-xs nowheel nodrag"
        value={name}
        onChange={(evt) => onParamChange(id, evt)}
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

function StartNodeUI(props: INodeProps<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput>) {
  const { config, setConfig, state, setState } = useNodeUIContext(props);

  const onDefaultValueChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ defaultValue: evt.target.value });
  }, [setState]);

  // 添加输出参数
  const onAddParam = useCallback(() => {
    const newParams = [...config.params, { id: generateId(), name: 'param' + (config.params.length + 1) }];
    setConfig({ params: newParams });
  }, [config, setConfig]);

  // 编辑输出参数
  const onParamChange = useCallback((id: string, evt: React.ChangeEvent<HTMLInputElement>) => {
    const newParams = config.params.map(param => param.id === id ? { ...param, name: evt.target.value } : param);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  // 删除输出参数
  const onRemoveParam = useCallback((id: string) => {
    const newParams = config.params.filter(param => param.id !== id);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={StartNodeType}
      handles={[
        ...(config.params.length > 0
          ? config.params.map(param => ({
            id: param.id, // 使用稳定的 id 作为 handle key，重命名不会影响连线
            type: 'source' as const,
            position: Position.Right,
            label: <ParamLabel
              id={param.id}
              name={param.name}
              onParamChange={onParamChange}
              onRemoveParam={onRemoveParam}
            />
          }))
          : [{
            id: 'value',
            type: 'source' as const,
            position: Position.Right,
            label: "Value"
          }]
        )
      ]}
    >
      <Button variant="outline" className='w-full' onClick={() => onAddParam()}>
        Add Output
      </Button>

      {config.params.length === 0 && (
        <>
          <Separator className='my-2' />
          <Textarea
            placeholder="Default value (when not used as subflow)"
            value={state.defaultValue}
            onChange={onDefaultValueChange}
            className='nowheel nodrag max-h-32'
          />
        </>
      )}
    </BaseNode>
  );
}
