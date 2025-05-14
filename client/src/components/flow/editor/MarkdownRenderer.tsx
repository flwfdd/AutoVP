import React from 'react';
import Markdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';

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
                        return match ? (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: '0', borderRadius: '4px' }}
                                codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code className={`bg-muted px-1.5 py-0.5 rounded ${className}`} {...rest}>
                                {children}
                            </code>
                        );
                    },
                    // 为其他元素添加样式
                    a({ node, ...props }) {
                        return <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />;
                    },
                    ul({ node, ...props }) {
                        return <ul className="list-disc pl-6 my-4 space-y-2" {...props} />;
                    },
                    ol({ node, ...props }) {
                        return <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />;
                    },
                    li({ node, ...props }) {
                        return <li className="my-1" {...props} />;
                    },
                    h1({ node, ...props }) {
                        return <h1 className="text-xl font-bold my-4" {...props} />;
                    },
                    h2({ node, ...props }) {
                        return <h2 className="text-lg font-bold my-3" {...props} />;
                    },
                    h3({ node, ...props }) {
                        return <h3 className="text-md font-bold my-3" {...props} />;
                    },
                    blockquote({ node, ...props }) {
                        return <blockquote className="border-l-4 border-muted pl-4 italic my-4" {...props} />;
                    },
                    hr({ node, ...props }) {
                        return <hr className="my-4 border-muted" {...props} />;
                    },
                    table({ node, ...props }) {
                        return <table className="border-collapse w-full my-4" {...props} />;
                    },
                    th({ node, ...props }) {
                        return <th className="border border-muted p-2 bg-muted font-semibold" {...props} />;
                    },
                    td({ node, ...props }) {
                        return <td className="border border-muted p-2" {...props} />;
                    },
                    p({ node, ...props }) {
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