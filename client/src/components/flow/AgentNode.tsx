import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import configGlobal from '@/lib/config';
import { BaseNodeConfigSchema, BaseNodeInputSchema, BaseNodeOutputSchema, IBaseNodeState, INodeContext, INodeProps, INodeType, useNodeUIContext, runFlow, IRunFlowStack, defaultNodeRunState, BaseNodeDefaultState, INodeRunLog } from '@/lib/flow/flow';
import { react, ExecutableTool, llm, createExecutableTool, Message } from '@/lib/llm';
import { Position } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Textarea } from "../ui/textarea";
import BaseNode from './base/BaseNode';
import { MultiSelect } from '@/components/multi-select';
import { getFlowNodeTypes, useFlowNodeTypes } from "@/lib/flow/use-flow-node-types";

const AgentNodeInputSchema = BaseNodeInputSchema.extend({
    prompt: z.any().describe('User prompt to send to the Agent, if the prompt is not a string, it will be converted to a string by JSON.stringify'),
});
type IAgentNodeInput = z.infer<typeof AgentNodeInputSchema>;

const AgentNodeOutputSchema = BaseNodeOutputSchema.extend({
    output: z.string().describe('Final output of the Agent after tool calls, is the last assistant message content'),
});
type IAgentNodeOutput = z.infer<typeof AgentNodeOutputSchema>;

const AgentNodeConfigSchema = BaseNodeConfigSchema.extend({
    systemPrompt: z.string().describe('System prompt to send to the Agent'),
    model: z.string().describe('Model to use, available models: ' + configGlobal.llm.models.join(', ')),
    toolFlowIds: z.array(z.string()).describe('Array of flow IDs to use as tools'),
    maxIterations: z.number().describe('Maximum number of iterations for ReAct'),
});
type IAgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;

interface IAgentNodeState extends IBaseNodeState {
    fullMessages?: Message[]; // 存储完整的对话历史
}

export const AgentNodeType: INodeType<IAgentNodeConfig, IAgentNodeState, IAgentNodeInput, IAgentNodeOutput> = {
    configSchema: AgentNodeConfigSchema,
    inputSchema: AgentNodeInputSchema,
    outputSchema: AgentNodeOutputSchema,
    inputHandlesGetter: () => new Set(['prompt']),
    outputHandlesGetter: () => new Set(['output']),
    id: 'agent',
    name: 'Agent',
    description: 'Agent node runs LLM with ReAct pattern and can use subflows as tools.\n' +
        'The input of the agent node is the user prompt to send to the Agent.\n' +
        'The output of the agent node is the last assistant message from the Agent.',
    defaultConfig: {
        name: 'New Agent',
        description: '',
        systemPrompt: 'You are a helpful AI agent that can use tools to help answer questions.',
        model: configGlobal.llm.models.length > 0 ? configGlobal.llm.models[0] : '',
        toolFlowIds: [],
        maxIterations: 10
    },
    defaultState: { ...BaseNodeDefaultState, fullMessages: [] },
    logFormatter: ((_config: IAgentNodeConfig, state: IAgentNodeState, log: INodeRunLog<IAgentNodeInput, IAgentNodeOutput>) => {
        return {
            ...log,
            input: JSON.stringify(log.input.prompt, null, 2),
            // 显示完整的对话历史
            output: state.fullMessages ? JSON.stringify(state.fullMessages, null, 2) : JSON.stringify(log.output?.output, null, 2),
            error: log.error ? JSON.stringify(log.error, null, 2) : ''
        };
    }),
    async run(context: INodeContext<IAgentNodeConfig, IAgentNodeState, IAgentNodeInput>): Promise<IAgentNodeOutput> {
        // 初始化 state，清空之前的对话历史
        context.updateState({ ...context.state, fullMessages: [] });

        if (!context.config.model) {
            throw new Error("No LLM model selected or configured.");
        }

        let allMessages: Message[] = [];

        // If no tools are selected, just run as a simple LLM
        if (context.config.toolFlowIds.length === 0) {
            const userPrompt = typeof context.input.prompt === 'string' ? context.input.prompt : JSON.stringify(context.input.prompt);
            const requestMessages = [
                { role: 'system' as const, content: context.config.systemPrompt },
                { role: 'user' as const, content: userPrompt },
            ];

            const response = await llm(context.config.model, requestMessages, []);
            const finalResponse = response.content || 'No response generated';

            // 将完整的对话历史存储到 state 中
            allMessages = [
                ...requestMessages,
                { role: 'assistant' as const, content: finalResponse }
            ];
            context.updateState({ ...context.state, fullMessages: allMessages });

            return { output: finalResponse };
        }

        // Create tools from selected flows
        const tools: ExecutableTool<Record<string, unknown>>[] = context.config.toolFlowIds.map(flowId => {
            const flowNodeType = getFlowNodeTypes().find(flow => flow.id === flowId);

            if (!flowNodeType) {
                throw new Error(`Flow with id "${flowId}" not found`);
            }

            // Get start node to determine input parameters
            const startNode = flowNodeType.nodes.find(node => node.type.id === 'start');
            const inputParams = startNode?.config.params || [];

            // Create dynamic schema for this flow's parameters
            const flowParamsSchema = z.object(
                inputParams.reduce((acc: Record<string, z.ZodAny>, param: { name: string }) => {
                    acc[param.name] = z.any().describe(`Input parameter: ${param.name}`);
                    return acc;
                }, {} as Record<string, z.ZodAny>)
            );

            return createExecutableTool(
                `flow_${flowId}`,
                flowNodeType.description || `Execute flow: ${flowNodeType.name}`,
                flowParamsSchema,
                async (args: Record<string, string>) => {
                    try {
                        // Prepare input for the flow
                        let flowInput: Record<string, unknown>;
                        if (inputParams.length > 0) {
                            flowInput = {};
                            inputParams.forEach((param: { id: string; name: string }) => {
                                flowInput[param.id] = args[param.name];
                            });
                        } else {
                            flowInput = args;
                        }

                        // Execute the flow
                        const fakeUpdate = () => { };
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
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        return `Error executing flow: ${errorMessage}`;
                    }
                }
            );
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
        allMessages = [...messages]; // 初始化 allMessages 包含初始消息

        // Collect all messages from the react execution
        const reactEvents = react(context.config.model, messages, tools, context.config.maxIterations);

        for await (const event of reactEvents) {
            if (event.type === 'llm_end') {
                finalResponse = event.message.content || '';
                allMessages.push(event.message);
            } else if (event.type === 'tool_end') {
                allMessages.push(event.message);
            }
        }

        // 将完整的对话历史存储到 state 中
        context.updateState({ ...context.state, fullMessages: allMessages });

        return { output: finalResponse || 'No response generated' };
    },
    ui: function AgentNodeUI(props: INodeProps<IAgentNodeConfig, IBaseNodeState, IAgentNodeInput, IAgentNodeOutput>) {
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
};
