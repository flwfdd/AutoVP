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
import { z } from 'zod';
import BaseNode from './base/BaseNode';

const BranchNodeInputSchema = BaseNodeInputSchema.extend({
  input: z.any(),
});
type IBranchNodeInput = z.infer<typeof BranchNodeInputSchema>;

const BranchNodeOutputSchema = BaseNodeOutputSchema.catchall(z.any());
type IBranchNodeOutput = z.infer<typeof BranchNodeOutputSchema>;

const BranchNodeConfigSchema = BaseNodeConfigSchema.extend({
  code: z.string(),
  branches: z.array(z.object({ id: z.string(), name: z.string() })),
});
type IBranchNodeConfig = z.infer<typeof BranchNodeConfigSchema>;

interface IBranchNodeState extends INodeState { }

export const BranchNodeType: INodeType<IBranchNodeConfig, IBranchNodeState, IBranchNodeInput, IBranchNodeOutput> = {
  configSchema: BranchNodeConfigSchema,
  inputSchema: BranchNodeInputSchema,
  outputSchema: BranchNodeOutputSchema,
  id: 'branch',
  name: 'Branch',
  description: 'Branch node outputs based on the condition.\nCondition code example for branches A & B:\n1. `return a`: send input to A\n2. `return [a, b]`: send input to A & B\n3. `return {a: 1, b: input.x}`: send 1 to A & input.x to B',
  defaultConfig: { name: 'New Branch', description: '', code: '', branches: [] },
  defaultState: { highlight: false },
  logFormatter: ((config: IBranchNodeConfig, _state: INodeState, log: INodeRunLog<IBranchNodeInput, IBranchNodeOutput>) => {
    return {
      ...log,
      input: JSON.stringify(log.input.input, null, 2),
      // 将output的key转换为branch的name
      output: JSON.stringify(Object.entries(log.output || {}).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[config.branches?.find(branch => branch.id === key)?.name || key] = JSON.stringify(value, null, 2);
        return acc;
      }, {}), null, 2),
      error: log.error || ''
    };
  }),
  ui: BranchNodeUI,
  async run(context: INodeContext<IBranchNodeConfig, IBranchNodeState, IBranchNodeInput>): Promise<IBranchNodeOutput> {
    const params = context.config.branches.reduce<Record<string, any>>((acc, branch) => {
      acc[branch.name] = branch.id;
      return acc;
    }, {});
    params.input = context.input.input;
    const output = await workerEval(context.config.code, params);
    console.log(params, output);
    if (typeof output === 'string') {
      return { [output]: context.input.input };
    } else if (Array.isArray(output)) {
      return output.reduce<IBranchNodeOutput>((acc, item) => {
        acc[item] = context.input.input;
        return acc;
      }, {});
    } else if (typeof output === 'object' && output !== null) {
      return Object.entries(output).reduce<IBranchNodeOutput>((acc, [key, value]) => {
        if (!params[key]) {
          throw new Error(`Branch "${key}" is not found`);
        }
        acc[params[key]] = value;
        return acc;
      }, {});
    } else {
      throw new Error('Condition output format error');
    }
  }
};

const BranchLabel = React.memo(({
  id,
  name,
  onBranchChange,
  onRemoveBranch
}: {
  id: string;
  name: string;
  onBranchChange: (id: string, evt: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBranch: (id: string) => void;
}) => {
  return (
    <div className="flex items-center justify-center space-x-2 p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { onRemoveBranch(id) }}
      >
        <XCircle />
      </Button>
      <Input
        placeholder="Branch Name"
        className="text-xs nowheel nodrag"
        value={name}
        onChange={(evt) => onBranchChange(id, evt)}
      />
    </div>
  );
});

function BranchNodeUI(props: INodeProps<IBranchNodeConfig, IBranchNodeState, IBranchNodeInput, IBranchNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);

  // 编辑代码更新data
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ code: evt.target.value });
  }, [setConfig]);

  // 添加输入参数 id作为输入map的key不会变
  const onAddBranch = useCallback(() => {
    const newBranches = [...config.branches, { id: generateId(), name: '' }];
    setConfig({ branches: newBranches });
  }, [config, setConfig]);

  // 编辑输入参数
  const onBranchChange = useCallback((id: string, evt: React.ChangeEvent<HTMLInputElement>) => {
    const newBranches = config.branches.map(branch => branch.id === id ? { ...branch, name: evt.target.value } : branch);
    setConfig({ branches: newBranches });
  }, [config, setConfig]);

  // 删除输入参数
  const onRemoveBranch = useCallback((id: string) => {
    const newBranches = config.branches.filter(branch => branch.id !== id);
    setConfig({ branches: newBranches });
  }, [config, setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={BranchNodeType}
      handles={[
        {
          id: 'input',
          type: 'target' as const,
          position: Position.Left,
        },
        ...config.branches.map(branch => ({
          id: branch.id,
          type: 'source' as const,
          position: Position.Right,
          label: <BranchLabel
            id={branch.id}
            name={branch.name}
            onBranchChange={onBranchChange}
            onRemoveBranch={onRemoveBranch}
          />
        })),

      ]}
    >
      <Textarea
        placeholder='Condition Code'
        value={config.code}
        onChange={onCodeChange}
        className='nowheel nodrag'
      />
      <Separator className='my-2' />
      <Button variant="outline" className='w-full' onClick={() => onAddBranch()}>
        Add Branch
      </Button>
    </BaseNode>
  );
}