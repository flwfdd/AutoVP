import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeRunLog, INodeState, INodeType, useNodeUIContext } from "@/lib/flow/flow";
import { generateId, workerEval } from '@/lib/utils';
import {
  Position
} from '@xyflow/react';
import { Code, XCircle } from "lucide-react";
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import BaseNode from './base/BaseNode';
import CodeEditorDialog from './editor/CodeEditorDialog';

const BranchNodeInputSchema = BaseNodeInputSchema.extend({
  input: z.any().describe('input to the branch node'),
});
type IBranchNodeInput = z.infer<typeof BranchNodeInputSchema>;

const BranchNodeOutputSchema = BaseNodeOutputSchema.catchall(z.any());
type IBranchNodeOutput = z.infer<typeof BranchNodeOutputSchema>;

const codePrompt = `
Branch nodes can distribute input to different output ports based on conditions. You can use JavaScript code to control the flow.

The code will be executed within an async function. You can directly use the following variables:
- input: The input data passed to the branch node
- All branch names as variables (e.g., if a branch is named "branchA", you can use the branchA variable directly)

The return value determines the output flow:
1. Return a single branch name: e.g., \`return branchA;\` - sends the input data to that branch
2. Return an array of branch names: e.g., \`return [branchA, branchB];\` - sends the input data to multiple branches
3. Return an object: e.g., \`return {branchA: input.x, branchB: 'some data'};\` - sends different data to different branches

Examples:
\`\`\`javascript
// Simple conditional branch
if (input % 2 === 0) {
  return branchA;
} else {
  return branchB;
}

// Send to multiple branches
return [branchA, branchB];

// Send different content to different branches
return {
  branchA: input.value,
  branchB: input.value % 2 === 0 ? 'even' : 'odd'
};
\`\`\`
`;

const BranchNodeConfigSchema = BaseNodeConfigSchema.extend({
  code: z.string().describe(codePrompt),
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const systemPrompt = useMemo(() => {
    return `You are a professional JavaScript programmer. Your task is to help the user write branch condition logic code.
Please think step by step and explain your analysis and plan, You need to answer in the language of the user's question.
${codePrompt}
Available branch names: ${config.branches.map(branch => branch.name).join(', ')}`;
  }, [config.branches]);

  // 编辑代码更新data
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ code: evt.target.value });
  }, [setConfig]);

  const handleEditorCodeSave = useCallback((newCode: string) => {
    setConfig({ code: newCode });
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
        className='nowheel nodrag whitespace-pre-wrap break-all'
      />
      <Button variant="outline" className='w-full mt-2' onClick={() => setIsEditorOpen(true)}>
        <Code /> Code Editor
      </Button>
      <Separator className='my-2' />
      <Button variant="outline" className='w-full' onClick={() => onAddBranch()}>
        Add Branch
      </Button>
      <CodeEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        code={config.code}
        onCodeChange={handleEditorCodeSave}
        language="javascript"
        title="Edit Branch Condition Code"
        systemPrompt={systemPrompt}
      />
    </BaseNode>
  );
}