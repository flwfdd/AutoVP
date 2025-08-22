import { useEffect, useState } from "react";
import { IFlowNodeType } from "./flow";

// 全局流程类型管理
let globalFlowNodeTypes: IFlowNodeType[] = [];
let flowTypeListeners: Set<(flows: IFlowNodeType[]) => void> = new Set();

// 设置全局流程类型
export function setFlowNodeTypes(flowNodeTypes: IFlowNodeType[] | ((prev: IFlowNodeType[]) => IFlowNodeType[])) {
  const newFlowNodeTypes = typeof flowNodeTypes === 'function' ? flowNodeTypes(globalFlowNodeTypes) : flowNodeTypes;
  globalFlowNodeTypes = newFlowNodeTypes;
  // 通知所有监听器
  flowTypeListeners.forEach(listener => listener(newFlowNodeTypes));
}

// 获取全局流程类型
export function getFlowNodeTypes(): IFlowNodeType[] {
  return globalFlowNodeTypes;
}

// 添加流程类型监听器
function addFlowTypeListener(listener: (flows: IFlowNodeType[]) => void) {
  flowTypeListeners.add(listener);
  // 立即调用一次，提供当前状态
  listener(globalFlowNodeTypes);
  return () => flowTypeListeners.delete(listener);
}

// React Hook 用于获取流程类型
export function useFlowNodeTypes() {
  const [flowNodeTypes, setLocalFlowNodeTypes] = useState<IFlowNodeType[]>(globalFlowNodeTypes);

  useEffect(() => {
    const unsubscribe = addFlowTypeListener(setLocalFlowNodeTypes);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    flowNodeTypes,
    setFlowNodeTypes,
  };
}
