import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import configGlobal from '@/lib/config';
import { DSLSchema, IDSL, IEdge, IFlowNodeType, INodeType, INodeWithPosition, loadDSL, NodeDSLSchema, EdgeDSLSchema, INodeState, INodeConfig, INodeOutput, INodeInput, dumpDSL, FlowDSLSchema } from '@/lib/flow/flow';
import { reactStream, createExecutableTool, Message, ExecutableTool } from '@/lib/llm';
import { Editor } from '@monaco-editor/react';
import { ChevronDown, ChevronRight, Loader, PanelLeftClose, PanelRightClose, Trash2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import MarkdownRenderer from './MarkdownRenderer';

interface ToolCallComponentProps {
  toolCall: {
    id: string;
    name: string;
    arguments: string;
  };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function ToolCallComponent({ toolCall, isCollapsed, onToggleCollapse }: ToolCallComponentProps) {
  const formatArguments = (args: string) => {
    if (!args) return '';

    try {
      const parsed = JSON.parse(args);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return args;
    }
  };

  return (
    <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded border border-cyan-300 dark:border-cyan-800">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
            🔧 {toolCall.name}
          </div>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-cyan-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-cyan-500" />
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-2">
          {toolCall.arguments ? (
            <div className="text-xs font-mono rounded break-all">
              {formatArguments(toolCall.arguments)}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">Loading parameters...</div>
          )}
        </div>
      )}
    </div>
  );
}

interface AICopilotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  DSL: IDSL;
  setDSL: (dsl: IDSL) => void;
  nodeTypeMap: Record<string, INodeType<INodeConfig, INodeState, INodeInput, INodeOutput>>;
  newFlowNodeType: (id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]) => IFlowNodeType;
  setNodeReviewed: (flowId: string, nodeId: string, reviewed: boolean) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: {
    id: string;
    name: string;
    arguments: string;
  }[];
}

