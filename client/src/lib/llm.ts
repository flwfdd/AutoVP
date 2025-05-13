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