import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import React, { useCallback } from 'react';
import BaseNode from './BaseNode';
interface IStartNodeInput extends INodeIO { }
interface IStartNodeOutput extends INodeIO {
  text: string;
}
interface IStartNodeConfig extends INodeConfig {
  text: string;
}
interface IStartNodeState extends INodeState { }

export const StartNodeType: INodeType<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput> = {
  id: 'start',
  name: 'Start',
  description: 'Start node is the only starting node of the flow.',
  defaultConfig: { name: 'Start', description: '', text: '' },
  defaultState: {},
  ui: StartNodeUI,
  async run(context: INodeContext<IStartNodeConfig, IStartNodeState, IStartNodeInput>): Promise<IStartNodeOutput> {
    return { text: context.config.text };
  }
};

function StartNodeUI(props: INodeProps<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput>) {
  const { config, setConfig } = useNodeUIContext(props);
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ text: evt.target.value });
  }, [setConfig]);

  return (
    <BaseNode
      {...props}
      nodeType={StartNodeType}
      handles={[
        {
          id: 'text',
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Enter text"
        value={config.text}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}