function AICopilotDialog({
  isOpen,
  onClose,
  DSL,
  setDSL,
  nodeTypeMap,
  newFlowNodeType,
  setNodeReviewed,
}: AICopilotDialogProps) {
  const [dslString, setDslString] = useState(''); // DSL in code editor
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isShowDSL, setIsShowDSL] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [responseRef, setResponseRef] = useState<HTMLDivElement | null>(null);
  const [dslError, setDslError] = useState('');
  const [collapsedToolCalls, setCollapsedToolCalls] = useState<Set<string>>(new Set());
  const [collapsedToolResults, setCollapsedToolResults] = useState<Set<number>>(new Set());
  const [dslSnapshot, setDslSnapshot] = useState<string>('');

  const dslRef = useRef<IDSL>(DSL); // 最新的有效 DSL

  useEffect(() => {
    if (isOpen) {
      setDslSnapshot(JSON.stringify(DSL, null, 2));
      setChatHistory([]);
      setDslError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // DSL更新时不能重置状态

  // 当外部 DSL prop 变化时，同步更新 ref 和编辑器状态
  useEffect(() => {
    if (isOpen) {
      setDslString(JSON.stringify(DSL, null, 2));
    }
  }, [DSL, isOpen]) // 更新

  // Check the DSL
  useEffect(() => {
    try {
      const parsedDSL = JSON.parse(dslString);
      dslRef.current = dumpDSL(loadDSL(parsedDSL, nodeTypeMap, newFlowNodeType));
      setDslError('');
    } catch (error: unknown) {
      setDslError(error instanceof Error ? error.message : String(error));
    }
  }, [dslString, nodeTypeMap, newFlowNodeType]);

  // Auto scroll to bottom of response area
  useEffect(() => {
    if (responseRef && isAiLoading) {
      responseRef.scrollTop = responseRef.scrollHeight;
    }
  }, [chatHistory, responseRef, isAiLoading]);

  const handleAiAction = async (withDslError: boolean = false) => {
    if (isAiLoading || !prompt.trim()) return;

    setIsAiLoading(true);

    // Add user message to chat history
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt.trim(),
      timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setPrompt(''); // Clear input

    // Helper function to get current DSL
    const getCurrentDSL = () => {
      console.log('getCurrentDSL from ref:', dslRef.current);
      // 深度克隆以避免工具函数直接修改 ref 中的对象，导致意外的副作用
      return dslRef.current;
    };

    // Helper function to update DSL and editor
    const updateDSLAndEditor = (newDSL: unknown, successMessage: string) => {
      console.log('updateDSLAndEditor', newDSL);
      try {
        // 验证 DSL
        const validatedDSL = loadDSL(newDSL, nodeTypeMap, newFlowNodeType);

        // 同步更新 ref，供下一次工具调用使用
        dslRef.current = newDSL as IDSL;

        // 异步更新 state，用于 UI 渲染和父组件通信
        setDslString(JSON.stringify(newDSL, null, 2));
        setDSL(dumpDSL(validatedDSL));

        toast.success(successMessage);
        return successMessage + ' The flow has been validated and applied.';
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(error);
        toast.error('DSL validation failed: ' + errorMessage);
        throw new Error(`DSL validation failed: ${errorMessage}`);
      }
    };

    // Define tool parameter schemas
    const EditNodeParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to edit.'),
      node: NodeDSLSchema.describe('Node to create or update')
    });

    const RemoveNodeParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to edit.'),
      nodeId: z.string().describe('ID of the node to remove')
    });

    const EditEdgeParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to edit.'),
      edge: EdgeDSLSchema.describe('Edge to create or update')
    });

    const RemoveEdgeParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to edit.'),
      edgeId: z.string().describe('ID of the edge to remove')
    });

    const EditFlowParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to edit.'),
      flow: FlowDSLSchema.describe('Flow to create or update')
    });

    const RemoveFlowParamsSchema = z.object({
      flowId: z.string().describe('ID of the flow to remove')
    });

    const UpdateDSLParamsSchema = z.object({
      dsl: DSLSchema.describe('Complete DSL to replace the current one')
    });

    const editNodeTool = createExecutableTool(
      'edit_node',
      'Create or edit a node in the flow. If node ID exists, it will be replaced; if not, a new node will be created.',
      EditNodeParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        console.log('edit_node currentDSL', currentDSL);
        const flowId = args.flowId;

        // Find the target flow in the flows array
        const targetFlow = currentDSL.flows?.find((f: { id: string }) => f.id === flowId);
        if (!targetFlow) {
          throw new Error(`Flow with id "${flowId}" not found`);
        }

        // Find existing node index
        const existingIndex = targetFlow.nodes.findIndex((n: { id: string }) => n.id === args.node.id);

        if (existingIndex >= 0) {
          // Replace existing node
          targetFlow.nodes[existingIndex] = {
            ...args.node,
            position: args.node.position || { x: 0, y: 0 }
          };
          const result = updateDSLAndEditor(currentDSL, `Node "${args.node.id}" updated successfully`);
          setNodeReviewed(flowId, args.node.id, false);
          return result;
        } else {
          // Add new node
          targetFlow.nodes.push({
            ...args.node,
            position: args.node.position || { x: 0, y: 0 }
          });
          const result = updateDSLAndEditor(currentDSL, `Node "${args.node.id}" created successfully`);
          setNodeReviewed(flowId, args.node.id, false);
          return result;
        }
      }
    );

    const removeNodeTool = createExecutableTool(
      'remove_node',
      'Remove a node from the flow and all its connected edges',
      RemoveNodeParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId;

        // Find the target flow in the flows array
        const targetFlow = currentDSL.flows?.find((f: { id: string }) => f.id === flowId);
        if (!targetFlow) {
          throw new Error(`Flow with id "${flowId}" not found`);
        }

        // Find and remove the node
        const nodeIndex = targetFlow.nodes.findIndex((n: { id: string }) => n.id === args.nodeId);
        if (nodeIndex === -1) {
          throw new Error(`Node with id "${args.nodeId}" not found`);
        }

        targetFlow.nodes.splice(nodeIndex, 1);

        // Remove all edges connected to this node
        targetFlow.edges = targetFlow.edges.filter((e: { source: { nodeId: string }, target: { nodeId: string } }) =>
          e.source.nodeId !== args.nodeId && e.target.nodeId !== args.nodeId
        );

        return updateDSLAndEditor(currentDSL, `Node "${args.nodeId}" and its connected edges removed successfully`);
      }
    );

    const editEdgeTool = createExecutableTool(
      'edit_edge',
      'Create or edit an edge in the flow. If edge ID exists, it will be replaced; if not, a new edge will be created.',
      EditEdgeParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId;

        // Find the target flow in the flows array
        const targetFlow = currentDSL.flows?.find((f: { id: string }) => f.id === flowId);
        if (!targetFlow) {
          throw new Error(`Flow with id "${flowId}" not found`);
        }

        // Find existing edge index
        const existingIndex = targetFlow.edges.findIndex((e: { id: string }) => e.id === args.edge.id);

        if (existingIndex >= 0) {
          // Replace existing edge
          targetFlow.edges[existingIndex] = args.edge;
          return updateDSLAndEditor(currentDSL, `Edge "${args.edge.id}" updated successfully`);
        } else {
          // Add new edge
          targetFlow.edges.push(args.edge);
          return updateDSLAndEditor(currentDSL, `Edge "${args.edge.id}" created successfully`);
        }
      }
    );

    // Create the remove_edge tool
    const removeEdgeTool = createExecutableTool(
      'remove_edge',
      'Remove an edge from the flow',
      RemoveEdgeParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId;

        // Find the target flow in the flows array
        const targetFlow = currentDSL.flows?.find((f: { id: string }) => f.id === flowId);
        if (!targetFlow) {
          throw new Error(`Flow with id "${flowId}" not found`);
        }

        // Find and remove the edge
        const edgeIndex = targetFlow.edges.findIndex((e: { id: string }) => e.id === args.edgeId);
        if (edgeIndex === -1) {
          throw new Error(`Edge with id "${args.edgeId}" not found`);
        }

        targetFlow.edges.splice(edgeIndex, 1);

        return updateDSLAndEditor(currentDSL, `Edge "${args.edgeId}" removed successfully`);
      }
    );

    const editFlowTool = createExecutableTool(
      'edit_flow',
      'Create or edit a flow in the DSL',
      EditFlowParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        console.log('edit_flow currentDSL', currentDSL);
        const flowId = args.flowId;

        // Find the target flow
        const targetFlowIndex = currentDSL.flows?.findIndex((f: { id: string }) => f.id === flowId);
        if (targetFlowIndex !== undefined && targetFlowIndex >= 0) {
          // Replace existing flow
          currentDSL.flows[targetFlowIndex] = {
            ...args.flow,
            nodes: args.flow.nodes.map(node => ({
              ...node,
              position: node.position || { x: 0, y: 0 }
            }))
          };
          const result = updateDSLAndEditor(currentDSL, `Flow "${args.flow.id}" updated successfully`);
          args.flow.nodes.forEach((node) => setNodeReviewed(flowId, node.id, false));
          return result;
        } else {
          // Add new flow
          currentDSL.flows.push({
            ...args.flow,
            nodes: args.flow.nodes.map(node => ({
              ...node,
              position: node.position || { x: 0, y: 0 }
            }))
          });
          const result = updateDSLAndEditor(currentDSL, `Flow "${args.flow.id}" created successfully`);
          args.flow.nodes.forEach((node) => setNodeReviewed(flowId, node.id, false));
          return result;
        }
      }
    );

    const removeFlowTool = createExecutableTool(
      'remove_flow',
      'Remove a flow from the DSL',
      RemoveFlowParamsSchema,
      async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId;

        // Find the target flow
        const targetFlowIndex = currentDSL.flows?.findIndex((f: { id: string }) => f.id === flowId);
        if (targetFlowIndex !== undefined && targetFlowIndex >= 0) {
          currentDSL.flows.splice(targetFlowIndex, 1);
          return updateDSLAndEditor(currentDSL, `Flow "${args.flowId}" removed successfully`);
        }
        throw new Error(`Flow with id "${args.flowId}" not found`);
      }
    );

    const updateDSLTool = createExecutableTool(
      'update_dsl',
      'Update the current flow DSL with a new or modified DSL',
      UpdateDSLParamsSchema,
      async (args) => {
        const result = updateDSLAndEditor(args.dsl, 'DSL updated successfully');
        args.dsl.flows?.forEach((flow) => flow.nodes.forEach((node) => setNodeReviewed(flow.id, node.id, false)));
        return result;
      }
    );

    const systemPrompt = `You are an expert AI assistant specializing in collaboratively designing and building visual application flows.
This visual flow system contains different types of nodes and edges between them. The user will provide a complete DSL (Domain Specific Language) representing the current flow.
You need to use user's language (including the comments and mermaid diagrams, but parameters and variables should be in English).

# Your Task
Based on the user's question and the current flow DSL, you can:
1. Analyze and explain the flow's functionality and structure
2. Modify or extend the flow according to user requirements
3. Generate an entirely new flow

# Important Guidelines

## 1. Ambiguity Handling
If the user's request is not specific enough or has ambiguity, you must first ask for clarification instead of making assumptions about the user's intent

## 2. Steps for Creating New Flows
When users request to create a new flow, you must follow these steps:

a) First, clarify the plan: Explain in detail the flow's objectives, main steps, and logic
b) (Optional) Then show a Mermaid diagram sketch: Use flowchart syntax to show the flow structure. Mermaid example format:
c) Finally use appropriate tools: Use update_dsl for complete flows, or other tools for individual components

## 3. Workflow
1. **Understand and Analyze**: Carefully understand the user's request
2. **Clarify Ambiguities**: If anything is unclear, ask for clarification first
3. **Explain the Plan**: Detail what will be done
4. **Mermaid Sketch**: Show flow structure with diagrams
5. **Check Current DSL**: Check current DSL for errors and fix them if possible
6. **Use appropriate tools**: Apply changes using the most suitable tool for the operation


## Core Principles of Interaction

1.  **Deconstruct and Iterate, Don't Generate All at Once.**
  - When a user asks to create a new flow, do not provide a full plan, diagram, and code in one go.
  - Instead, propose a detailed plan and explanation first.
  - User may update the DSL meanwhile, you should edit based on the latest DSL.

2.  **Clarify Ambiguity, Never Assume.**
  - If any part of the user's request is unclear, you must ask clarifying questions before proceeding.
  - Your priority is to understand the user's true intent.

3.  **Visualize Continuously with Mermaid.**
  - Use Mermaid diagrams as a tool throughout the conversation to visualize your current understanding of the flow.
  - After making a change or adding a node, you can show the updated, simple diagram to ensure you and the user are aligned. This is a communication tool, not just a final step.
  - Format example:
    \`\`\`mermaid
    flowchart TD
        A[Start] --> B[Agent Processing]
        B --> C[Display Result]
        B --> D[End]
    \`\`\`

4.  **Confirm Before Generating Final Code.**
  - Only after the design has been refined and the user is happy should you apply changes using the appropriate tools.

5.  **Use tools to update the DSL.**
  - You can use tools to update the DSL step by step until the task is done.
  - For small changes, prefer using the specific tools (edit_node, edit_edge, etc.) as they are more precise and efficient.
  - Do not output DSL in the response, just use tools to update the DSL.


## DSL Requirements

All changes must ensure the DSL:
- **Strictly follow the DSL structure**
- **The DSL is complete and valid**
- **Every node ID is unique**
- **All connections follow the rules**
- **Handle IDs match the node specifications exactly**

# Flow DSL Structure
The DSL is a JSON object with the following schema:
\`\`\`
${JSON.stringify(zodToJsonSchema(DSLSchema, 'dsl'), null, 2)}
\`\`\`

## Node Structure
- A node has a unique id, a type, a config, and a position
- The type can be one of the node type id or a flow id
- A node can connect to zero or more input/output edges, every handle has a unique key, which is defined in the node type input/output schema or config for some node types
- Every output handle of a node (source of an edge) can connect to multiple input handles (targets of edges), but every input handle (except for the end node) can only connect to one output handle
- For some node types, the input/output handles are dynamic, you have to pay attention to the node rules and config

## Edge Structure
- An edge has a unique id, a source and a target
- The source and target are the node id and the key of the handle
- Handle IDs must match exactly with node specifications
- **IMPORTANT**: You must make sure the node id is valid, and the key of the handle is valid

## Flow Structure
- A flow has a unique id, a name, a description, and a list of nodes and edges
- Every flow has and only has one start node (id: start, type: start) and one end node (id: end, type: end)
- Every flow can be a API endpoint or a tool of Agent, the params of start node is the input of the flow, the output of the end node is the output of the flow, so the end node should be connected to at least one edge
- The type of nodes in a flow can be another flow id, but there can not be a circular reference

## Connection Rules

### ✅ CORRECT Connections Examples:
- text → agent → end: text.text → agent.prompt → agent.output → end.value
- text → display & text → end: text.text → display.value → end.value
- start → python: start.value → python.param_id (start node should have a \`value\` param)
- javascript → agent: javascript.output → agent.prompt

### ❌ INCORRECT Connections Examples (*MUST AVOID*):
- display → end: display node does not have output handle
- text → agent, python → agent: MUST NOT have multiple output handles connected to the same input handle

## Node Types
${Object.values(nodeTypeMap).map(nodeType => `
### ${nodeType.id}
Description: ${nodeType.description}
Input Schema:
\`\`\`json
${JSON.stringify(zodToJsonSchema(nodeType.inputSchema, nodeType.id), null, 2)}
\`\`\`
Output Schema:
\`\`\`json
${JSON.stringify(zodToJsonSchema(nodeType.outputSchema, nodeType.id), null, 2)}
\`\`\`
Config Schema:
\`\`\`json
${JSON.stringify(zodToJsonSchema(nodeType.configSchema, nodeType.id), null, 2)}
\`\`\`
`).join('\n\n')}

