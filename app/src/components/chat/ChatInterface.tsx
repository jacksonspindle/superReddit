'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { scaleFadeVariants, staggerContainerVariants, staggerItemVariants, fadeUpVariants } from '@/lib/motion';
import type { Project } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  project?: Project | null;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-1.5 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 space-y-1 list-disc">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 space-y-1 list-decimal">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="my-2 rounded-lg bg-background/50 p-3 overflow-x-auto">
                <code className="text-xs font-mono">{children}</code>
              </pre>
            );
          }
          return (
            <code className="rounded bg-background/50 px-1.5 py-0.5 text-xs font-mono" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-orange-500/50 pl-3 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-500 underline underline-offset-2 hover:text-orange-400">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
        th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1.5 border-t border-border/50">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatInterface({ project, initialMessages = [], onMessagesChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          project: project
            ? {
                name: project.name,
                productName: project.product_name,
                productDescription: project.product_description,
                targetAudience: project.target_audience,
                tone: project.tone,
              }
            : undefined,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: accumulated,
                    };
                    return updated;
                  });
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: accumulated }];
      setMessages(finalMessages);
      onMessagesChange?.(finalMessages);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        };
        return updated;
      });
    }

    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const suggestedPrompts = [
    'What subreddits should I target for my product?',
    'How do I write a Reddit post that doesn\'t get flagged as spam?',
    'What\'s the best time to post on Reddit?',
    'Help me write an engaging title for my post',
  ];

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="mx-auto max-w-2xl py-6 space-y-6">
          {messages.length === 0 ? (
            <motion.div
              variants={scaleFadeVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-white mb-4">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-semibold mb-2">SuperReddit AI</h2>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                Your Reddit marketing strategist. Ask about subreddit targeting, post writing,
                engagement strategies, and avoiding bans.
              </p>
              <motion.div
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-2 w-full max-w-lg"
              >
                {suggestedPrompts.map((prompt) => (
                  <motion.button
                    key={prompt}
                    variants={staggerItemVariants}
                    onClick={() => setInput(prompt)}
                    className="rounded-lg border p-3 text-left text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            messages.map((message, i) => (
              <motion.div
                key={i}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-orange-500 text-white text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                {message.role === 'user' ? (
                  <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm max-w-[80%]">
                    {message.content}
                  </div>
                ) : (
                  <div className="text-sm max-w-[85%] min-w-0">
                    <MarkdownMessage content={message.content} />
                    {streaming && i === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                )}
                {message.role === 'user' && (
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs">
                      <User className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Reddit marketing strategy..."
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
