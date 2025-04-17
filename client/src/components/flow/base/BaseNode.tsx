/*
 * @Author: flwfdd
 * @Date: 2025-04-16 11:13:31
 * @LastEditTime: 2025-04-16 17:02:48
 * @Description: 基础节点组件
 */
import React from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import LabelHandle from './LabelHandle';
import { Separator } from '@/components/ui/separator';

interface HandleConfig {
  id?: string;
  type: 'source' | 'target';
  position: Position;
  limit?: number;
  label?: React.ReactNode;
  className?: string;
  onChange?: (value: any) => void;
}

interface ActionConfig {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

interface BaseNodeProps extends NodeProps {
  title: string;
  description?: string;
  handles?: HandleConfig[];
  actions?: ActionConfig[];
  children?: React.ReactNode;
}

function BaseNode({ title, description, handles = [], actions = [], children }: BaseNodeProps) {
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
              onChange={handle.onChange}
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
              onChange={handle.onChange}
              label={handle.label}
              className={handle.className}
            />
          ))}
      </Card>
    </div>
  );
}

export default BaseNode; 