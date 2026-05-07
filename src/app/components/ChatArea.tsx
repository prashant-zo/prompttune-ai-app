import React, { useCallback, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join('');
  if (React.isValidElement(node) && node.props?.children) {
    return extractTextFromReactNode(node.props.children);
  }
  return '';
}

export type Message = {
  id: string;
  type: "user" | "ai" | "error";
  text: string;
  attachment?: { url: string; name: string; type: string };
};

function ChatArea({
  messages,
  streamingAI,
  isLoading,
  chatEndRef,
}: {
  messages: Message[];
  streamingAI?: string | null;
  isLoading?: boolean;
  chatEndRef?: React.RefObject<HTMLDivElement>;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const CopyButton = useCallback(({
    copyKey,
    text,
    className,
  }: {
    copyKey: string;
    text: string;
    className?: string;
  }) => {
    const isCopied = copiedPrompt === copyKey;

    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 sm:opacity-0 transition hover:bg-muted hover:text-foreground sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
          className
        )}
        aria-label={isCopied ? 'Copied' : 'Copy'}
        onClick={async () => {
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            setCopiedPrompt(copyKey);
            setTimeout(() => setCopiedPrompt(null), 1400);
          } catch (error) {
            console.error('Failed to copy text:', error);
          }
        }}
      >
        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    );
  }, [copiedPrompt]);

  const markdownComponents = useCallback((message: Message) => {
    let blockquoteIndex = 0;

    return {
      blockquote: ({ children, ...props }: any) => {
        const key = `${message.id}-quote-${blockquoteIndex++}`;
        const text = extractTextFromReactNode(children).trim();

        return (
          <blockquote className="group relative" {...props}>
            <CopyButton
              copyKey={key}
              text={text}
              className="absolute right-2 top-2 bg-background/80 backdrop-blur"
            />
            {children}
          </blockquote>
        );
      },
      pre: ({ node, children, className, ...props }: any) => {
        let rawText = "";
        if (node?.children?.[0]?.tagName === 'code') {
          rawText = node.children[0].children
            ?.filter((childNode: any) => childNode.type === 'text')
            .map((textNode: any) => textNode.value)
            .join('') || "";
        }
        if (!rawText && children) {
          rawText = extractTextFromReactNode(children);
        }
        rawText = rawText.replace(/\n$/, "");

        return (
          <div className="group relative my-4">
            <pre
              {...props}
              className={cn("overflow-x-auto rounded-xl bg-muted p-4 text-sm text-foreground transition-colors duration-300", className)}
            >
              {children}
            </pre>
            {rawText && (
              <CopyButton
                copyKey={`${message.id}-code-${rawText}`}
                text={rawText}
                className="absolute right-2 top-2 bg-background/80 backdrop-blur"
              />
            )}
          </div>
        );
      },
      code({ inline, className, children, ...props }: any) {
        if (inline) {
          return (
            <code
              className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm", className)}
              {...props}
            >
              {children}
            </code>
          );
        }
        return <code className={cn(className, 'font-mono')} {...props}>{children}</code>;
      },
    };
  }, [CopyButton]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
        {messages.map((message) => {
          const isUser = message.type === "user";
          const isError = message.type === "error";

          return (
            <article
              key={message.id}
              className={cn("group flex w-full gap-3 sm:gap-4", isUser && "justify-end")}
            >
              {!isUser && (
                <div className={cn(
                  "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isError ? "bg-destructive/15 text-destructive" : "bg-foreground text-background"
                )}>
                  {isError ? "!" : "PT"}
                </div>
              )}
              <div
                className={cn(
                  "min-w-0 max-w-[88%] text-[15px] leading-7 sm:max-w-[78%]",
                  isUser
                    ? "rounded-3xl bg-primary px-4 py-2.5 text-primary-foreground transition-colors duration-300"
                    : isError
                    ? "rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive font-medium transition-colors duration-300"
                    : "flex-1 text-foreground"
                )}
              >
                {message.type === 'ai' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents(message)}
                    className="prose prose-neutral max-w-none text-foreground prose-p:my-3 prose-headings:mb-3 prose-headings:mt-6 prose-pre:my-0 prose-blockquote:rounded-xl prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:bg-muted/60 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic dark:prose-invert"
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <div className="flex flex-col gap-2">
                    {message.attachment && (
                      <div className="flex max-w-xs items-center gap-2 rounded-xl border border-border/50 bg-background/50 p-2 pr-4 shadow-sm">
                        {message.attachment.type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={message.attachment.url} alt="Attachment" className="h-10 w-10 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                             <span className="text-[10px] font-bold text-sky-500 uppercase">PDF</span>
                          </div>
                        )}
                        <span className="truncate text-sm font-medium text-foreground">{message.attachment.name}</span>
                      </div>
                    )}
                    {message.text && <span className="whitespace-pre-wrap break-words">{message.text}</span>}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {streamingAI && (
          <article className="flex w-full gap-3 sm:gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              PT
            </div>
            <div className="min-w-0 flex-1 text-[15px] leading-7">
              <span className="whitespace-pre-wrap">{streamingAI + (isLoading ? "\u258c" : "")}</span>
            </div>
          </article>
        )}

        {isLoading && !streamingAI && messages.length > 0 && (
          <article className="flex w-full gap-3 sm:gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              PT
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 delay-100" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 delay-200" />
            </div>
          </article>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export default React.memo(ChatArea);
