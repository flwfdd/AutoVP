type WorkerInput = {
    code: string;
    params: Record<string, unknown>;
}

export type WorkerOutput =
    | { type: 'result'; data: unknown; logs: string[] }
    | { type: 'error'; message: string; logs: string[] };

// 接收调用信息
self.onmessage = async (event: MessageEvent<WorkerInput>) => {
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    try {
        const { code, params } = event.data;

        // 重写 console.log 来捕获输出
        console.log = (...args: unknown[]) => {
            const logMessage = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            logs.push(logMessage);
            originalConsoleLog(...args);
        };

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

        // 恢复原始的 console.log
        console.log = originalConsoleLog;

        // 返回结果和日志
        self.postMessage({ type: 'result', data: output, logs } satisfies WorkerOutput);
    } catch (e: unknown) {
        // 恢复原始的 console.log
        console.log = originalConsoleLog;

        // 返回错误和日志
        self.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e), logs } satisfies WorkerOutput);
    }
};