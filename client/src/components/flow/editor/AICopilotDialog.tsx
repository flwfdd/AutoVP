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
import { DSLSchema, IDSL, IEdge, IFlowNodeType, INodeType, INodeWithPosition, loadDSL } from '@/lib/flow/flow';
import { llmStream } from '@/lib/llm';
import { Editor } from '@monaco-editor/react';
import { Loader, PanelLeftClose, PanelRightClose, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { zodToJsonSchema } from 'zod-to-json-schema';
import MarkdownRenderer from './MarkdownRenderer';

interface AICopilotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  DSL: IDSL;
  onUpdateDSL: (dsl: IDSL) => void;
  nodeTypeMap: Record<string, INodeType<any, any, any, any>>;
  newFlowNodeType: (id: string, name: string, description: string, nodes: INodeWithPosition[], edges: IEdge[]) => IFlowNodeType;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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

    const systemPrompt = `You are an expert AI assistant specializing in collaboratively designing and building visual application flows.
This visual flow system contains different types of nodes and edges between them. The user will provide a complete DSL (Domain Specific Language) representing the current flow.
You need to use user's language (including the comments and mermaid diagrams).

# Your Task
Based on the user's question and the current flow DSL, you can:
1. Analyze and explain the flow's functionality and structure
2. Modify or extend the flow according to user requirements
3. Generate an entirely new flow

# Important Guidelines

## 1. Ambiguity Handling
- If the user's request is not specific enough or has ambiguity, **you must first ask for clarification** instead of making assumptions about the user's intent
- For example: If the user says "create an AI flow", ask specifically what they want to do (text generation, image processing, data analysis, etc.)
- If the user says "modify the flow" without specifying what to modify, ask for detailed requirements

## 2. Steps for Creating New Flows
When users request to create a new flow, you **must follow these steps**:

a) **First, clarify the plan**: Explain in detail the flow's objectives, main steps, and logic
b) **Then show a Mermaid diagram sketch**: Use flowchart syntax to show the flow structure
c) **Finally generate the complete DSL**: Generate executable DSL based on the confirmed plan

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
6. **Generate DSL**: Return the new DSL in a json code block in your response

When the user requests modifications or generation of a new flow DSL, this returned DSL will be used directly by the system, so you must ensure that:
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
    * Instead, **propose a detailed plan and explaination first**.

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
    * Only after the design has been refined and the user is happy should you generate the final DSL.


## Final DSL Output Requirements

When the user gives final confirmation, you **must** generate the DSL according to these rules:
- **Strictly follow the DSL structure**
- **The DSL is complete and valid**
- **Every node ID is unique**
- **All connections follow the rules**
- **Handle IDs match the node specifications exactly**
- **Only return one DSL in a json block in your response**

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
        ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
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

      let fullResponse = '';

      const stream = llmStream(configGlobal.codeEditorModel, messages);

      for await (const chunk of stream) {
        fullResponse += chunk;
        // Update assistant message in chat history in real-time
        setChatHistory(prev => {
          const newHistory = [...prev];
          const lastMessage = newHistory[newHistory.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = fullResponse;
          } else {
            newHistory.push({
              role: 'assistant',
              content: fullResponse,
              timestamp: Date.now()
            });
          }
          return newHistory;
        });
      }

      if (!fullResponse) {
        toast.error('AI returned empty response');
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'AI returned empty response',
          timestamp: Date.now()
        }]);
        return;
      }

      // Try to extract and apply DSL from response
      try {
        const jsonMatches = [...fullResponse.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
        if (jsonMatches.length > 0) {
          const lastMatch = jsonMatches[jsonMatches.length - 1];
          const extractedJson = lastMatch[1].trim();
          // Validate the extracted JSON
          const parsedDSL = JSON.parse(extractedJson);
          // Set the editable DSL
          setDslString(JSON.stringify(parsedDSL, null, 2));
          toast.success('DSL updated successfully');
        }
      } catch (jsonError) {
        toast.error('Failed to extract JSON from AI response');
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
    toast.success('Chat history cleared');
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
                    <div key={index} className={`p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-primary/10 ml-8' 
                        : 'bg-muted/50 mr-8'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium">
                          {message.role === 'user' ? 'User' : 'AI Assistant'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        {message.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        ) : (
                          <MarkdownRenderer content={message.content} />
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