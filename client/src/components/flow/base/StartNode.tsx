import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BaseNodeConfigSchema, BaseNodeOutputSchema, INodeContext, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { generateId } from '@/lib/utils';
import { Position } from '@xyflow/react';
import { XCircle, Plus, FlaskConical } from "lucide-react";
import React, { useCallback, useEffect, useState } from 'react';
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
      testValue: z.any().describe('test value for this parameter when running independently'),
    })
  ).describe('parameters to output from the start node'),
});
type IStartNodeConfig = z.infer<typeof StartNodeConfigSchema>;

interface IStartNodeState extends INodeState {
  highlight: boolean;
}

export const StartNodeType: INodeType<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput> = {
  inputSchema: StartNodeInputSchema,
  outputSchema: StartNodeOutputSchema,
  configSchema: StartNodeConfigSchema,
  id: 'start',
  name: 'Start',
  description: 'Start node is the starting node of the flow with customizable output parameters.',
  defaultConfig: { name: 'Start', description: '', params: [] },
  defaultState: { highlight: false },
  ui: StartNodeUI,
  async run(context: INodeContext<IStartNodeConfig, IStartNodeState, IStartNodeInput>): Promise<IStartNodeOutput> {
    if (context.input && Object.keys(context.input).length > 0) {
      // run as sub flow, map input to output params
      const output: Record<string, any> = {};
      context.config.params.forEach(param => {
        output[param.id] = context.input[param.id] ?? null;
      });
      return output;
    } else {
      // run independently, try using test values if available
      if (context.config.params.length > 0) {
        const output: Record<string, any> = {};
        context.config.params.forEach(param => {
          output[param.id] = param.testValue || null;
        });
        return output;
      } else {
        return {}; // return empty object if there are no params
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

const TestCaseDialog = React.memo(({
  isOpen,
  onClose,
  params,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  params: Array<{ id: string; name: string; testValue?: any }>;
  onSave: (params: Array<{ id: string; name: string; testValue?: any }>) => void;
}) => {
  const [localParams, setLocalParams] = useState(params);
  const [invalidJsonMap, setInvalidJsonMap] = useState<Record<string, boolean>>({});

  // when dialog is opened, sync params data
  useEffect(() => {
    if (isOpen) {
      setLocalParams(params);
      // reset validation state
      const newInvalidJsonMap: Record<string, boolean> = {};
      params.forEach(param => {
        newInvalidJsonMap[param.id] = false;
      });
      setInvalidJsonMap(newInvalidJsonMap);
    }
  }, [isOpen, params]);

  const handleParamChange = (id: string, field: 'name' | 'testValue', value: string) => {
    if (field === 'testValue') {
      try {
        const json = JSON.parse(value);
        setLocalParams(prev => prev.map(param =>
          param.id === id ? { ...param, [field]: json } : param
        ));
        setInvalidJsonMap(prev => ({ ...prev, [id]: false }));
      } catch (error) {
        setLocalParams(prev => prev.map(param =>
          param.id === id ? { ...param, [field]: value } : param
        ));
        setInvalidJsonMap(prev => ({ ...prev, [id]: true }));
      }
    } else {
      setLocalParams(prev => prev.map(param =>
        param.id === id ? { ...param, [field]: value } : param
      ));
    }
  };

  const handleSave = () => {
    // check if there are invalid JSONs
    const hasInvalidJson = Object.values(invalidJsonMap).some(invalid => invalid);
    if (hasInvalidJson) {
      return; // do not allow saving if there are invalid JSONs
    }
    onSave(localParams);
    onClose();
  };

  const handleCancel = () => {
    setLocalParams(params); // reset to original values
    onClose();
  };

  // check if can save (no invalid JSONs)
  const canSave = localParams.length > 0 && !Object.values(invalidJsonMap).some(invalid => invalid);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Test Cases</DialogTitle>
          <DialogDescription>
            Set test values for each output parameter, support JSON format, for independent running debugging
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          {<div className="space-y-2">
            {localParams.map(param => {
              const jsonText = typeof param.testValue === 'string' ? param.testValue : JSON.stringify(param.testValue, null, 2);
              const isInvalid = invalidJsonMap[param.id] || false;

              return (
                <div key={param.id} className="m-2">
                  <label className="block text-sm mb-1">{param.name}</label>
                  <Textarea
                    value={jsonText}
                    onChange={(e) => handleParamChange(param.id, 'testValue', e.target.value)}
                    className={`nowheel nodrag max-h-32 ${isInvalid ? ' focus-visible:ring-red-500/50' : ''}`}
                    placeholder="Enter JSON test value..."
                  />
                  {isInvalid && (
                    <p className="text-xs text-red-500 mt-1">Invalid JSON</p>
                  )}
                </div>
              );
            })}
          </div>}
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

function StartNodeUI(props: INodeProps<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);

  // 添加输出参数
  const onAddParam = useCallback(() => {
    const newParams = [...config.params, { id: generateId(), name: 'param' + (config.params.length + 1), testValue: {} }];
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

  // 保存测试用例
  const onSaveTestCases = useCallback((updatedParams: Array<{ id: string; name: string; testValue?: any }>) => {
    setConfig({ params: updatedParams });
  }, [setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={StartNodeType}
      handles={[
        ...(config.params.map(param => ({
          id: param.id,
          type: 'source' as const,
          position: Position.Right,
          label: <ParamLabel
            id={param.id}
            name={param.name}
            onParamChange={onParamChange}
            onRemoveParam={onRemoveParam}
          />
        }))
        )
      ]}
    >
      <div className="space-y-2">
        <Button variant="outline" className='w-full' onClick={() => onAddParam()}>
          <Plus />
          Add Param
        </Button>

        {config.params.length > 0 && (
          <Button
            variant="outline"
            className='w-full'
            onClick={() => setIsTestDialogOpen(true)}
          >
            <FlaskConical />
            Test Cases
          </Button>
        )}
      </div>

      <TestCaseDialog
        isOpen={isTestDialogOpen}
        onClose={() => setIsTestDialogOpen(false)}
        params={config.params}
        onSave={onSaveTestCases}
      />
    </BaseNode>
  );
}
