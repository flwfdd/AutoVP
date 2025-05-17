type WorkerInput = {
    code: string;
    params: Record<string, any>;
}

export type WorkerOutput =
    | { type: 'result'; data: any }
    | { type: 'error'; message: string };

// 接收调用信息
self.onmessage = async (event: MessageEvent<WorkerInput>) => {
    try {
        const { code, params } = event.data;

        // 注入参数
        let paramInjectionString = '';
        Object.entries(params).forEach(([key, value]) => {
            paramInjectionString += `let ${key} = ${JSON.stringify(value)};\n`;
        });

        // 构造异步执行函数
        const fullCode = `${paramInjectionString}\n${code}`;
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const runner = new AsyncFunction(fullCode);

        // 执行代码
        const output = await runner();
        // 返回结果
        self.postMessage({ type: 'result', data: output } satisfies WorkerOutput);
    } catch (e: any) {
        // 返回错误
        self.postMessage({ type: 'error', message: e.message } satisfies WorkerOutput);
    }
};