import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INodeProps } from '@/lib/flow/flow';
import { HelpCircle } from "lucide-react";
import LabelHandle from './LabelHandle';

function BaseNode({ title, description, handles = [], actions = [], children }: INodeProps<any, any>) {
  return (
    <div>
      <Card className="focus:ring focus:ring-ring p-0 pb-2 gap-0 w-60" tabIndex={-1}>
        <CardHeader className='flex items-center justify-between px-4 py-2'>
          <div className='flex items-center space-x-1'>
            <span>{title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className='max-w-xs'>{description || `${title} node`}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className='flex items-center space-x-1'>
            {actions.map((action, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                {action.tooltip && (
                  <TooltipContent>
                    <p>{action.tooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </CardHeader>
        <Separator />
        {handles
          .filter((handle) => handle.type === 'target')
          .map((handle, index) => (
            <LabelHandle
              key={handle.id || index}
              id={handle.id}
              type={handle.type}
              position={handle.position}
              limit={handle.limit}
              label={handle.label}
              className={handle.className}
            />
          ))}
        <CardContent className='p-2'>
          {children}
        </CardContent>
        {handles
          .filter((handle) => handle.type === 'source')
          .map((handle, index) => (
            <LabelHandle
              key={handle.id || index}
              id={handle.id}
              type={handle.type}
              position={handle.position}
              limit={handle.limit}
              label={handle.label}
              className={handle.className}
            />
          ))}
      </Card>
    </div>
  );
}

export default BaseNode; 