'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Bot, User, FileText, X, ArrowUp, MessageSquare, Check, PenLine, ImagePlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { scaleFadeVariants, staggerContainerVariants, staggerItemVariants, fadeUpVariants } from '@/lib/motion';
import { useProfileStore } from '@/stores/profile-store';
import type { Project } from '@/types';
import type { ReferencePost } from '@/stores/create-store';

interface ImageAttachment {
  id: string;
  dataUrl: string; // data:image/...;base64,...
  name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
  references?: ReferencePost[];
}

interface PostDraft {
  style?: string;
  title: string;
  body: string;
}

interface ChatInterfaceProps {
  project?: Project | null;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  onApplyDraft?: (draft: PostDraft) => void;
  editorContent?: { title: string; body: string } | null;
  attachments?: ReferencePost[];
  onRemoveAttachment?: (id: string) => void;
  onClearAttachments?: () => void;
  apiEndpoint?: string;
  placeholder?: string;
  suggestedPrompts?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Replace em/en dashes with commas or remove them */
function stripDashes(text: string): string {
  // " — " or " – " (surrounded by spaces) → ", "
  return text.replace(/\s[—–]\s/g, ', ').replace(/[—–]/g, ', ');
}

/** Extract all ```post JSON blocks from a message */
function extractPostDrafts(content: string): PostDraft[] {
  const drafts: PostDraft[] = [];
  const regex = /```post\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.title && parsed.body) {
        drafts.push({
          style: parsed.style || undefined,
          title: stripDashes(parsed.title),
          body: stripDashes(parsed.body.replace(/\\n/g, '\n')),
        });
      }
    } catch {
      // not valid JSON
    }
  }
  return drafts;
}

/** Strip ```post blocks from content for display purposes.
 *  When streaming, also strips incomplete blocks (opened but not yet closed). */
function stripPostBlock(content: string, stripIncomplete = false): string {
  // Strip complete ```post ... ``` blocks
  let result = content.replace(/```post\s*\n[\s\S]*?\n```/g, '').trim();
  // Strip in-progress block that hasn't closed yet
  if (stripIncomplete) {
    result = result.replace(/```post[\s\S]*$/g, '').trim();
  }
  return result;
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

export function ChatInterface({
  project,
  initialMessages = [],
  onMessagesChange,
  onApplyDraft,
  editorContent,
  attachments = [],
  onRemoveAttachment,
  onClearAttachments,
  apiEndpoint = '/api/ai/chat',
  placeholder = 'Ask about Reddit marketing strategy...',
  suggestedPrompts: suggestedPromptsProp,
  emptyTitle = 'SuperReddit AI',
  emptyDescription = 'Your Reddit marketing strategist. Ask about subreddit targeting, post writing, engagement strategies, and avoiding bans.',
}: ChatInterfaceProps) {
  const { avatarUrl: profileAvatarUrl, fetchProfile } = useProfileStore();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), dataUrl: reader.result as string, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function doSend(content: string) {
    if ((!content.trim() && pendingImages.length === 0) || streaming) return;

    // Capture and clear pending images
    const imagesToSend = [...pendingImages];
    setPendingImages([]);

    // Capture and clear reference post attachments
    const refsToSend = attachments.length > 0 ? [...attachments] : undefined;
    if (refsToSend) {
      onClearAttachments?.();
    }

    // Build context from editor content + reference posts
    let fullContent = content.trim();

    // Inject current editor content so the AI knows what post the user is working on
    if (editorContent && (editorContent.title || editorContent.body)) {
      fullContent += `\n\n---\n**Current post in editor:**\nTitle: ${editorContent.title || '[no title]'}\nBody: ${editorContent.body || '[no body]'}`;
    }

    if (refsToSend) {
      const refContext = refsToSend.map((ref) => {
        const bodyPreview = ref.body
          ? ref.body.slice(0, 500) + (ref.body.length > 500 ? '...' : '')
          : '[link post]';
        return `- **${ref.title}** (r/${ref.subreddit}, ${ref.score} upvotes, ${ref.numComments} comments)\n  ${bodyPreview}`;
      }).join('\n\n');
      fullContent += `\n\n---\n**Reference posts I'm using as context:**\n${refContext}`;
    }

    const userMessage: Message = { role: 'user', content: fullContent, images: imagesToSend.length > 0 ? imagesToSend : undefined };
    const displayMessage: Message = { role: 'user', content: content.trim(), images: imagesToSend.length > 0 ? imagesToSend : undefined, references: refsToSend };
    const newMessages = [...messages, userMessage];
    const displayMessages = [...messages, displayMessage];
    setMessages(displayMessages);
    setInput('');
    setStreaming(true);

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages([...displayMessages, assistantMessage]);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images?.map((img) => ({ dataUrl: img.dataUrl })),
          })),
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

      const finalMessages = [...displayMessages, { role: 'assistant' as const, content: accumulated }];
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

