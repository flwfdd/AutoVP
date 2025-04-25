import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { WorkerOutput } from "./js-runner.worker";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 在web worker中执行js代码
export async function workerEval(code: string, params: Record<string, any>) {
  const worker = new Worker(new URL('./js-runner.worker.ts', import.meta.url), {
    type: 'module'
  });

  return new Promise((resolve, reject) => {
    worker.postMessage({ code, params });

    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      const message = event.data;
      if (message.type === 'result') {
        resolve(message.data);
      } else if (message.type === 'error') {
        reject(new Error(message.message));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
  });
}

// 生成随机id
export function generateId() {
  return Math.random().toString(36).substring(2);
}
