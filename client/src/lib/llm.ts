import { OpenAI } from "openai";
import config from "./config";

// 初始化OpenAI
const openai = new OpenAI({
    baseURL: config.llm.baseURL,
    apiKey: config.llm.apiKey,
    dangerouslyAllowBrowser: true,
});

export async function llm(model: string, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
    const response = await openai.chat.completions.create({
        model,
        messages,
    });
    return response.choices[0].message.content;
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