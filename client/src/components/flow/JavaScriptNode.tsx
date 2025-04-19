import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { INodeContext, INodeData, INodeIO, INodeProps, INodeState, INodeType } from "@/lib/flow/flow";
import { workerEval } from '@/lib/utils';
import {
  Position,
  useReactFlow
} from '@xyflow/react';
import { PlayCircle, XCircle } from "lucide-react";
import React, { useCallback } from 'react';
import { toast } from 'sonner';
import BaseNode from './base/BaseNode';


interface IJavaScriptNodeInput extends INodeIO {
  [key: string]: any
}
interface IJavaScriptNodeOutput extends INodeIO {
  [key: string]: any
}
interface IJavaScriptNodeData extends INodeData {
  code: string;
}
interface IJavaScriptNodeState extends INodeState {
  running: boolean;
}

export const JavaScriptNodeType: INodeType<IJavaScriptNodeData, IJavaScriptNodeState, IJavaScriptNodeInput, IJavaScriptNodeOutput> = {
  id: 'javascript',
  name: 'JavaScript',
  description: 'JavaScript node runs JavaScript code in an async function. You can use the input parameters as variables in your code. The value returned will be the output.',
  defaultData: { code: '' },
  defaultState: { running: false },
  ui: JavaScriptNodeElement,
  async run(context: INodeContext<IJavaScriptNodeData, IJavaScriptNodeState, IJavaScriptNodeInput>): Promise<IJavaScriptNodeOutput> {
    context.updateState({ running: true });
    let output: any;
    try {
      output = await workerEval(context.data.code, context.input);
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      context.updateState({ running: false });
    }
    return { output: output };
  }
};

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

function JavaScriptNodeElement(props: INodeProps<IJavaScriptNodeData, IJavaScriptNodeState>) {
  // Init code editor
  const { updateNodeData } = useReactFlow();
  const [code, setCode] = React.useState(props.data.data.code || '');
  const onCodeChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(evt.target.value);
    updateNodeData(props.id, { data: { code: evt.target.value } });
  }, [props.id, updateNodeData]);

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

  return (
    <BaseNode
      {...props}
      title="JavaScript"
      description="JavaScript node runs JavaScript code. You can use the input parameters as variables in your code. The value of the last expression will be the output."
      handles={[
        ...params.map((param, index) => ({
          id: param.name,
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
          id: 'output',
          type: 'source' as const,
          position: Position.Right,
          label: "Output",
          className: 'mb-2'
        }
      ]}
      actions={[
        {
          icon: props.data.state.running ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlayCircle className="h-4 w-4" />,
          disabled: props.data.state.running,
          onClick: () => { },
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