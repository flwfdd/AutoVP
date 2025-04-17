interface WorkerInput {
    code: string;
    params: Record<string, any>;
}

export type WorkerOutput =
    | { type: 'result'; data: any }
    | { type: 'error'; message: string };

// Listen for messages from the main thread
self.onmessage = async (event: MessageEvent<WorkerInput>) => {
    const { code, params } = event.data;

    let paramInjectionString = '';
    // Inject parameters securely using JSON.stringify
    Object.entries(params).forEach(([key, value]) => {
        paramInjectionString += `let ${key} = ${JSON.stringify(value)};\n`;
    });

    // Get the AsyncFunction constructor
    const fullCode = `${paramInjectionString}\n${code}`;
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const runner = new AsyncFunction(fullCode);

    try {
        // Execute the code asynchronously
        const output = await runner();
        // Send the result back to the main thread
        self.postMessage({ type: 'result', data: output } satisfies WorkerOutput);
    } catch (e: any) {
        // Send any errors back to the main thread
        self.postMessage({ type: 'error', message: e.message } satisfies WorkerOutput);
    }
};