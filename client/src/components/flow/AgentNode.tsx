import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import configGlobal from '@/lib/config';
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext, runFlow, IRunFlowStack, defaultNodeRunState } from '@/lib/flow/flow';
import { react, ExecutableTool } from '@/lib/llm';
import { Position } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Textarea } from "../ui/textarea";
import BaseNode from './base/BaseNode';
import { MultiSelect } from '@/components/multi-select';
import { getFlowNodeTypes, useFlowNodeTypes } from "@/lib/flow/use-flow-node-types";

const AgentNodeInputSchema = BaseNodeInputSchema.extend({
    prompt: z.any().describe('prompt to send to the Agent, if the prompt is not a string, it will be converted to a string by JSON.stringify'),
});
type IAgentNodeInput = z.infer<typeof AgentNodeInputSchema>;

const AgentNodeOutputSchema = BaseNodeOutputSchema.extend({
    output: z.string().describe('final output of the Agent after tool usage'),
});
type IAgentNodeOutput = z.infer<typeof AgentNodeOutputSchema>;

const AgentNodeConfigSchema = BaseNodeConfigSchema.extend({
    systemPrompt: z.string().describe('system prompt to send to the Agent'),
    model: z.string().describe('model to use, available models: ' + configGlobal.llm.models.join(', ')),
    toolFlowIds: z.array(z.string()).describe('array of flow IDs to use as tools'),
    maxIterations: z.number().describe('maximum number of iterations for ReAct'),
});
type IAgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;

interface IAgentNodeState extends IBaseNodeState { }

export const AgentNodeType: INodeType<IAgentNodeConfig, IAgentNodeState, IAgentNodeInput, IAgentNodeOutput> = {
    configSchema: AgentNodeConfigSchema,
    inputSchema: AgentNodeInputSchema,
    outputSchema: AgentNodeOutputSchema,
    id: 'agent',
    name: 'Agent',
    description: 'Agent node runs LLM with ReAct pattern and can use subflows as tools.',
    defaultConfig: {
        name: 'New Agent',
        description: '',
        systemPrompt: 'You are a helpful AI agent that can use tools to help answer questions.',
        model: configGlobal.llm.models.length > 0 ? configGlobal.llm.models[0] : '',
        toolFlowIds: [],
        maxIterations: 10
    },
    defaultState: { highlight: false },
    ui: AgentNodeUI,
    async run(context: INodeContext<IAgentNodeConfig, IAgentNodeState, IAgentNodeInput>): Promise<IAgentNodeOutput> {
        if (!context.config.model) {
            throw new Error("No LLM model selected or configured.");
        }

        // If no tools are selected, just run as a simple LLM
        if (context.config.toolFlowIds.length === 0) {
            const { llm } = await import('@/lib/llm');
            const response = await llm(context.config.model, [
                { role: 'system', content: context.config.systemPrompt },
                { role: 'user', content: typeof context.input.prompt === 'string' ? context.input.prompt : JSON.stringify(context.input.prompt) },
            ]);
            return { output: response || 'No response generated' };
        }

        // Create tools from selected flows
        const tools: ExecutableTool[] = context.config.toolFlowIds.map(flowId => {
            const flowNodeType = getFlowNodeTypes().find(flow => flow.id === flowId);

            if (!flowNodeType) {
                throw new Error(`Flow with id "${flowId}" not found`);
            }

            // Get start node to determine input parameters
            const startNode = flowNodeType.nodes.find(node => node.type.id === 'start');
            const inputParams = startNode?.config.params || [];

            return {
                name: `flow_${flowId}`,
                description: flowNodeType.description || `Execute flow: ${flowNodeType.name}`,
                parameters: {
                    type: 'object',
                    properties: inputParams.reduce((acc: any, param: any) => {
                        acc[param.name] = {
                            type: 'string',
                            description: `Input parameter: ${param.name}`
                        };
                        return acc;
                    }, {}),
                    required: inputParams.map((param: any) => param.name)
                },
                execute: async (args: Record<string, any>) => {
                    try {
                        // Prepare input for the flow
                        let flowInput: any;
                        if (inputParams.length > 0) {
                            flowInput = {};
                            inputParams.forEach((param: any) => {
                                flowInput[param.id] = args[param.name];
                            });
                        } else {
                            flowInput = args;
                        }

                        // Execute the flow
                        const fakeUpdate = (_a: any, _b: any) => { };
                        const fakeRunNodes = flowNodeType.nodes.map(node => ({
                            ...node,
                            state: node.type.defaultState,
                            runState: defaultNodeRunState
                        }));

                        const flowStack: IRunFlowStack[] = context.flowStack.concat({
                            flow: {
                                id: flowNodeType.id,
                                name: flowNodeType.name,
                                description: flowNodeType.description,
                                nodes: flowNodeType.nodes,
                                edges: flowNodeType.edges
                            },
                            startTime: Date.now(),
                        });

                        const result = await runFlow(
                            flowInput,
                            fakeRunNodes,
                            flowNodeType.edges,
                            fakeUpdate,
                            fakeUpdate,
                            fakeUpdate,
                            flowStack
                        );

                        return JSON.stringify(result);
                    } catch (error: any) {
                        return `Error executing flow: ${error.message}`;
                    }
                }
            };
        });

        // Build system prompt for ReAct
        const systemPrompt = `${context.config.systemPrompt}

You are an AI agent that can use tools to help answer questions. When you need to use a tool, use the available tools.

Available tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Think step by step and use tools when necessary to provide accurate answers.`;

        // Use react function for tool calling
        const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: typeof context.input.prompt === 'string' ? context.input.prompt : JSON.stringify(context.input.prompt) },
        ];

        let finalResponse = '';

        // Collect all messages from the react execution
        const reactEvents = react(context.config.model, messages, tools, context.config.maxIterations);

        for await (const event of reactEvents) {
            if (event.type === 'llm_end') {
                finalResponse = event.message.content || '';
            }
            // We could also collect tool calls and their results here if needed
        }

        return { output: finalResponse || 'No response generated' };
    }
};

