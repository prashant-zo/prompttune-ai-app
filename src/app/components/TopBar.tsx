import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "firebase/auth";
import Link from "next/link";
import { LogOut, Menu, Moon, PanelLeftClose, Sun } from "lucide-react";
import React from "react";

interface TopBarProps {
  user: User | null;
  authLoading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onSignOut: () => Promise<void>;
  isSidebarOpen: boolean;
}

function TopBar({
  user,
  authLoading,
  theme,
  onToggleTheme,
  onToggleSidebar,
  onSignOut,
  isSidebarOpen,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-background/90 px-3 backdrop-blur-xl transition-colors duration-300 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="h-9 w-9 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="hidden h-9 w-9 lg:inline-flex"
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">PromptTune</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Prompt engineering assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="h-9 w-9"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        {authLoading ? (
          <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        ) : user ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage
                src={user.photoURL || undefined}
                alt={user.displayName || user.email || "User"}
              />
              <AvatarFallback className="text-xs">
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              aria-label="Log out"
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button asChild className="h-9 rounded-full px-4 text-sm">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}

export default React.memo(TopBar);
