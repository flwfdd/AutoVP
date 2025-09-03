import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import Markdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';

// 导入常用语言支持
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';

// 注册语言
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Mermaid渲染组件
const MermaidRenderer: React.FC<{ code: string }> = ({ code }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [svgContent, setSvgContent] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // 初始化 mermaid 配置
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    // 防抖渲染，避免快速输入时重复渲染
    const timeoutId = setTimeout(async () => {
      try {
        // 重置状态
        setIsLoaded(false);
        setHasError(false);
        setErrorMessage('');

        // 生成唯一的 ID
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;

        // 创建一个临时的 DOM 元素供 mermaid 使用
        const tempDiv = document.createElement('div');
        tempDiv.id = id;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);

        try {
          // 渲染 mermaid 图表
          const { svg } = await mermaid.render(id, code);

          // 使用状态来存储 SVG 内容
          setSvgContent(svg);
          setIsLoaded(true);
        } finally {
          // 清理临时元素
          if (tempDiv.parentNode) {
            tempDiv.parentNode.removeChild(tempDiv);
          }
        }
      } catch (error) {
        setHasError(true);
        setIsLoaded(false);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 300); // 300ms 防抖延迟

    // 清理函数：清除定时器和移除 mermaid 创建的临时元素
    return () => {
      clearTimeout(timeoutId);
      // 清理所有以 'mermaid-' 开头的 ID 的元素
      const mermaidElements = document.querySelectorAll('[id^="mermaid-"]');
      mermaidElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    };
  }, [code]);

  // 组件卸载时清理所有 mermaid 元素
  useEffect(() => {
    return () => {
      // 清理所有以 'mermaid-' 开头的 ID 的元素
      const mermaidElements = document.querySelectorAll('[id^="mermaid-"]');
      mermaidElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    };
  }, []);

  if (hasError) {
    return (
      <div className="my-4 p-2 border rounded-lg bg-background">
        <div className="bg-muted p-4 rounded text-sm">
          <div className="text-red-600 font-medium mb-2">Mermaid rendering failed:</div>
          <div className="text-xs text-muted-foreground mb-2">{errorMessage}</div>
          <pre className="bg-background p-2 rounded text-xs overflow-auto">
            {code}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="my-4 p-4 border rounded-lg bg-background">
        <div
          className={`max-w-full max-h-96 mx-auto cursor-pointer transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsModalOpen(true)}
          title="Click to enlarge"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
        {!isLoaded && !hasError && (
          <div className="flex items-center justify-center h-24">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* 模态框 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="bg-background w-full h-full flex flex-col">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-semibold">Mermaid Diagram</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-0">
              <div
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  if (!content) {
    return <div className="text-center text-muted-foreground">No content to display</div>;
  }

  return (
    <div className={className}>
      <Markdown
        rehypePlugins={[rehypeRaw]}
        components={{
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            // 处理mermaid代码块
            if (language === 'mermaid') {
              return <MermaidRenderer code={codeString} />;
            }

            return match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                customStyle={{ margin: '0', borderRadius: '4px' }}
                codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
              >
                {codeString}
              </SyntaxHighlighter>
            ) : (
              <code className={`bg-muted px-1.5 py-0.5 rounded ${className}`} {...rest}>
                {children}
              </code>
            );
          },
          // 为其他元素添加样式
          a({ ...props }) {
            return <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />;
          },
          ul({ ...props }) {
            return <ul className="list-disc pl-6 my-4 space-y-2" {...props} />;
          },
          ol({ ...props }) {
            return <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />;
          },
          li({ ...props }) {
            return <li className="my-1" {...props} />;
          },
          h1({ ...props }) {
            return <h1 className="text-xl font-bold my-4" {...props} />;
          },
          h2({ ...props }) {
            return <h2 className="text-lg font-bold my-3" {...props} />;
          },
          h3({ ...props }) {
            return <h3 className="text-md font-bold my-3" {...props} />;
          },
          blockquote({ ...props }) {
            return <blockquote className="border-l-4 border-muted pl-4 italic my-4" {...props} />;
          },
          hr({ ...props }) {
            return <hr className="my-4 border-muted" {...props} />;
          },
          table({ ...props }) {
            return <table className="border-collapse w-full my-4" {...props} />;
          },
          th({ ...props }) {
            return <th className="border border-muted p-2 bg-muted font-semibold" {...props} />;
          },
          td({ ...props }) {
            return <td className="border border-muted p-2" {...props} />;
          },
          p({ ...props }) {
            return <p className="my-4 leading-relaxed" {...props} />;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer; 