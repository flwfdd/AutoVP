import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import configGlobal from '@/lib/config';
import { DSLSchema, IDSL, IEdge, IFlowNodeType, INodeType, INodeWithPosition, loadDSL, NodeDSLSchema, EdgeDSLSchema } from '@/lib/flow/flow';
import { reactStream, ExecutableTool } from '@/lib/llm';
import { Editor } from '@monaco-editor/react';
import { ChevronDown, ChevronRight, Loader, PanelLeftClose, PanelRightClose, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
            🔧 {toolCall.name}
          </div>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-blue-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-500" />
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-2">
          {toolCall.arguments ? (
            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded break-all">
              {formatArguments(toolCall.arguments)}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">参数加载中...</div>
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
  onUpdateDSL: (dsl: IDSL) => void;
  nodeTypeMap: Record<string, INodeType<any, any, any, any>>;
  newFlowNodeType: (id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]) => IFlowNodeType;
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
  onUpdateDSL,
  nodeTypeMap,
  newFlowNodeType,
}: AICopilotDialogProps) {
  const [dslString, setDslString] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isShowAiPanel, setIsShowAiPanel] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [responseRef, setResponseRef] = useState<HTMLDivElement | null>(null);
  const [dslError, setDslError] = useState('');
  const [collapsedToolCalls, setCollapsedToolCalls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setDslString(JSON.stringify(DSL, null, 2));
    }
  }, [DSL, isOpen]);

  // Check the DSL
  useEffect(() => {
    try {
      const parsedDSL = JSON.parse(dslString);
      loadDSL(parsedDSL, nodeTypeMap, newFlowNodeType);
      setDslError('');
    } catch (error: any) {
      setDslError(error.message);
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
      try {
        return JSON.parse(dslString);
      } catch (error) {
        throw new Error('Current DSL is invalid JSON');
      }
    };

    // Helper function to update DSL and editor
    const updateDSLAndEditor = (newDSL: any, successMessage: string) => {
      try {
        // Validate the DSL
        loadDSL(newDSL, nodeTypeMap, newFlowNodeType);

        // Update the DSL string in the editor
        setDslString(JSON.stringify(newDSL, null, 2));

        toast.success(successMessage);
        return successMessage + ' The flow has been validated and applied.';
      } catch (error: any) {
        toast.error('DSL validation failed: ' + error.message);
        throw new Error(`DSL validation failed: ${error.message}`);
      }
    };

    // Define tool parameter schemas
    const EditNodeParamsSchema = z.object({
      flowId: z.string().optional().describe('ID of the flow to edit. Defaults to "main" if not specified.'),
      node: NodeDSLSchema.describe('Node to create or update')
    });

    const RemoveNodeParamsSchema = z.object({
      flowId: z.string().optional().describe('ID of the flow to edit. Defaults to "main" if not specified.'),
      nodeId: z.string().describe('ID of the node to remove')
    });

    const EditEdgeParamsSchema = z.object({
      flowId: z.string().optional().describe('ID of the flow to edit. Defaults to "main" if not specified.'),
      edge: EdgeDSLSchema.describe('Edge to create or update')
    });

    const RemoveEdgeParamsSchema = z.object({
      flowId: z.string().optional().describe('ID of the flow to edit. Defaults to "main" if not specified.'),
      edgeId: z.string().describe('ID of the edge to remove')
    });

    const UpdateDSLParamsSchema = z.object({
      dsl: DSLSchema.describe('Complete DSL to replace the current one')
    });

    // Create the edit_node tool
    const editNodeTool: ExecutableTool<z.infer<typeof EditNodeParamsSchema>> = {
      name: 'edit_node',
      description: 'Create or edit a node in the flow. If node ID exists, it will be replaced; if not, a new node will be created.',
      parameters: zodToJsonSchema(EditNodeParamsSchema),
      execute: async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId || 'main';

        // Find the target flow
        let targetFlow;
        if (flowId === 'main') {
          targetFlow = currentDSL.main;
        } else {
          targetFlow = currentDSL.flows?.find((f: any) => f.id === flowId);
          if (!targetFlow) {
            throw new Error(`Flow with id "${flowId}" not found`);
          }
        }

        // Find existing node index
        const existingIndex = targetFlow.nodes.findIndex((n: any) => n.id === args.node.id);

        if (existingIndex >= 0) {
          // Replace existing node
          targetFlow.nodes[existingIndex] = args.node;
          return updateDSLAndEditor(currentDSL, `Node "${args.node.id}" updated successfully`);
        } else {
          // Add new node
          targetFlow.nodes.push(args.node);
          return updateDSLAndEditor(currentDSL, `Node "${args.node.id}" created successfully`);
        }
      }
    };

    // Create the remove_node tool
    const removeNodeTool: ExecutableTool<z.infer<typeof RemoveNodeParamsSchema>> = {
      name: 'remove_node',
      description: 'Remove a node from the flow and all its connected edges',
      parameters: zodToJsonSchema(RemoveNodeParamsSchema),
      execute: async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId || 'main';

        // Find the target flow
        let targetFlow;
        if (flowId === 'main') {
          targetFlow = currentDSL.main;
        } else {
          targetFlow = currentDSL.flows?.find((f: any) => f.id === flowId);
          if (!targetFlow) {
            throw new Error(`Flow with id "${flowId}" not found`);
          }
        }

        // Find and remove the node
        const nodeIndex = targetFlow.nodes.findIndex((n: any) => n.id === args.nodeId);
        if (nodeIndex === -1) {
          throw new Error(`Node with id "${args.nodeId}" not found`);
        }

        targetFlow.nodes.splice(nodeIndex, 1);

        // Remove all edges connected to this node
        targetFlow.edges = targetFlow.edges.filter((e: any) =>
          e.source.node !== args.nodeId && e.target.node !== args.nodeId
        );

        return updateDSLAndEditor(currentDSL, `Node "${args.nodeId}" and its connected edges removed successfully`);
      }
    };

    // Create the edit_edge tool
    const editEdgeTool: ExecutableTool<z.infer<typeof EditEdgeParamsSchema>> = {
      name: 'edit_edge',
      description: 'Create or edit an edge in the flow. If edge ID exists, it will be replaced; if not, a new edge will be created.',
      parameters: zodToJsonSchema(EditEdgeParamsSchema),
      execute: async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId || 'main';

        // Find the target flow
        let targetFlow;
        if (flowId === 'main') {
          targetFlow = currentDSL.main;
        } else {
          targetFlow = currentDSL.flows?.find((f: any) => f.id === flowId);
          if (!targetFlow) {
            throw new Error(`Flow with id "${flowId}" not found`);
          }
        }

        // Find existing edge index
        const existingIndex = targetFlow.edges.findIndex((e: any) => e.id === args.edge.id);

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
    };

    // Create the remove_edge tool
    const removeEdgeTool: ExecutableTool<z.infer<typeof RemoveEdgeParamsSchema>> = {
      name: 'remove_edge',
      description: 'Remove an edge from the flow',
      parameters: zodToJsonSchema(RemoveEdgeParamsSchema),
      execute: async (args) => {
        const currentDSL = getCurrentDSL();
        const flowId = args.flowId || 'main';

        // Find the target flow
        let targetFlow;
        if (flowId === 'main') {
          targetFlow = currentDSL.main;
        } else {
          targetFlow = currentDSL.flows?.find((f: any) => f.id === flowId);
          if (!targetFlow) {
            throw new Error(`Flow with id "${flowId}" not found`);
          }
        }

        // Find and remove the edge
        const edgeIndex = targetFlow.edges.findIndex((e: any) => e.id === args.edgeId);
        if (edgeIndex === -1) {
          throw new Error(`Edge with id "${args.edgeId}" not found`);
        }

        targetFlow.edges.splice(edgeIndex, 1);

        return updateDSLAndEditor(currentDSL, `Edge "${args.edgeId}" removed successfully`);
      }
    };

    // Create the update_dsl tool (keep the original for full DSL updates)
    const updateDSLTool: ExecutableTool<z.infer<typeof UpdateDSLParamsSchema>> = {
      name: 'update_dsl',
      description: 'Update the current flow DSL with a new or modified DSL',
      parameters: zodToJsonSchema(UpdateDSLParamsSchema),
      execute: async (args) => {
        return updateDSLAndEditor(args.dsl, 'DSL updated successfully');
      }
    };

    const systemPrompt = `You are an expert AI assistant specializing in collaboratively designing and building visual application flows.
This visual flow system contains different types of nodes and edges between them. The user will provide a complete DSL (Domain Specific Language) representing the current flow.
You need to use user's language (including the comments and mermaid diagrams).

# Your Task
Based on the user's question and the current flow DSL, you can:
1. Analyze and explain the flow's functionality and structure
2. Modify or extend the flow according to user requirements
3. Generate an entirely new flow

When you need to update the DSL, you can use either:
1. **update_dsl** - For complete DSL replacement
2. **edit_node** - To create or modify individual nodes
3. **remove_node** - To delete nodes and their connected edges
4. **edit_edge** - To create or modify individual edges
5. **remove_edge** - To delete specific edges

For small changes, prefer using the specific tools (edit_node, edit_edge, etc.) as they are more precise and efficient.

# Important Guidelines

## 1. Ambiguity Handling
- If the user's request is not specific enough or has ambiguity, **you must first ask for clarification** instead of making assumptions about the user's intent
- For example: If the user says "create an AI flow", ask specifically what they want to do (text generation, image processing, data analysis, etc.)
- If the user says "modify the flow" without specifying what to modify, ask for detailed requirements

## 2. Steps for Creating New Flows
When users request to create a new flow, you **must follow these steps**:

a) **First, clarify the plan**: Explain in detail the flow's objectives, main steps, and logic
b) **Then show a Mermaid diagram sketch**: Use flowchart syntax to show the flow structure
c) **Finally use appropriate tools**: Use update_dsl for complete flows, or edit_node/edit_edge for individual components

Mermaid example format:
\`\`\`mermaid
flowchart TD
    A[Start] --> B[Text Input]
    B --> C[LLM Processing]
    C --> D[Display Result]
    D --> E[End]
\`\`\`

## 3. Workflow
1. **Understand and Analyze**: Carefully understand the user's request
2. **Clarify Ambiguities**: If anything is unclear, ask for clarification first
3. **Explain the Plan**: Detail what will be done (for new flow creation)
4. **Mermaid Sketch**: Show flow structure with diagrams (for new flow creation)
5. **Check Current DSL**: Check current DSL for errors and fix them if possible
6. **Use appropriate tools**: Apply changes using the most suitable tool for the operation

When the user requests modifications or generation of a new flow DSL, choose the appropriate tool:
- **update_dsl**: For complete DSL replacement or major restructuring
- **edit_node**: For adding, updating, or replacing individual nodes
- **remove_node**: For deleting nodes and their connections
- **edit_edge**: For adding or updating connections between nodes
- **remove_edge**: For deleting specific connections

All changes must ensure the DSL:
- **Strictly follow the DSL structure**
- **The DSL is complete and valid**
- **Every node ID is unique**
- **All connections follow the rules**
- **Handle IDs match the node specifications exactly**
- **Only return one DSL in a json block in your response**

## Your Task
Your primary goal is to work with the user **iteratively** through conversation.
Instead of generating a complete solution at once, you will build upon the user's ideas step-by-step, refining the design until they are satisfied.
Based on the user's question and the current flow DSL, you can:
1. Analyze and explain the flow's functionality and structure
2. Modify or extend the flow according to user requirements
3. Generate an entirely new flow


## Core Principles of Interaction

1.  **Deconstruct and Iterate, Don't Generate All at Once.**
    * When a user asks to create a new flow, **do not** provide a full plan, diagram, and code in one go.
    * Instead, **propose a detailed plan and explanation first**.

2.  **Clarify Ambiguity, Never Assume.**
    * If any part of the user's request is unclear, you **must** ask clarifying questions before proceeding.
    * **Your priority is to understand the user's true intent.** 

3.  **Visualize Continuously with Mermaid.**
    * Use Mermaid diagrams as a tool throughout the conversation to **visualize your current understanding** of the flow.
    * After making a change or adding a node, you can show the updated, simple diagram to ensure you and the user are aligned. This is a communication tool, not just a final step.
    * Format example:
\`\`\`mermaid
flowchart TD
    A[Start] --> B[LLM Processing]
    B --> C[Display Result]
    C --> D[End]
\`\`\`

4.  **Confirm Before Generating Final Code.**
    * Only after the design has been refined and the user is happy should you apply changes using the appropriate tools.


## Final DSL Output Requirements

When the user gives final confirmation, you **must** generate the DSL according to these rules:
- **Strictly follow the DSL structure**
- **The DSL is complete and valid**
- **Every node ID is unique**
- **All connections follow the rules**
- **Handle IDs match the node specifications exactly**

# DSL Structure
The DSL is a JSON object with the following schema:
\`\`\`
${JSON.stringify(zodToJsonSchema(DSLSchema, 'dsl'), null, 2)}
\`\`\`

## Node Structure
- A node has a unique id, a type, a config, and a position
- The type can be one of the node type id or a flow id
- A node can connect to zero or more input/output edges, every handle has a unique key, which is defined in the node type input/output schema or config for some node types
- Every output handle of a node (source of an edge) can connect to multiple input handles (targets of edges), but every input handle (target of an edge) can only connect to one output handle (source of an edge)

## Edge Structure
- An edge has a unique id, a source and a target
- The source and target are the node id and the key of the handle
- Handle IDs must match exactly with node specifications

## Flow Structure
- A flow has a unique id, a name, a description, and a list of nodes and edges
- Every flow has and only has one start node (id: start, type: start) and one end node (id: end, type: end)
- The type of nodes in a flow can be another flow id, but there can not be a circular reference

## Connection Rules

### ✅ CORRECT Connections Examples:
- text → llm: text.text → llm.prompt
- llm → display: llm.output → display.value
- start → python: start.value → python.param_id
- python/javascript → llm: python.output → llm.prompt (ONLY if python/javascript outputs string)

### ❌ INCORRECT Connections Examples (*MUST AVOID*):
- python/javascript → llm: When python/javascript outputs object/array but connects to llm.prompt (string only)
- Any non-string → image.src
- Any non-string → llm.prompt

### 🔧 Type Conversion Solutions:
If you need to connect incompatible types, insert conversion nodes:
- Use JavaScript node to convert objects to strings
- Use JavaScript node to extract specific fields from objects
- Use JavaScript node to format data appropriately

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
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...chatHistory
          .filter(msg => msg.role !== 'tool') // 排除工具消息，因为会在 react 函数内部处理
          .map(msg => ({ role: msg.role as any, content: msg.content })),
        {
          role: 'user' as const,
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
        updateDSLTool,
        editNodeTool,
        removeNodeTool,
        editEdgeTool,
        removeEdgeTool
      ], 10);

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
                const delta = event.chunk.choices[0]?.delta;

                // 更新内容
                if (delta?.content) {
                  lastMessage.content += delta.content;
                }

                // 更新 tool calls
                const toolCalls = [...(lastMessage.toolCalls || [])];
                if (delta?.tool_calls) {
                  for (const toolCallDelta of delta.tool_calls) {
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
              let lastMessage = newHistory[newHistory.length - 1];
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

    } catch (error: any) {
      toast.error('AI processing failed: ' + error.message);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Error: ' + error.message,
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

  const handleSave = () => {
    try {
      // Parse the current DSL string in the editor
      const parsedDSL = JSON.parse(dslString);

      // Try to load the DSL to validate it
      try {
        // Use loadDSL to validate if the DSL is valid
        loadDSL(parsedDSL, nodeTypeMap, newFlowNodeType);

        // If validation passes, call onFlowUpdate to update the flow
        onUpdateDSL(parsedDSL);
        onClose();
        toast.success('Flow successfully updated');
      } catch (validationError: any) {
        toast.error('DSL validation failed: ' + validationError.message);
      }
    } catch (parseError) {
      toast.error('JSON parsing failed, please check the format');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-w-full max-w-full min-h-full max-h-full flex flex-col p-4 [&>button]:hidden rounded-none">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>AI Copilot</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsShowAiPanel(!isShowAiPanel)}>
              {isShowAiPanel ? <PanelRightClose /> : <PanelLeftClose />}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-row gap-2 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden border rounded-md">
            <Editor
              language="json"
              value={dslString}
              onChange={(value) => setDslString(value || '')}
              theme="vs-dark"
            />
          </div>

          {isShowAiPanel && (
            <div className="w-1/2 flex flex-col gap-2 px-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Chat History</span>
                {chatHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearChatHistory}>
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
                      <li>Add a new LLM node to the current flow</li>
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
                              : 'AI Assistant'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm">
                        {message.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        ) : message.role === 'tool' ? (
                          <div className="whitespace-pre-wrap">{message.content}</div>
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
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AICopilotDialog; 