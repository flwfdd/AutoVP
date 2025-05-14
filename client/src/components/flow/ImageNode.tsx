import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext } from '@/lib/flow/flow';
import { Position } from '@xyflow/react';
import { z } from "zod";
import BaseNode from './base/BaseNode';

const ImageNodeInputSchema = BaseNodeInputSchema.extend({
  src: z.string().describe('URL or Base64 source of the image'),
});
type IImageNodeInput = z.infer<typeof ImageNodeInputSchema>;

const ImageNodeOutputSchema = BaseNodeOutputSchema.extend({});
type IImageNodeOutput = z.infer<typeof ImageNodeOutputSchema>;

const ImageNodeConfigSchema = BaseNodeConfigSchema.extend({});
type IImageNodeConfig = z.infer<typeof ImageNodeConfigSchema>;

interface IImageNodeState extends IBaseNodeState { }

export const ImageNodeType: INodeType<IImageNodeConfig, IImageNodeState, IImageNodeInput, IImageNodeOutput> = {
  configSchema: ImageNodeConfigSchema,
  inputSchema: ImageNodeInputSchema,
  outputSchema: ImageNodeOutputSchema,
  id: 'image',
  name: 'Image',
  description: 'Displays an image from a URL or Base64 source.',
  defaultConfig: {
    name: 'New Image',
    description: '',
  },
  defaultState: { highlight: false },
  ui: ImageNodeUI,
  async run(_context: INodeContext<IImageNodeConfig, IImageNodeState, IImageNodeInput>): Promise<IImageNodeOutput> {
    return {};
  }
};

function ImageNodeUI(props: INodeProps<IImageNodeConfig, IImageNodeState, IImageNodeInput, IImageNodeOutput>) {
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