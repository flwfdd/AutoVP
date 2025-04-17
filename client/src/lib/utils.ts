/*
 * @Author: flwfdd
 * @Date: 2025-04-16 00:39:59
 * @LastEditTime: 2025-04-17 20:30:15
 * @Description: _(:з」∠)_
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { WorkerOutput } from "./js-runner.worker";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Run code in a web worker
export async function workerEval(code: string, params: Record<string, any>) {
  const worker = new Worker(new URL('./js-runner.worker.ts', import.meta.url), {
    type: 'module'
  });

  return new Promise((resolve, reject) => {
    worker.postMessage({ code, params });

    // Handle messages from the worker
    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      const message = event.data;
      if (message.type === 'result') {
        resolve(message.data);
      } else if (message.type === 'error') {
        reject(new Error(message.message));
      }
      worker.terminate();
    };

    // Handle errors originating from the worker itself
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
  });
}
