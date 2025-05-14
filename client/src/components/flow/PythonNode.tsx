import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import config from '@/lib/config';
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeRunLog, INodeState, INodeType, useNodeUIContext } from "@/lib/flow/flow";
import { generateId } from '@/lib/utils';
import {
  Position
} from '@xyflow/react';
import axios, { AxiosError } from 'axios';
import { Code, XCircle } from "lucide-react";
import React, { useCallback, useMemo, useState } from 'react';
import { z } from "zod";
import BaseNode from './base/BaseNode';
import CodeEditorDialog from './editor/CodeEditorDialog';

const PythonNodeInputSchema = BaseNodeInputSchema.catchall(z.any());
type IPythonNodeInput = z.infer<typeof PythonNodeInputSchema>;

const PythonNodeOutputSchema = BaseNodeOutputSchema.extend({
  output: z.string().describe('output of the code'),
});
type IPythonNodeOutput = z.infer<typeof PythonNodeOutputSchema>;

const codeDescription = `
The code is placed in a main function with the params.
For example, if there is a param called "name", and we want to output the result of "Hello, {name}!", the code should be:
\`\`\`python
return f"Hello, {name}!"
\`\`\`
Then the real code is:
\`\`\`python
def main(name):
  return f"Hello, {name}!"
\`\`\`
However, you **should not** output the main function, just output the code in it directly.
The 3rd-party packages you can use are: requests, numpy, matplotlib.
If you want to output an image, you should convert the image to a url or base64 src then return it.
`;

const PythonNodeConfigSchema = BaseNodeConfigSchema.extend({
  params: z.array(
    z.object({
      id: z.string().describe('id of the param, corresponding to an input key'),
      name: z.string().describe('name of the param, used in the code'),
    })
  ).describe('parameters to pass to the code'),
  code: z.string().describe(codeDescription),
});
type IPythonNodeConfig = z.infer<typeof PythonNodeConfigSchema>;

interface IPythonNodeState extends INodeState { }

interface ExecutionResult {
  output: string | null;
  exit_code: number | null;
  error: string | null;
  duration_seconds: number | null;
}

async function runPythonCode(code: string): Promise<ExecutionResult> {
  try {
    const response = await axios.post<ExecutionResult>(`${config.apiUrl}/python-runner`, { code });
    return response.data;
  } catch (e: any) {
    console.error("Error calling Python API:", e);
    let errorMessage = "Failed to connect to Python execution service.";
    if (axios.isAxiosError(e)) {
      const error = e as AxiosError<ExecutionResult>;
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = `Python API Error: ${error.response.data.error}`;
      } else if (error.response) {
        errorMessage = `Python API request failed: ${error.response.status} ${error.response.statusText}`;
      } else if (error.request) {
        errorMessage = "Python API request made but no response received.";
      } else {
        errorMessage = error.message;
      }
    } else if (e.message) {
      errorMessage = e.message;
    }
    return {
      output: null,
      exit_code: -1,
      error: errorMessage,
      duration_seconds: null,
    };
  }
}

export const PythonNodeType: INodeType<IPythonNodeConfig, IPythonNodeState, IPythonNodeInput, IPythonNodeOutput> = {
  configSchema: PythonNodeConfigSchema,
  inputSchema: PythonNodeInputSchema,
  outputSchema: PythonNodeOutputSchema,
  id: 'python',
  name: 'Python',
  description: 'Python node runs code in a function.\nYou can use the inputs as variables directly.\nThe value returned will be the output.',
  defaultConfig: { name: 'New Python', description: '', code: '', params: [] },
  defaultState: { highlight: false },
  logFormatter: ((config: IPythonNodeConfig, _state: INodeState, log: INodeRunLog<IPythonNodeInput, IPythonNodeOutput>) => {
    return {
      ...log,
      // 将input的key转换为param的name
      input: JSON.stringify(Object.entries(log.input).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[config.params?.find(param => param.id === key)?.name || key] = value;
        return acc;
      }, {}), null, 2),
      output: JSON.stringify(log.output?.output, null, 2),
      error: log.error || '',
    };
  }),
  ui: PythonNodeUI,
  async run(context: INodeContext<IPythonNodeConfig, IPythonNodeState, IPythonNodeInput>): Promise<IPythonNodeOutput> {
    let params = [];

    for (const param of context.config.params) {
      if (context.input[param.id] === undefined) {
        throw new Error(`Input ${param.name} is undefined.`);
      }
      params.push(`${param.name} = ${JSON.stringify(context.input[param.id])}`);
    }

    const mainCode = `def main(${params.join(',')}):\n${context.config.code.replace(/^/gm, '  ')}`;

    const fullCode = `import json\n${mainCode}\nprint(json.dumps(main(),ensure_ascii=False))`;
    console.log("Executing Python code:\n", fullCode);

    const result = await runPythonCode(fullCode);

    if (result.error || (result.exit_code !== null && result.exit_code !== 0)) {
      const errorMessage = `Python script execution failed (Exit Code: ${result.exit_code}):\n${result.error || result.output || 'No error message provided.'}`;
      throw new Error(errorMessage);
    }

    if (result.output === null) {
      throw new Error('No output from Python script.');
    }

    return { output: JSON.parse(result.output) };
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

function PythonNodeUI(props: INodeProps<IPythonNodeConfig, IPythonNodeState, IPythonNodeInput, IPythonNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const systemPrompt = useMemo(() => {
    return `You are an expert python programmer. Your task is to help the user with their code.
${codeDescription}
Available params are: ${config.params.map(param => param.name).join(', ')}.`;
  }, [config.params]);

  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ code: evt.target.value });
  }, [setConfig]);

  const handleEditorCodeSave = useCallback((newCode: string) => {
    setConfig({ code: newCode });
  }, [setConfig]);

  const onAddParam = useCallback(() => {
    const newParams = [...config.params, { id: generateId(), name: `var${config.params.length + 1}` }];
    setConfig({ params: newParams });
  }, [config, setConfig]);

  const onPramChange = useCallback((id: string, evt: React.ChangeEvent<HTMLInputElement>) => {
    const newParams = config.params.map(param => param.id === id ? { ...param, name: evt.target.value } : param);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  const onRemoveParam = useCallback((id: string) => {
    const newParams = config.params.filter(param => param.id !== id);
    setConfig({ params: newParams });
  }, [config, setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={PythonNodeType}
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
      <Button variant="outline" className='w-full' onClick={onAddParam}>
        Add Input
      </Button>
      <Separator className='my-2' />
      <Textarea
        placeholder='Python Code'
        value={config.code}
        onChange={onCodeChange}
        className='nowheel nodrag'
      />
      <Button variant="outline" className='w-full mt-2' onClick={() => setIsEditorOpen(true)}>
        <Code /> Code Editor
      </Button>
      <Separator className='my-2' />
      <CodeEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        code={config.code}
        onCodeChange={handleEditorCodeSave}
        language="python"
        title="Edit Python Code"
        systemPrompt={systemPrompt}
      />
    </BaseNode>
  );
}