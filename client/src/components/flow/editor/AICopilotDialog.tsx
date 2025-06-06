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
import { Loader, PanelLeftClose, PanelRightClose } from 'lucide-react';
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
  const [response, setResponse] = useState('');
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

  // 自动滚动到响应区域底部
  useEffect(() => {
    if (responseRef && isAiLoading) {
      responseRef.scrollTop = responseRef.scrollHeight;
    }
  }, [response, responseRef, isAiLoading]);

  const handleAiAction = async (withDslError: boolean = false) => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setResponse('');

    const systemPrompt = `You are an AI assistant specialized in visual flow processing.
This visual flow system contains different types of nodes and edges between them. The user will provide a complete DSL (Domain Specific Language) representing the current flow.

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

# Your Task
Based on the user's question and the current flow DSL, you can:
1. Analyze and explain the flow's functionality and structure
2. Modify or extend the flow according to user requirements
3. Generate an entirely new flow

When the user requests modifications or generation of a new flow DSL, this returned DSL will be used directly by the system, so you must ensure that:
- **Strictly follow the DSL structure**
- **The DSL is complete and valid**
- **Every node ID is unique**
- **All connections follow the rules**
- **Handle IDs match the node specifications exactly**
- **Only return one DSL in a json block in your response**

# Workflow
1. Think step by step and explain your analysis and plan, You need to answer in the language of the user's question
2. Check the current DSL for errors, and fix them if possible
3. Return the new DSL in a json block in your response. **Pay attention to the schema and connection rules**
`;

    try {
      let fullResponse = '';

      const stream = llmStream(configGlobal.codeEditorModel, [
        { role: 'system', content: systemPrompt },
        {
          role: 'user', content: `${prompt}

Current DSL:
\`\`\`json
${dslString}
\`\`\`

${withDslError ? `
Current DSL Error:
\`\`\`json
${dslError}
\`\`\`
` : ''}
` },
      ]);

      for await (const chunk of stream) {
        fullResponse += chunk;
        setResponse(fullResponse);
      }

      if (!fullResponse) {
        toast.error('AI returned empty response');
        setResponse('AI returned empty response');
        return;
      }


      try {
        const jsonMatches = [...fullResponse.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
        if (jsonMatches.length > 0) {
          const lastMatch = jsonMatches[jsonMatches.length - 1];
          const extractedJson = lastMatch[1].trim();
          // 验证提取的 JSON
          const parsedDSL = JSON.parse(extractedJson);
          // 设置可编辑的 DSL
          setDslString(JSON.stringify(parsedDSL, null, 2));
          toast.success('DSL updated successfully');
        }
      } catch (jsonError) {
        toast.error('Failed to extract JSON from AI response');
      }
    } catch (error: any) {
      toast.error('AI processing failed: ' + error.message);
      setResponse('Error: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
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
              <div
                ref={setResponseRef}
                className="flex-1 min-h-0 overflow-auto border rounded-md px-4 text-sm"
              >
                {response ? (
                  <MarkdownRenderer content={response} />
                ) : (
                  <div className="text-muted-foreground my-4">
                    You can ask the AI to explain the current flow, modify an existing flow, or create a new flow. For example:
                    <ul className="list-disc pl-8 mt-2 space-y-1">
                      <li>Analyze the functionality and structure of this flow</li>
                      <li>Add a new LLM node to the current flow</li>
                      <li>Create a web crawler flow</li>
                    </ul>
                  </div>
                )}
              </div>
              {dslError &&
                <div className="flex flex-col gap-2">
                  <div className="border rounded-md p-2 bg-red-600/10 overflow-y-auto max-h-24">
                    <pre className="text-wrap break-words text-red-600 text-sm">{dslError}</pre>
                  </div>
                  <Button variant="outline" onClick={() => handleAiAction(true)}>
                    Fix with AI
                  </Button>
                </div>
              }
              <Textarea
                placeholder="Describe what you want to do with the flow..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none min-w-0 h-24"
                disabled={isAiLoading}
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