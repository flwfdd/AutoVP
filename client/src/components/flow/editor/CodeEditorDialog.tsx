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
import { llm } from '@/lib/llm';
import { Editor } from '@monaco-editor/react';
import { Loader, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import MarkdownRenderer from './MarkdownRenderer';

interface CodeEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  onCodeChange: (newCode: string) => void;
  language: 'javascript' | 'python';
  title: string;
  systemPrompt: string;
}

function CodeEditorDialog({
  isOpen,
  onClose,
  code,
  onCodeChange,
  language,
  title,
  systemPrompt,
}: CodeEditorDialogProps) {
  const [internalCode, setInternalCode] = useState(code);
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isShowAiPanel, setIsShowAiPanel] = useState(true);
  const [response, setResponse] = useState('');
  useEffect(() => {
    if (isOpen) {
      setInternalCode(code);
    }
  }, [code, isOpen]);

  const handleSave = () => {
    onCodeChange(internalCode);
    onClose();
  };

  const handleAiAction = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await llm(configGlobal.codeEditorModel, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${prompt}\n\nCurrent Code:\`\`\`${language}\n${internalCode}\`\`\`` },
      ]);
      if (response) {
        setResponse(response);
        const codeBlockMatch = response.match(/```(?:[a-zA-Z]+)?\n([\s\S]*?)\n```/);
        setInternalCode(codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim() : response.trim());
      } else {
        toast.error('AI returned an empty response.');
      }
    } catch (error: any) {
      setResponse(error.message);
      toast.error('Error during AI code generation: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-w-full max-w-full min-h-full max-h-full rounded-none flex flex-col p-4 [&>button]:hidden">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{title}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsShowAiPanel(!isShowAiPanel)}>
              {isShowAiPanel ? <PanelRightClose /> : <PanelLeftClose />}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-row gap-2 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden border rounded-md">
            <Editor
              language={language}
              value={internalCode}
              onChange={(value) => setInternalCode(value || '')}
              theme="vs-dark"
            />
          </div>

          {isShowAiPanel && (
            <div className="w-1/3 flex flex-col gap-2">
              <div className="font-medium text-center">AI Code Assistant</div>
              <div className="flex-1 overflow-hidden flex flex-col gap-2 p-2">
                <div className="flex-2 min-h-0 overflow-auto border rounded-md px-4 text-sm">
                  {response ? (
                    <MarkdownRenderer content={response} />
                  ) : (
                    <div className="text-center text-muted-foreground">Ask AI to generate or change the code...</div>
                  )}
                </div>
                <Textarea
                  placeholder={`Describe what you want to generate or change in the code...`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 resize-none text-sm"
                  disabled={isAiLoading}
                />
              </div>
              <Button
                type="button"
                onClick={handleAiAction}
                disabled={isAiLoading || !prompt.trim()}
              >
                {isAiLoading ? (
                  <>
                    <Loader className="animate-spin" /> Generating...
                  </>
                ) : (
                  `Generate`
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isAiLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isAiLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CodeEditorDialog; 