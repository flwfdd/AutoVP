import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { llm } from "@/lib/llm";
import { Loader, Sparkles } from "lucide-react";
import { toast } from "sonner";
import config from "@/lib/config";

interface EditInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  name: string;
  descriptionText: string;
  contextPrompt?: string; // 添加上下文信息字段
  onSave: (name: string, description: string) => void;
}

export default function EditInfoDialog({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  name: initialName,
  descriptionText: initialDescription,
  contextPrompt,
  onSave,
}: EditInfoDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSave = () => {
    onSave(name, description);
    onOpenChange(false);
  };

  const handleAutoGenerate = async () => {
    if (!contextPrompt) {
      toast.error("No context information available for generation.");
      return;
    }

    setIsGenerating(true);
    try {
      const systemPrompt = `You are an expert at analyzing and describing flows and nodes. 
Your task is to generate a concise name and description based on the provided context.`;

      const userPrompt = `Please analyze the following context and generate a name and description:
${contextPrompt}

Call the generate_info tool to generate the name and description.`;

      const tools = [
        {
          name: "generate_info",
          description: "Generate name and description for the item",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "A short, descriptive name (max 20 characters)"
              },
              description: {
                type: "string",
                description: "A clear description of the purpose and functionality"
              }
            },
            required: ["name", "description"]
          }
        }
      ];

      const result = await llm(config.codeEditorModel, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], tools);

      if (result.tool_calls && result.tool_calls.length > 0) {
        const toolCall = result.tool_calls[0];
        if (toolCall.function.name === "generate_info" && toolCall.function.arguments) {
          const args = JSON.parse(toolCall.function.arguments);
          setName(args.name || initialName);
          setDescription(args.description || initialDescription);
          toast.success("Name and description generated successfully!");
        }
      } else {
        toast.error("Failed to generate name and description.");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Generation failed: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription>
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">
                Name
              </Label>
              {contextPrompt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerate}
                  disabled={isGenerating}
                  className="h-6 px-2 text-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="h-3 w-3 animate-spin mr-1" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Auto Generate
                    </>
                  )}
                </Button>
              )}
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
