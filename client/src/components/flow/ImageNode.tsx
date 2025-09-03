import { BaseNodeConfigSchema, BaseNodeDefaultState, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const ImageNodeInputSchema = BaseNodeInputSchema.extend({
  src: z.string().describe('URL or Base64 source of the image'),
});
type IImageNodeInput = z.infer<typeof ImageNodeInputSchema>;

const ImageNodeOutputSchema = BaseNodeOutputSchema.describe('No output handle');
type IImageNodeOutput = z.infer<typeof ImageNodeOutputSchema>;

const ImageNodeConfigSchema = BaseNodeConfigSchema;
type IImageNodeConfig = z.infer<typeof ImageNodeConfigSchema>;

type IImageNodeState = IBaseNodeState;

export const ImageNodeType: INodeType<IImageNodeConfig, IImageNodeState, IImageNodeInput, IImageNodeOutput> = {
  configSchema: ImageNodeConfigSchema,
  inputSchema: ImageNodeInputSchema,
  outputSchema: ImageNodeOutputSchema,
  inputHandlesGetter: () => new Set(['src']),
  outputHandlesGetter: () => new Set(),
  id: 'image',
  name: 'Image',
  description: 'Displays an image from a URL or Base64 source.\nCan be used to visualize something.',
  defaultConfig: {
    name: 'New Image',
    description: '',
  },
  defaultState: BaseNodeDefaultState,
  async run() {
    return {};
  },
  ui: function ImageNodeUI(props: INodeProps<IImageNodeConfig, IImageNodeState, IImageNodeInput, IImageNodeOutput>) {
    const { runState, config } = useNodeUIContext(props);
    const imageSrc = runState.input.src;

    return (
      <BaseNode
        {...props}
        nodeType={ImageNodeType}
        handles={[
          {
            id: 'src',
            type: 'target',
            position: Position.Left,
          }
        ]}
      >
        <div className="flex justify-center items-center">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={config.name}
              className="rounded-md"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Empty</span>
          )}
        </div>
      </BaseNode>
    );
  }
};
