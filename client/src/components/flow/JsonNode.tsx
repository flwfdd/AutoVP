import { Textarea } from "@/components/ui/textarea";
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeRunLog, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import React, { useCallback, useState } from 'react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const JsonNodeInputSchema = BaseNodeInputSchema.extend({});
type IJsonNodeInput = z.infer<typeof JsonNodeInputSchema>;

const JsonNodeOutputSchema = BaseNodeOutputSchema.extend({
  json: z.any().describe('json value to output'),
});
type IJsonNodeOutput = z.infer<typeof JsonNodeOutputSchema>;

const JsonNodeConfigSchema = BaseNodeConfigSchema.extend({
  json: z.any().describe('json value to output'),
});
type IJsonNodeConfig = z.infer<typeof JsonNodeConfigSchema>;

interface IJsonNodeState extends IBaseNodeState { }

export const JsonNodeType: INodeType<IJsonNodeConfig, IJsonNodeState, IJsonNodeInput, IJsonNodeOutput> = {
  inputSchema: JsonNodeInputSchema,
  outputSchema: JsonNodeOutputSchema,
  configSchema: JsonNodeConfigSchema,
  id: 'json',
  name: 'JSON',
  description: 'JSON node provides a json value source.',
  defaultConfig: { name: 'New JSON', description: '', json: {} },
  defaultState: { highlight: false },
  logFormatter: (_config: IJsonNodeConfig, _state: IJsonNodeState, log: INodeRunLog<IJsonNodeInput, IJsonNodeOutput>) => ({
    input: 'No input',
    output: log.output?.json ?? '',
    error: log.error ?? ''
  }),
  ui: JsonNodeUI,
  async run(context: INodeContext<IJsonNodeConfig, IJsonNodeState, IJsonNodeInput>): Promise<IJsonNodeOutput> {
    return { json: context.config.json };
  }
};

function JsonNodeUI(props: INodeProps<IJsonNodeConfig, IJsonNodeState, IJsonNodeInput, IJsonNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);
  const [jsonText, setJsonText] = useState(JSON.stringify(config.json, null, 2));
  const [invalidJson, setInvalidJson] = useState(false);
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const json = JSON.parse(evt.target.value);
      setConfig({ json });
      setJsonText(JSON.stringify(json, null, 2));
      setInvalidJson(false);
    } catch (error) {
      setJsonText(evt.target.value);
      setInvalidJson(true);
    }
  }, [setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={JsonNodeType}
      handles={[
        {
          id: 'json',
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Enter json"
        value={jsonText}
        onChange={onChange}
        className={`nowheel nodrag max-h-32 ${invalidJson ? ' focus-visible:ring-red-500/50' : ''}`}
      />
      {invalidJson && (
        <p className="text-xs text-red-500 mt-1">Invalid JSON</p>
      )}
    </BaseNode>
  );
}
