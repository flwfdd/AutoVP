import { Badge } from "@/components/ui/badge";
import { INodeConfig, INodeInput, INodeOutput, INodeRunLog, INodeState, INodeStateRun, INodeType } from "@/lib/flow/flow";
import { useMemo } from "react";

interface NodeRunLogDetailProps<C extends INodeConfig, S extends INodeState, I extends INodeInput, O extends INodeOutput> {
  nodeType: INodeType<C, S, I, O>;
  config: C;
  state: S;
  runState: INodeStateRun<I, O> | undefined;
}


export default function NodeRunLogDetail<C extends INodeConfig, S extends INodeState, I extends INodeInput, O extends INodeOutput>(
  { nodeType, config, state, runState }: NodeRunLogDetailProps<C, S, I, O>
) {
  const logFormatter = useMemo(() => nodeType.logFormatter || ((_config: C, _state: S, log: INodeRunLog<I, O>) => {
    return {
      input: JSON.stringify(log.input, null, 2),
      output: JSON.stringify(log.output, null, 2),
    };
  }), [nodeType.logFormatter]);

  const formattedLogs = useMemo(() => runState?.logs.map((log) => {
    const formattedLog = logFormatter(config, state, log);
    return {
      ...log,
      input: formattedLog.input,
      output: formattedLog.output,
    };
  }), [runState?.logs, logFormatter, config, state]);

  return (
    <div>
      {formattedLogs && formattedLogs.length ?
        formattedLogs.map((log, index) => (
          <div key={index} className="flex flex-col gap-2 bg-muted p-2 rounded-md">
            <div className="flex gap-2 justify-between">
              <Badge variant="outline" className="text-xs text-center border-green-600 bg-green-600/10">
                Input <br />
                {log.startMs} ms
              </Badge>
              <Badge variant="outline" className="text-xs text-center border-yellow-600 bg-yellow-600/10">
                Duration <br />
                {log.endMs ? log.endMs - log.startMs : ''} ms
              </Badge>
              <Badge variant="outline" className="text-xs text-center border-red-600 bg-red-600/10">
                Output <br />
                {log.endMs} ms
              </Badge>
            </div>
            <div className="flex gap-4">
              <pre className="flex-1 text-sm whitespace-pre-wrap break-all">{log.input}</pre>
              <pre className="flex-1 text-sm whitespace-pre-wrap break-all">
                <div>{log.output}</div>
                {log.error && (
                  <div className="text-red-600">{log.error}</div>
                )}
              </pre>
            </div>
          </div>
        ))
        : (
          <p className="text-center text-muted-foreground">No Run Log</p>
        )}
    </div>
  );
}