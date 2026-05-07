import { Button } from "@/components/ui/button";
import { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { Mail, MessageSquareText, Plus, Trash2, X } from "lucide-react";
import React, { useCallback } from "react";

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: Timestamp | null;
}

interface SidebarProps {
  user: User | null;
  chatHistory: ChatHistoryItem[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onSignOut: () => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function Sidebar({
  user,
  chatHistory,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isOpen,
  onOpenChange,
}: SidebarProps) {
  const formatDate = useCallback((timestamp: Timestamp | null) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
      return 'Saving...';
    }
    const date = timestamp.toDate();
    const currentYear = new Date().getFullYear();
    const isCurrentYear = date.getFullYear() === currentYear;
    return format(date, isCurrentYear ? 'MMM d' : 'MMM d, yyyy');
  }, []);

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-border/70 bg-muted/35 text-foreground transition-colors duration-300 dark:bg-neutral-950">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">PromptTune</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email || 'Guest'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 lg:hidden"
          onClick={() => onOpenChange(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-3">
        <Button
          className="h-10 w-full justify-start rounded-xl bg-background text-foreground shadow-sm transition-colors duration-300 hover:bg-background/80 dark:bg-neutral-900"
          variant="outline"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent
        </div>
        {chatHistory.length > 0 ? (
          <div className="space-y-1">
            {chatHistory.map(chat => {
              const active = currentChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors duration-300 ${
                    active ? 'bg-background shadow-sm dark:bg-neutral-900' : 'hover:bg-background/70 dark:hover:bg-neutral-900/70'
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <div className="truncate text-sm font-medium">{chat.title || 'Untitled chat'}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => onDeleteChat(chat.id)}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Your chats will appear here.
          </div>
        )}
      </div>

      <div className="border-t border-border/70 p-3">
        <Button className="h-10 w-full justify-start rounded-xl" variant="ghost" asChild>
          <a href="mailto:prashantkd010@gmail.com">
            <Mail className="h-4 w-4" />
            Contact
          </a>
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className={`${isOpen ? 'hidden lg:block' : 'hidden'} h-full shrink-0`}>
        {sidebar}
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close sidebar"
          />
          <div className="relative h-full w-72 max-w-[86vw] shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(Sidebar);