function AgentNodeUI(props: INodeProps<IAgentNodeConfig, IAgentNodeState, IAgentNodeInput, IAgentNodeOutput>) {
    const { config, setConfig } = useNodeUIContext(props);
    const { flowNodeTypes } = useFlowNodeTypes();

    // remove invalid flow ids from config.toolFlowIds
    useEffect(() => {
        const availableFlowIds = new Set(flowNodeTypes.map(f => f.id));
        const invalidFlowIds = config.toolFlowIds.filter(id => !availableFlowIds.has(id));

        if (invalidFlowIds.length > 0) {
            setConfig({
                toolFlowIds: config.toolFlowIds.filter(id => availableFlowIds.has(id))
            });
        }
    }, [flowNodeTypes, config.toolFlowIds, setConfig]);

    const handleModelChange = useCallback((modelValue: string) => {
        setConfig({ model: modelValue });
    }, [setConfig]);

    const handleMaxIterationsChange = useCallback((value: string) => {
        const num = parseInt(value);
        if (!isNaN(num) && num > 0) {
            setConfig({ maxIterations: num });
        }
    }, [setConfig]);

    const flowOptions = useMemo(() => flowNodeTypes.map(f => ({ value: f.id, label: f.name })), [flowNodeTypes]);

    return (
        <BaseNode
            {...props}
            nodeType={AgentNodeType}
            handles={[
                {
                    id: 'prompt',
                    type: 'target',
                    position: Position.Left,
                },
                {
                    id: 'output',
                    type: 'source',
                    position: Position.Right,
                    label: "Output",
                }
            ]}
        >
            <div className="nodrag flex flex-col gap-2 p-2">
                <Label className="text-sm">System Prompt</Label>
                <Textarea
                    value={config.systemPrompt}
                    onChange={(e) => setConfig({ systemPrompt: e.target.value })}
                    className="nowheel nodrag whitespace-pre-wrap break-all max-h-32"
                    placeholder="You are a helpful AI agent..."
                />

                <Label className="text-sm">Model</Label>
                <Select
                    value={config.model}
                    onValueChange={handleModelChange}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                        {configGlobal.llm.models.map((modelId) => (
                            <SelectItem key={modelId} value={modelId}>
                                {modelId}
                            </SelectItem>
                        ))}
                        {configGlobal.llm.models.length === 0 && (
                            <SelectItem value="no-models" disabled>
                                No models configured
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>

                <Label className="text-sm">Tool Flows</Label>
                <MultiSelect
                    options={flowOptions}
                    onValueChange={(values: string[]) => setConfig({ toolFlowIds: values })}
                    defaultValue={config.toolFlowIds}
                    placeholder="Select tool flows..."
                    searchable
                    maxWidth="200px"
                />

                {config.toolFlowIds.length > 0 && (
                    <>
                        <Label className="text-sm">Max Iterations</Label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={config.maxIterations}
                            onChange={(e) => handleMaxIterationsChange(e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                        />
                    </>
                )}
            </div>
        </BaseNode>
    );
}