  async function handleSend() {
    await doSend(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const defaultPrompts = [
    'Help me write a Reddit post for my product',
    'How do I write a post that doesn\'t get flagged as spam?',
    'Write me a post draft based on my reference posts',
    'Help me write an engaging title for my post',
  ];
  const suggestedPrompts = suggestedPromptsProp ?? defaultPrompts;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-3" ref={scrollRef}>
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <motion.div
              variants={scaleFadeVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center py-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white mb-3">
                <Bot className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold mb-1">{emptyTitle}</h2>
              <p className="text-xs text-muted-foreground text-center mb-4 max-w-sm">
                {emptyDescription}
              </p>
              <motion.div
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-1.5 w-full max-w-sm"
              >
                {suggestedPrompts.map((prompt) => (
                  <motion.button
                    key={prompt}
                    variants={staggerItemVariants}
                    onClick={() => setInput(prompt)}
                    className="rounded-lg border p-2 text-left text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            messages.map((message, i) => {
              const isLastAssistant = message.role === 'assistant' && streaming && i === messages.length - 1;
              const drafts = message.role === 'assistant' && !isLastAssistant
                ? extractPostDrafts(message.content)
                : [];
              const displayContent = message.role === 'assistant'
                ? stripPostBlock(message.content, isLastAssistant)
                : message.content;

              return (
                <motion.div
                  key={i}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-orange-500 text-white text-xs">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={message.role === 'user'
                    ? 'rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-xs max-w-[85%]'
                    : 'text-xs max-w-[90%] min-w-0'
                  }>
                    {message.role === 'assistant' ? (
                      <>
                        {displayContent && <MarkdownMessage content={displayContent} />}
                        {isLastAssistant && !displayContent && (
                          <div className="flex items-center gap-1.5 py-1">
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">Writing drafts...</span>
                          </div>
                        )}
                        {isLastAssistant && displayContent && (
                          <span className="inline-block w-1.5 h-3.5 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                        )}
                        {drafts.length > 1 && (
                          <div className="mt-2 space-y-2">
                            {drafts.map((draft, draftIdx) => (
                              <div key={draftIdx} className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-orange-500" />
                                    <span className="text-[11px] font-semibold text-orange-500">
                                      {draft.style || `Option ${draftIdx + 1}`}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-3"
                                    disabled={streaming}
                                    onClick={() => {
                                      const label = draft.style || `option ${draftIdx + 1}`;
                                      doSend(`I'll go with the "${label}" draft. Show me the full post so we can refine it.`);
                                    }}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Choose
                                  </Button>
                                </div>
                                <p className="text-[11px] font-medium mb-0.5 line-clamp-2">{draft.title}</p>
                                <p className="text-[10px] text-muted-foreground line-clamp-3">{draft.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {drafts.length === 1 && (
                          <div className="mt-2">
                            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <FileText className="h-3.5 w-3.5 text-orange-500" />
                                <span className="text-[11px] font-semibold text-orange-500">
                                  {drafts[0].style || 'Draft'}
                                </span>
                              </div>
                              <p className="text-[12px] font-semibold mb-1.5">{drafts[0].title}</p>
                              <div className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {drafts[0].body}
                              </div>
                              {onApplyDraft && (
                                <div className="mt-3 pt-2.5 border-t border-orange-500/20 flex justify-center">
                                  <Button
                                    size="sm"
                                    className="h-7 text-[10px] px-6"
                                    onClick={() => onApplyDraft(drafts[0])}
                                  >
                                    <PenLine className="h-3 w-3 mr-1.5" />
                                    Apply to Editor
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {message.references && message.references.length > 0 && (
                          <div className="flex gap-1.5 mb-1.5 overflow-x-auto">
                            {message.references.map((ref) => (
                              <a
                                key={ref.id}
                                href={`https://reddit.com${ref.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 w-44 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 p-1.5 block hover:bg-primary-foreground/15 transition-colors"
                              >
                                <div className="flex gap-1.5">
                                  {ref.thumbnail && (
                                    <img src={ref.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[8px] opacity-70">r/{ref.subreddit}</span>
                                    <p className="text-[10px] font-medium leading-tight line-clamp-2">{ref.title}</p>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                        {message.images && message.images.length > 0 && (
                          <div className="flex gap-1.5 mb-1.5 flex-wrap">
                            {message.images.map((img) => (
                              <img
                                key={img.id}
                                src={img.dataUrl}
                                alt={img.name}
                                className="max-w-[200px] max-h-[140px] rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {message.content && <span>{message.content}</span>}
                      </>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      {profileAvatarUrl && <AvatarImage src={profileAvatarUrl} alt="You" />}
                      <AvatarFallback className="text-xs">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t p-2.5 shrink-0">
        {attachments.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pt-2 pb-1 -mt-0.5">
            {attachments.map((ref) => (
              <div
                key={ref.id}
                className="relative shrink-0 w-52 rounded-lg border bg-card group"
              >
                {onRemoveAttachment && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveAttachment(ref.id); }}
                    className="absolute top-1 right-1 rounded-full bg-muted/80 border p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <a
                  href={`https://reddit.com${ref.permalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <div className="flex gap-2">
                    {ref.thumbnail && (
                      <img
                        src={ref.thumbnail}
                        alt=""
                        className="w-10 h-10 rounded object-cover shrink-0 mt-0.5"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[9px] font-medium text-orange-500 truncate">r/{ref.subreddit}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
                          <ArrowUp className="h-2.5 w-2.5" />
                          {ref.score >= 1000 ? `${(ref.score / 1000).toFixed(1)}k` : ref.score}
                        </span>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {ref.numComments}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium leading-tight line-clamp-2">{ref.title}</p>
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        )}
        {pendingImages.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto">
            {pendingImages.map((img) => (
              <div key={img.id} className="relative shrink-0 group">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-16 w-16 rounded-lg object-cover border"
                />
                <button
                  onClick={() => removePendingImage(img.id)}
                  className="absolute -top-1 -right-1 rounded-full bg-muted/90 border p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
          >
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[36px] max-h-24 resize-none text-xs"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && pendingImages.length === 0) || streaming}
            size="icon"
            className="h-9 w-9 shrink-0"
          >
            {streaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
