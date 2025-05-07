import { ChevronDown, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { INode, IFlowNodeState } from "@/lib/flow/flow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NodeRunLogDetail from "./NodeRunLogDetail";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const INDENT_PX = 20; // 每层缩进
const TICK_PX = 30; // 时间刻度

interface TimelineLogRightProps {
  log: TimelineLog; // 节点
  tickMs: number; // 时间刻度
  onLogClick: (log: TimelineLog) => void;
}

// 时间线节点组件
function TimelineLogRight({ log, tickMs, onLogClick }: TimelineLogRightProps) {
  // 获取节点状态对应的样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return '';
    }
  };

  // 计算节点运行日志的时间线位置
  const timelineBars = useMemo(() => {
    return log.node.runState.logs.map((nodeLog, index) => {
      const startPx = nodeLog.startMs / tickMs * TICK_PX;
      const endPx = nodeLog.endMs ? nodeLog.endMs / tickMs * TICK_PX : TICK_PX;
      const widthPx = Math.max(1, endPx - startPx);
      return (
        <TooltipProvider key={index}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`absolute h-6 top-1 rounded ${getStatusStyle(log.node.runState.status)}`}
                style={{
                  left: `${startPx}px`,
                  width: `${widthPx}px`,
                  opacity: Math.pow(0.75, log.depth)
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Start: {nodeLog.startMs}ms</p>
              <p>End: {nodeLog.endMs}ms</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  }, [log.node.runState.logs, log.node.runState.status, tickMs]);

  return (
    <div className="pl-4 hover:bg-muted/50 cursor-pointer" onClick={() => onLogClick(log)}>
      <div className="relative h-8 flex items-center">
        <div className="flex-1 relative h-8">
          {timelineBars}
        </div>
      </div>
    </div>
  );
}
interface TimelineLogLeftProps {
  log: TimelineLog;
  toggleExpand: (log: TimelineLog) => void;
}
function TimelineLogLeft({ log, toggleExpand }: TimelineLogLeftProps) {
  const indent = log.depth * INDENT_PX;
  return (
    <div className="h-8 flex items-center text-sm truncate" style={{ marginLeft: indent + 'px' }} >
      {log.children.length ?
        <Button
          variant="ghost"
          className="shrink-0 size-6"
          onClick={() => toggleExpand(log)}
        >
          {log.expanded ? <ChevronDown /> : <ChevronRight />}
        </Button> : <div className="shrink-0 size-6"></div>
      }
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="ml-1 max-w-1/3">
              <span className="text-xs truncate">{log.node.type.name}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {log.node.type.name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate pl-1">{log.node.config.name}</span>
          </TooltipTrigger>
          <TooltipContent>
            {log.node.config.name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div >
  )
}

// 时间轴刻度组件
function TimelineRuler({ maxMs, tickMs }: { maxMs: number, tickMs: number }) {
  // 生成时间刻度
  const marks = [];
  for (let time = 0; time <= maxMs; time += tickMs) {
    const isMajor = time % (tickMs * 5) === 0; // 每5个间隔一个主刻度
    marks.push(
      <div
        key={time}
        className={`absolute bottom-0 ${isMajor ? 'h-4' : 'h-2'} border-l ${isMajor ? 'border-muted-foreground' : 'border-muted-foreground/30'}`}
        style={{ left: `${time / tickMs * TICK_PX}px` }}
      >
        {isMajor && (
          <div className="text-xs text-muted-foreground absolute bottom-5 -left-4 w-8 text-center">
            {time}ms
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 h-10 border-b">
      <div className="h-full ml-4 relative" style={{ width: `${maxMs / tickMs * TICK_PX}px` }}>
        {
          marks.map(mark => mark)
        }
      </div>
    </div >
  );
}

// 一行记录
interface TimelineLog {
  key: string
  node: INode
  depth: number
  parent: TimelineLog | null
  children: TimelineLog[]
  expanded: boolean
  show: boolean
}

interface TimelineLogProps {
  nodes: INode[];
  highlightNode: (nodeId: string) => void;
}

export default function TimelineLog({ nodes, highlightNode }: TimelineLogProps) {
  const [tickMs, setTickMs] = useState(100);
  const [selectedLog, setSelectedLog] = useState<TimelineLog | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLog[]>([]);
  const [maxEndTime, setMaxEndTime] = useState(0);

  useMemo(() => {
    const logs: TimelineLog[] = [];
    const dfs = (node: INode, key: string, depth: number, parent: TimelineLog | null) => {
      const log: TimelineLog = {
        key: key + node.id,
        node: node,
        depth: depth,
        parent: parent,
        children: [],
        expanded: false,
        show: false,
      }
      logs.push(log);
      if (log.node.runState.logs[0]?.endMs && log.node.runState.logs[0]?.endMs > maxEndTime) {
        setMaxEndTime(log.node.runState.logs[0]?.endMs);
      }
      if (log.node.type.id.startsWith('flow_')) {
        const state = node.state as IFlowNodeState
        state.runNodes.filter(node => node.runState.logs.length).sort((a, b) => a.runState.logs[0].startMs - b.runState.logs[0].startMs).forEach((node) => {
          log.children.push(dfs(node, log.key, depth + 1, log));
        })
      }
      return log;
    }
    nodes.filter(node => node.runState.logs.length).sort((a, b) => a.runState.logs[0].startMs - b.runState.logs[0].startMs).forEach((node) => {
      const log = dfs(node, '', 0, null);
      log.show = true;
    })
    setTimelineLogs(logs);
  }, [nodes])

  // 缩放处理
  const handleZoomIn = () => setTickMs(prev => Math.max(prev - Math.pow(10, Math.ceil(Math.log10(prev) - 1)), 10));
  const handleZoomOut = () => setTickMs(prev => Math.min(prev + Math.pow(10, Math.floor(Math.log10(prev))), 10000));

  // 节点点击处理
  const handleLogClick = (log: TimelineLog) => {
    setSelectedLog(log);
  };

  // 展开/折叠节点
  const handleToggleExpand = (log: TimelineLog) => {
    const dfsHide = (log: TimelineLog) => {
      log.expanded = false
      log.show = false
      log.children.forEach(dfsHide)
    }
    if (log.expanded) {
      log.children.forEach(dfsHide);
      log.expanded = false;
    } else {
      log.children.forEach(child => { child.show = true; })
      log.expanded = true;
    }
    setTimelineLogs([...timelineLogs]);
  };

  // 展开所有Flow节点
  const handleExpandAll = () => {
    const dfs = (log: TimelineLog) => {
      log.show = true;
      log.expanded = true;
      log.children.forEach(dfs);
    }
    timelineLogs.forEach(dfs);
    setTimelineLogs([...timelineLogs]);
  };

  // 折叠所有节点
  const handleCollapseAll = () => {
    const dfs = (log: TimelineLog) => {
      if (log.depth === 0) {
        log.show = true;
        log.expanded = false;
      } else {
        log.show = false;
        log.expanded = false;
      }
      log.children.forEach(dfs);
    }
    timelineLogs.forEach(dfs);
    setTimelineLogs([...timelineLogs]);
  };

  // 高亮节点 需要对顶级节点进行高亮
  const handleHighlight = (log: TimelineLog) => {
    while (log.parent) log = log.parent;
    highlightNode(log.node.id);
    setSelectedLog(null);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {timelineLogs.length === 0 ? (
        <div className="mt-10 text-center text-muted-foreground">
          No Run Log
        </div>
      ) : (
        <>
          {/* 工具栏 */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExpandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={handleCollapseAll}>
                Collapse All
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Tick: {tickMs}ms
              </span>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleZoomOut}>
                      <ZoomOut />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Zoom Out
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleZoomIn}>
                      <ZoomIn />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Zoom In
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <ScrollArea className="w-full flex-1 min-h-0">
            <div className="grid grid-cols-[theme(width.48)_1fr] w-full h-full">
              <div className="w-48 border-r">
                <div className="h-10 text-sm font-bold flex items-end justify-center pb-2 border-b">
                  Nodes
                </div>
                {timelineLogs.filter(log => log.show).map(log => <TimelineLogLeft key={log.key} log={log} toggleExpand={handleToggleExpand} />)}
              </div>

              <ScrollArea className="min-w-0">
                <div>
                  <TimelineRuler maxMs={maxEndTime} tickMs={tickMs} />
                  {timelineLogs.length > 0 ? (
                    timelineLogs.filter(log => log.show).map(log => (
                      <TimelineLogRight
                        key={log.key}
                        log={log}
                        tickMs={tickMs}
                        onLogClick={handleLogClick}
                      />
                    ))
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      No Run Log
                    </div>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </ScrollArea>

          {/* 节点详情对话框 */}
          < Dialog open={selectedLog !== null
          } onOpenChange={(open) => !open && setSelectedLog(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">{selectedLog?.node.type.name}</Badge>
                  {selectedLog?.node.config.name}
                </DialogTitle>
              </DialogHeader>
              {selectedLog && (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={() => handleHighlight(selectedLog)}>
                    Highlight
                  </Button>
                  <NodeRunLogDetail
                    nodeType={selectedLog.node.type}
                    config={selectedLog.node.config}
                    state={selectedLog.node.state}
                    runState={selectedLog.node.runState}
                  />
                </div>
              )}
            </DialogContent>
          </Dialog >
        </>
      )}
    </div >
  );
} 