`;

    try {
      // Build conversation history messages
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory
          .filter(msg => msg.role !== 'tool') // 排除工具消息，因为会在 react 函数内部处理
          .map(msg => ({ role: msg.role, content: msg.content })),
        {
          role: 'user',
          content: `${userMessage.content}

Current DSL:
\`\`\`json
${dslString}
\`\`\`

${withDslError ? `
Current DSL Error:
\`\`\`
${dslError}
\`\`\`
` : ''}
`
        },
      ];

      // Use reactStream function with tools to get streaming events
      const eventStream = reactStream(configGlobal.codeEditorModel, messages, [
        editNodeTool,
        removeNodeTool,
        editEdgeTool,
        removeEdgeTool,
        editFlowTool,
        removeFlowTool,
        updateDSLTool,
      ] as unknown as ExecutableTool<Record<string, unknown>>[], 10);

      for await (const event of eventStream) {
        switch (event.type) {
          case 'llm_start':
            // 创建新的助手消息
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: '',
              timestamp: Date.now()
            }]);
            break;

          case 'llm_chunk':
            // 流式更新助手消息内容和 tool calls
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMessage = { ...newHistory[newHistory.length - 1] };
              if (lastMessage && lastMessage.role === 'assistant') {
                const chunk = event.chunk;

                // 更新内容
                if (chunk?.content) {
                  lastMessage.content += chunk.content;
                }

                // 更新 tool calls
                const toolCalls = [...(lastMessage.toolCalls || [])];
                if (chunk?.tool_calls) {
                  for (const toolCallDelta of chunk.tool_calls) {
                    const index = toolCallDelta.index;
                    if (index !== undefined) {
                      // 确保数组有足够的位置
                      while (toolCalls.length <= index) {
                        toolCalls.push({
                          id: '',
                          name: '',
                          arguments: '',
                        });
                      }

                      const toolCall = { ...toolCalls[index] };
                      if (toolCallDelta.id) {
                        toolCall.id = toolCallDelta.id;
                      }

                      if (toolCallDelta.function?.name) {
                        toolCall.name += toolCallDelta.function.name;
                      }

                      if (toolCallDelta.function?.arguments) {
                        toolCall.arguments += toolCallDelta.function.arguments;
                      }
                      toolCalls[index] = toolCall;
                    }
                  }
                }
                lastMessage.toolCalls = toolCalls;
              }
              newHistory[newHistory.length - 1] = lastMessage;
              return newHistory;
            });
            break;

          case 'llm_end':
            // 标记助手消息流式传输完成，并标记 tool calls 完成
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMessage = newHistory[newHistory.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content = event.message.content || lastMessage.content;
                lastMessage.toolCalls = event.message.tool_calls?.map(tc => ({
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments
                })) || lastMessage.toolCalls;
              }
              newHistory[newHistory.length - 1] = lastMessage;
              return newHistory;
            });
            break;

          case 'tool_start':
            // 创建新的工具结果消息（只用于显示执行结果）
            setChatHistory(prev => [...prev, {
              role: 'tool',
              content: `正在执行工具: ${event.tool_call.function.name}...`,
              timestamp: Date.now()
            }]);
            break;

          case 'tool_end':
            // 更新工具调用消息的结果
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMessage = newHistory[newHistory.length - 1];
              if (lastMessage && lastMessage.role === 'tool') {
                lastMessage.content = event.message.content || '';
              }
              return newHistory;
            });
            break;

          case 'end':
            // React 流程结束
            break;
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('AI processing failed: ' + errorMessage);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Error: ' + errorMessage,
        timestamp: Date.now()
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const clearChatHistory = () => {
    setChatHistory([]);
    setCollapsedToolCalls(new Set());
    toast.success('Chat history cleared');
  };

  const toggleToolCallCollapse = (toolCallId: string) => {
    setCollapsedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const toggleToolResultCollapse = (messageIndex: number) => {
    setCollapsedToolResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    try {
      // Parse the current DSL string in the editor
      const parsedDSL = JSON.parse(dslString);

      // Try to load the DSL to validate it
      try {
        // Use loadDSL to validate if the DSL is valid
        loadDSL(parsedDSL, nodeTypeMap, newFlowNodeType);

        // If validation passes, call setDSL to update the flow
        setDSL(parsedDSL);
        onClose();
        toast.success('Flow successfully updated');
      } catch (validationError: unknown) {
        const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
        toast.error('DSL validation failed: ' + errorMessage);
      }
    } catch {
      toast.error('JSON parsing failed, please check the format');
    }
  };

  const handleCancel = () => {
    // Restore the DSL snapshot and update the flow
    setDslString(dslSnapshot);
    setDslError('');

    // Parse and apply the snapshot to restore the original flow
    try {
      const snapshotDSL = JSON.parse(dslSnapshot);
      setDSL(snapshotDSL);
    } catch (error) {
      console.error('Failed to restore DSL snapshot:', error);
    }

    onClose();
    toast.info('Changes discarded, restored to original state');
  };

  // If not open, don't render anything
  if (!isOpen) {
    return null;
  }

  return (
    <div className={`fixed top-0 right-0 h-full ${isShowDSL ? 'w-full' : 'w-96'} bg-background border-l shadow-lg flex flex-col z-50`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Copilot</h2>
        <Button variant="ghost" size="icon" onClick={() => setIsShowDSL(!isShowDSL)} title="Toggle DSL Editor">
          {isShowDSL ? <PanelRightClose /> : <PanelLeftClose />}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-row gap-2 overflow-hidden min-h-0 p-4">
        {isShowDSL && (
          <div className="flex-1 flex flex-col overflow-hidden border rounded-md">
            <Editor
              language="json"
              value={dslString}
              onChange={(value) => setDslString(value || '')}
              theme="vs-dark"
            />
          </div>
        )}

        <div className={`flex flex-col gap-2 ${isShowDSL ? 'w-1/2 px-2' : 'w-full'}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Chat History</span>
            {chatHistory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChatHistory} title="Clear Chat History">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div
            ref={setResponseRef}
            className="flex-1 min-h-0 overflow-auto border rounded-md px-4 py-2 text-sm space-y-4"
          >
            {chatHistory.length === 0 ? (
              <div className="text-muted-foreground my-4">
                You can ask the AI to explain the current flow, modify an existing flow, or create a new flow. For example:
                <ul className="list-disc pl-8 mt-2 space-y-1">
                  <li>Analyze the functionality and structure of this flow</li>
                  <li>Add a new Agent node to the current flow</li>
                  <li>Create a web crawler flow</li>
                  <li>Create an image processing flow</li>
                </ul>
              </div>
            ) : (
              chatHistory.map((message, index) => (
                <div key={index} className={`p-3 rounded-lg ${message.role === 'user'
                  ? 'bg-primary/10 ml-8'
                  : message.role === 'tool'
                    ? 'bg-orange-50 dark:bg-orange-950/20 mx-4 border border-orange-200 dark:border-orange-800'
                    : 'bg-muted/50 mr-8'
                  }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium">
                      {message.role === 'user'
                        ? 'User'
                        : message.role === 'tool'
                          ? 'Tool Result'
                          : 'Agent'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {message.role === 'tool' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => toggleToolResultCollapse(index)}
                        >
                          {collapsedToolResults.has(index) ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : message.role === 'tool' ? (
                      <div>
                        {!collapsedToolResults.has(index) && (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <MarkdownRenderer content={message.content} />
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.toolCalls.map((toolCall, tcIndex) => (
                              <ToolCallComponent
                                key={toolCall.id || tcIndex}
                                toolCall={toolCall}
                                isCollapsed={collapsedToolCalls.has(toolCall.id)}
                                onToggleCollapse={() => toggleToolCallCollapse(toolCall.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isAiLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            )}
          </div>

          {dslError && (
            <div className="flex flex-col gap-2">
              <div className="border rounded-md p-2 bg-red-600/10 overflow-y-auto max-h-24">
                <pre className="text-wrap break-words text-red-600 text-sm">{dslError}</pre>
              </div>
              <Button variant="outline" onClick={() => handleAiAction(true)}>
                Fix with AI
              </Button>
            </div>
          )}

          <Textarea
            placeholder="Describe what you want to do with the flow..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="resize-none min-w-0 h-24"
            disabled={isAiLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleAiAction();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => handleAiAction()}
            disabled={isAiLoading || !prompt.trim()}
          >
            {isAiLoading ? (
              <>
                <Loader className="animate-spin" /> Generating...
              </>
            ) : (
              `Send`
            )}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

export default AICopilotDialog; 