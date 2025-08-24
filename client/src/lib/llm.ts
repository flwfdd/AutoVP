import { OpenAI } from "openai";
import config from "./config";

// 初始化OpenAI
const openai = new OpenAI({
    baseURL: config.llm.baseURL,
    apiKey: config.llm.apiKey,
    dangerouslyAllowBrowser: true,
});

export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

// 工具定义类型
export interface ExecutableTool<TArgs = Record<string, any>> extends Tool {
    execute: (args: TArgs) => Promise<string>;
}

// React 事件类型
export type ReactEvent =
    | { type: "llm_start"; params: OpenAI.Chat.Completions.ChatCompletionCreateParams }
    | { type: "llm_chunk"; chunk: OpenAI.Chat.Completions.ChatCompletionChunk; }
    | { type: "llm_end"; message: OpenAI.Chat.Completions.ChatCompletionMessage; }
    | { type: "tool_start"; tool_call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall; }
    | { type: "tool_end"; message: OpenAI.Chat.Completions.ChatCompletionMessage; }
    | { type: "end"; messages: OpenAI.Chat.Completions.ChatCompletionMessage[]; };

export async function llm(model: string, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
    const response = await openai.chat.completions.create({
        model,
        messages,
    });
    return response.choices[0].message.content;
}

// 支持工具调用的 LLM 函数（单次调用）
export async function llmWithTools(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: Tool[]
): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
    // 将工具转换为 OpenAI 格式
    const openaiTools = tools.map(tool => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));

    const response = await openai.chat.completions.create({
        model,
        messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const message = response.choices[0].message;

    return message;
}

// 流式 LLM 调用
export async function* llmStream(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): AsyncGenerator<string, void, unknown> {
    const stream = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            yield content;
        }
    }
}

// React 模式 - 支持工具调用（通过 reactStream 实现）
export async function* react(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: ExecutableTool<any>[],
    maxIterations: number = 10
): AsyncGenerator<ReactEvent, void, unknown> {
    for await (const event of reactStream(model, messages, tools, maxIterations)) {
        // 过滤掉 llm_chunk 事件，只保留其他事件
        if (event.type !== "llm_chunk") {
            yield event;
        }
    }
}

// React 流式模式 - 支持工具调用和流式输出
export async function* reactStream(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: ExecutableTool<any>[],
    maxIterations: number = 10
): AsyncGenerator<ReactEvent, void, unknown> {
    const conversationMessages = [...messages];
    const allMessages: OpenAI.Chat.Completions.ChatCompletionMessage[] = [];
    let iteration = 0;

    // 将工具转换为 OpenAI 格式
    const openaiTools = tools.map(tool => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));

    // 创建工具名称到工具对象的映射
    const toolMap = new Map(tools.map(tool => [tool.name, tool]));

    while (iteration < maxIterations) {
        iteration++;

        // 流式调用模型参数
        const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
            model,
            messages: conversationMessages,
            tools: openaiTools.length > 0 ? openaiTools : undefined,
            stream: true,
        };

        // 发出 LLM 开始事件
        yield { type: "llm_start", params };

        const stream = await openai.chat.completions.create(params);

        let assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessage = {
            role: "assistant",
            content: "",
            tool_calls: [],
            refusal: null
        };

        let currentToolCall: Partial<OpenAI.Chat.Completions.ChatCompletionMessageToolCall> | null = null;
        let toolCallIndex = -1;

        for await (const chunk of stream) {
            // 发出 LLM chunk 事件
            yield { type: "llm_chunk", chunk };

            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                assistantMessage.content += delta.content;
            }

            if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                    if (toolCallDelta.index !== undefined) {
                        if (toolCallDelta.index !== toolCallIndex) {
                            // 新的工具调用
                            if (currentToolCall && currentToolCall.id) {
                                assistantMessage.tool_calls?.push(currentToolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall);
                            }
                            toolCallIndex = toolCallDelta.index;
                            currentToolCall = {
                                id: toolCallDelta.id || "",
                                type: "function",
                                function: {
                                    name: "",
                                    arguments: ""
                                }
                            };
                        }

                        if (toolCallDelta.id) {
                            currentToolCall!.id = toolCallDelta.id;
                        }

                        if (toolCallDelta.function?.name) {
                            currentToolCall!.function!.name += toolCallDelta.function.name;
                        }

                        if (toolCallDelta.function?.arguments) {
                            currentToolCall!.function!.arguments += toolCallDelta.function.arguments;
                        }
                    }
                }
            }
        }

        // 添加最后一个工具调用
        if (currentToolCall && currentToolCall.id) {
            assistantMessage.tool_calls?.push(currentToolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall);
        }

        // 清理空的 tool_calls 数组
        if (assistantMessage.tool_calls?.length === 0) {
            delete assistantMessage.tool_calls;
        }

        allMessages.push(assistantMessage);

        // 发出 LLM 结束事件
        yield { type: "llm_end", message: assistantMessage };

        // 如果没有工具调用，结束循环
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            yield {
                type: "end",
                messages: allMessages
            };
            break;
        }

        // 添加助手消息到对话
        conversationMessages.push(assistantMessage);

        // 执行工具调用
        for (const toolCall of assistantMessage.tool_calls) {
            // 发出工具开始事件
            yield { type: "tool_start", tool_call: toolCall };

            try {
                const tool = toolMap.get(toolCall.function.name);
                if (!tool) {
                    throw new Error(`Unknown tool: ${toolCall.function.name}`);
                }

                const args = JSON.parse(toolCall.function.arguments);
                const result = await tool.execute(args);

                const toolMessage = {
                    role: "tool" as const,
                    tool_call_id: toolCall.id,
                    content: result,
                    refusal: null
                };

                allMessages.push(toolMessage as any);

                // 发出工具结束事件
                yield { type: "tool_end", message: toolMessage as any };

                // 添加工具结果到对话
                conversationMessages.push(toolMessage);
            } catch (error) {
                const errorMessage = {
                    role: "tool" as const,
                    tool_call_id: toolCall.id,
                    content: `Error executing tool: ${error}`,
                    refusal: null
                };

                allMessages.push(errorMessage as any);

                // 发出工具结束事件（包含错误）
                yield { type: "tool_end", message: errorMessage as any };

                conversationMessages.push(errorMessage);
            }
        }
    }

    if (iteration >= maxIterations) {
        yield {
            type: "end",
            messages: allMessages
        };
    }
}