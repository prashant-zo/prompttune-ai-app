import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { Trash2, Mail } from "lucide-react";
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
  onSignOut, 
  onDeleteChat,
  isOpen,
  onOpenChange
}: SidebarProps) {
  const formatDate = useCallback((timestamp: Timestamp | null) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
      return 'Processing date...';
    }
    const date = timestamp.toDate();
    return format(date, 'MMM d, h:mm a');
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-[280px] sm:w-72 bg-background text-foreground">
        <div className="flex flex-col h-full p-3 sm:p-4 gap-3 sm:gap-4">
          {/* Logo/App Name */}
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <span className="font-bold text-base sm:text-lg tracking-tight">PromptTune</span>
          </div>

          {/* New Chat Button */}
          <Button 
            className="w-full h-9 sm:h-10 text-sm sm:text-base mb-1 sm:mb-2" 
            variant="default"
            onClick={onNewChat}
          >
            + New Chat
          </Button>

          <Separator />

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto mt-1 sm:mt-2 space-y-1.5 sm:space-y-2">
            {chatHistory && chatHistory.length > 0 ? (
              chatHistory.map(chat => (
                <Card 
                  key={chat.id} 
                  className={`group p-2 sm:p-3 cursor-pointer hover:bg-muted transition-colors ${
                    currentChatId === chat.id ? 'bg-muted' : ''
                  }`}
                >
                  <div 
                    className="flex items-start justify-between gap-1.5 sm:gap-2"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs sm:text-sm font-medium">{chat.title}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatDate(chat.updatedAt)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 sm:h-8 sm:w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : user ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center px-2 py-3 sm:py-4">
                No chats yet. Start a new conversation!
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground text-center px-2 py-3 sm:py-4">
                Login to see your chat history.
              </p>
            )}
          </div>

          <Separator className="my-1 sm:my-2" />

          {/* Contact Me Button */}
          <Button
            className="w-full justify-start font-medium h-9 sm:h-10 text-sm sm:text-base"
            variant="ghost"
            asChild
          >
            <a
              href="mailto:prashantkd010@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 w-full px-2 py-2 rounded-md transition-colors hover:bg-muted"
            >
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Contact Me
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default React.memo(Sidebar); 