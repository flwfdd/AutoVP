import { Textarea } from "@/components/ui/textarea";
import { INodeConfig, INodeContext, INodeIO, INodeProps, INodeState, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import React, { useCallback } from 'react';
import BaseNode from './BaseNode';
interface IStartNodeInput extends INodeIO { }
interface IStartNodeOutput extends INodeIO {
  value: any;
}
interface IStartNodeConfig extends INodeConfig { }
interface IStartNodeState extends INodeState {
  value: any;
}

export const StartNodeType: INodeType<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput> = {
  id: 'start',
  name: 'Start',
  description: 'Start node is the only starting node of the flow.',
  defaultConfig: { name: 'Start', description: '', text: '' },
  defaultState: { value: '' },
  ui: StartNodeUI,
  async run(context: INodeContext<IStartNodeConfig, IStartNodeState, IStartNodeInput>): Promise<IStartNodeOutput> {
    if (context.input === undefined) {
      throw new Error('No input');
    }
    return { value: Object.keys(context.input).length ? context.input : context.state.value };
  }
};

function StartNodeUI(props: INodeProps<IStartNodeConfig, IStartNodeState, IStartNodeInput, IStartNodeOutput>) {
  const { state, setState } = useNodeUIContext(props);
  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ value: evt.target.value });
  }, [setState]);

  return (
    <BaseNode
      {...props}
      nodeType={StartNodeType}
      handles={[
        {
          id: 'value',
          type: 'source',
          position: Position.Right
        }
      ]}
    >
      <Textarea
        placeholder="Input text"
        value={state.value}
        onChange={onChange}
        className='nowheel nodrag'
      />
    </BaseNode>
  );
}
