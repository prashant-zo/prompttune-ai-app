'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { refinePromptOrGeneratePath } from './actions';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase-auth';
import { firestore } from '../lib/firebase-firestore';
import { storage } from '../lib/firebase-storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChatAreaComponent from "./components/ChatArea";
import MessageInputComponent from "./components/MessageInput";
import { useRouter } from 'next/navigation';
import { ArrowRight, Moon, Sparkles, Sun } from 'lucide-react';
import { compressImage } from '../lib/image-utils';
import Image from "next/image";

type Message = {
  id: string;
  type: 'user' | 'ai' | 'error';
  text: string;
  timestamp: Timestamp;
  attachment?: { url: string; name: string; type: string };
};

type ChatHistoryItem = {
  id: string;
  title: string;
  updatedAt: Timestamp;
};

// Helper functions for Firestore chat management
async function createNewChatInFirestore(userId: string, firstMessageText: string, firstMessageId: string, attachment?: { url: string; name: string; type: string }): Promise<string | null> {
  try {
    const userMessageForFirestore = {
      id: firstMessageId,
      type: 'user' as const,
      text: firstMessageText,
      timestamp: Timestamp.now(),
      ...(attachment ? { attachment } : {})
    };
    const newChatRef = await addDoc(collection(firestore, 'users', userId, 'chats'), {
      title: (firstMessageText || (attachment ? attachment.name : 'Untitled')).substring(0, 30),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages: [userMessageForFirestore],
    });
    return newChatRef.id;
  } catch (e) {
    console.error("Error creating new chat in Firestore:", e);
    return null;
  }
}

// FIX #11: Propagate errors instead of silently swallowing them
async function addMessageToChatInFirestore(userId: string, chatId: string, messagePayload: { id: string; type: 'user' | 'ai' | 'error'; text: string; attachment?: { url: string; name: string; type: string } }) {
  const messageForFirestore = {
    ...messagePayload,
    timestamp: Timestamp.now(),
  };
  const chatDocRef = doc(firestore, 'users', userId, 'chats', chatId);
  await updateDoc(chatDocRef, {
    messages: arrayUnion(messageForFirestore),
    updatedAt: serverTimestamp(),
  });
}

function HomeContent() {
  // Core state variables
  const [userInput, setUserInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [streamingAI, setStreamingAI] = useState<string | null>(null);
  const [chatHistoryList, setChatHistoryList] = useState<ChatHistoryItem[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmailResent, setVerificationEmailResent] = useState(false);
  const [verificationStatusMessage, setVerificationStatusMessage] = useState<string | null>(null);
  const [chatPendingDeletion, setChatPendingDeletion] = useState<string | null>(null);

  // Refs
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auth
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Check email verification status
  useEffect(() => {
    if (!authLoading) {
      if (user && !user.emailVerified) {
        setShowVerificationModal(true);
      } else {
        setShowVerificationModal(false);
        setVerificationStatusMessage(null);
      }
    }
  }, [user, authLoading]);

  // Chat management functions
  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setUserInput("");
    setAttachedFile(null);
    setStreamingAI(null);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleSelectChat = useCallback((chatId: string) => {
    if (chatId === currentChatId) return;
    setCurrentChatId(chatId);
    setMessages([]);
    setStreamingAI(null);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [currentChatId]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentChatId(null);
      setMessages([]);
      setChatHistoryList([]);
      setUserInput("");
      setAttachedFile(null);
      setStreamingAI(null);
    } catch (error) {
      console.error("Error signing out:", error);
      setAuthError("Failed to sign out");
    }
  }, []);

  const requestDeleteChat = useCallback(async (chatId: string) => {
    setChatPendingDeletion(chatId);
  }, []);

  const confirmDeleteChat = useCallback(async () => {
    if (!user) return;
    const chatId = chatPendingDeletion;
    if (!chatId) return;

    try {
      const chatRef = doc(firestore, 'users', user.uid, 'chats', chatId);
      await deleteDoc(chatRef);
      setAuthError(null);

      if (chatId === currentChatId) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      setAuthError("Failed to delete chat");
    } finally {
      setChatPendingDeletion(null);
    }
  }, [user, chatPendingDeletion, currentChatId, handleNewChat]);

  const handleResendVerificationEmail = useCallback(async () => {
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user);
        setVerificationEmailResent(true);
        setVerificationStatusMessage("Verification email sent. Please check your inbox and spam folder.");
        setTimeout(() => setVerificationEmailResent(false), 15000);
      } catch (error) {
        console.error("Error resending verification email:", error);
        setVerificationStatusMessage("Failed to resend verification email. Please try again later.");
      }
    }
  }, [user]);

  // Theme initialization and management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    } else {
      setTheme('light');
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('light');
    }
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    setIsSidebarOpen(desktopQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsSidebarOpen(event.matches);
    };

    desktopQuery.addEventListener('change', handleChange);
    return () => desktopQuery.removeEventListener('change', handleChange);
  }, [themeLoaded]);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme, themeLoaded]);

  // Auto-scroll effect
  useEffect(() => {
    if (messages.length > 0 || streamingAI) {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingAI]);

  // Fetch chat history
  useEffect(() => {
    if (!user) {
      setChatHistoryList([]);
      return;
    }

    const chatsRef = collection(firestore, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats: ChatHistoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chats.push({
          id: doc.id,
          title: data.title,
          updatedAt: data.updatedAt,
        });
      });
      setChatHistoryList(chats);
    }, (error) => {
      console.error("Error fetching chat history:", error);
      setAuthError("Failed to load chat history");
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch messages for current chat
  useEffect(() => {
    if (!user || !currentChatId) {
      setMessages([]);
      return;
    }

    const chatRef = doc(firestore, 'users', user.uid, 'chats', currentChatId);

    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
      setAuthError("Failed to load messages");
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  const handleSubmit = async (forcedInput?: string | React.FormEvent) => {
    const inputStr = typeof forcedInput === 'string' ? forcedInput : userInput;
    const currentInput = inputStr.trim();
    if (!currentInput && !attachedFile) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!user.emailVerified) {
      setShowVerificationModal(true);
      return;
    }

    setIsLoading(true);

    let currentFile = attachedFile;
    if (currentFile && currentFile.type.startsWith('image/')) {
      try {
        currentFile = await compressImage(currentFile);
      } catch (err) {
        console.warn("Image compression failed, falling back to original", err);
      }
    }

    // FIX #3: Use crypto.randomUUID() instead of Date.now() to prevent collisions
    const userMessageId = crypto.randomUUID();

    // NEW: Get base64 data for the AI call (optimization to bypass upload latency/CORS)
    let base64Data: string | null = null;
    if (currentFile) {
      base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(currentFile!);
      });
    }

    // FIX #5: Track blob URL so we can revoke it after Firebase upload
    let blobUrl: string | null = null;
    if (currentFile) {
      blobUrl = URL.createObjectURL(currentFile);
    }

    const optimisticUserMessage: Message = {
      id: userMessageId,
      type: 'user',
      text: currentInput,
      timestamp: Timestamp.now(),
      ...(blobUrl && currentFile ? { attachment: { url: blobUrl, name: currentFile.name, type: currentFile.type } } : {})
    };
    setMessages(prev => [...prev, optimisticUserMessage]);
    setUserInput('');
    setAttachedFile(null);
    setAuthError(null);

    try {
      let activeChatId = currentChatId;

      // We start the upload and the AI call IN PARALLEL for top-tier speed
      let uploadPromise: Promise<{ url: string; name: string; type: string }> | null = null;

      if (currentFile) {
        uploadPromise = (async () => {
          // FIX #10: Strip path traversal characters from filename
          const safeName = currentFile!.name.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const filename = `${userMessageId}_${safeName}`;
          const storageRef = ref(storage, `users/${user.uid}/attachments/${filename}`);
          await uploadBytes(storageRef, currentFile!);
          const url = await getDownloadURL(storageRef);

          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = null;
          }

          return { url, name: currentFile!.name, type: currentFile!.type };
        })();
      }

      const userMessageToSaveToDb = {
        id: userMessageId,
        type: 'user' as const,
        text: currentInput,
      };

      // Step 1: Create/Update the message in Firestore IMMEDIATELY (without attachment yet)
      if (!activeChatId) {
        const newChatId = await createNewChatInFirestore(user.uid, currentInput, userMessageId, undefined);
        if (newChatId) {
          activeChatId = newChatId;
          setCurrentChatId(newChatId);
        } else {
          setMessages(prev => [
            ...prev.filter(msg => msg.id !== userMessageId),
            { id: crypto.randomUUID(), type: 'error' as const, text: 'Failed to start new chat.', timestamp: Timestamp.now() }
          ]);
          setIsLoading(false);
          return;
        }
      } else {
        await addMessageToChatInFirestore(user.uid, activeChatId, userMessageToSaveToDb);
      }

      // Step 2: Start the AI call IMMEDIATELY using the base64 data
      if (activeChatId) {
        const conversationHistoryForAI = messages
          .filter(m => m.id !== userMessageId)
          .filter(m => m.type === 'user' || m.type === 'ai')
          .map(m => ({
            role: m.type === 'user' ? 'user' as const : 'model' as const,
            parts: m.text ? [{ text: m.text }] : [],
          }));

        const currentParts: any[] = [];
        if (currentInput) currentParts.push({ text: currentInput });
        if (currentFile && base64Data) {
          currentParts.push({
            url: 'https://placeholder.com', // Placeholder for AI context
            mimeType: currentFile.type,
            base64Data: base64Data
          });
        }

        // Start AI generation in parallel with background upload
        const aiPromise = refinePromptOrGeneratePath(currentParts, conversationHistoryForAI, user.uid);

        // Step 3: Handle the background upload silently
        if (uploadPromise) {
          uploadPromise.then(async (metadata) => {
            // Update the message in Firestore with the real URL once uploaded
            try {
              const chatDocRef = doc(firestore, 'users', user!.uid, 'chats', activeChatId!);
              const docSnap = await getDoc(chatDocRef);
              if (docSnap.exists()) {
                const chatData = docSnap.data();
                const updatedMessages = (chatData.messages || []).map((msg: any) =>
                  msg.id === userMessageId ? { ...msg, attachment: metadata } : msg
                );
                await updateDoc(chatDocRef, { messages: updatedMessages });
              }
            } catch (e) {
              console.error("Failed to update message with real URL:", e);
            }
          }).catch(e => console.error("Background upload failed:", e));
        }

        // Step 4: Wait for AI response
        const result = await aiPromise;
        setStreamingAI(null);

        if (result.success && result.data) {
          const aiMessagePayload = { id: crypto.randomUUID(), type: 'ai' as const, text: result.data };
          await addMessageToChatInFirestore(user.uid, activeChatId, aiMessagePayload);
        } else {
          const errorText = result.error || 'AI failed to respond.';
          const errorMessagePayload = { id: crypto.randomUUID(), type: 'error' as const, text: errorText };
          await addMessageToChatInFirestore(user.uid, activeChatId, errorMessagePayload);
        }
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      // FIX #5: Clean up blob URL on error path too
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      // FIX #7: Single setState call instead of two sequential ones
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== userMessageId),
        { id: crypto.randomUUID(), type: 'error' as const, text: error.message || 'An unexpected error occurred.', timestamp: Timestamp.now() }
      ]);
      setStreamingAI(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!themeLoaded) {
    return null;
  }

  // Block app if required env variable is missing
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-lg p-8 rounded-xl border border-destructive bg-destructive/10 text-destructive text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-4">App Not Configured</h1>
          <p className="mb-2">This app is not configured for public use. Please set up your own Firebase and API keys in a <code>.env.local</code> file to run this project.</p>
          <p className="text-sm text-muted-foreground">See the README for setup instructions.</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100 dark:bg-neutral-900">
        <p className="text-xl text-slate-700 dark:text-slate-300">Loading application...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-dvh bg-background text-foreground ${theme}`}>
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/icon0.svg"
                alt="PromptTune logo"
                width={36}
                height={36}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="font-semibold">PromptTune</span>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </header>

        <main className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Clean prompt engineering, without the friction
            </div>
            <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl lg:text-6xl">
              Turn rough ideas into better prompts.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              PromptTune helps you shape clear beginner, intermediate, and advanced prompts in a focused chat workspace.
            </p>
            <button
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/90"
              onClick={() => router.push('/login')}
            >
              Start chatting
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-muted/35 p-3 shadow-sm dark:bg-neutral-950">
            <div className="rounded-[1.35rem] bg-background p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="space-y-4 text-sm">
                <div className="ml-auto max-w-[82%] rounded-3xl bg-muted px-4 py-3">
                  Create a prompt for a landing page redesign
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    PT
                  </div>
                  <div className="space-y-3 leading-6 text-muted-foreground">
                    <p className="text-foreground">I&apos;ll structure that into three prompt levels.</p>
                    <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                      Beginner: describe the goal, audience, and desired style.
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                      Advanced: include constraints, evaluation criteria, and output format.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // If user is logged in, render the main chat application UI:
  return (
    <>
      {/* Email Verification Modal */}
      {showVerificationModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          <div className="relative z-50 w-full max-w-lg p-6 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Verify Your Email Address
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                To continue using PromptTune and save your chat history, please verify your email address.
                We&apos;ve sent a verification link to <strong className="text-slate-900 dark:text-slate-100">{user.email}</strong>.
                Please check your inbox (and spam folder).
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    if (user) {
                      try {
                        await user.reload();
                        if (user.emailVerified) {
                          setShowVerificationModal(false);
                          setVerificationStatusMessage(null);
                        } else {
                          setVerificationStatusMessage("Email is still not verified. Check your inbox or resend the email.");
                        }
                      } catch (error) {
                        console.error("Error reloading user:", error);
                        setVerificationStatusMessage("Could not refresh verification status. Please try again.");
                      }
                    }
                  }}
                  className="w-full py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  I&apos;ve Verified / Refresh Status
                </button>
                <button
                  onClick={handleResendVerificationEmail}
                  disabled={verificationEmailResent}
                  className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verificationEmailResent ? 'Verification Email Sent!' : 'Resend Verification Email'}
                </button>
                {verificationStatusMessage && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {verificationStatusMessage}
                  </p>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 px-4 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {chatPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-black/60"
            aria-label="Cancel deleting chat"
            onClick={() => setChatPendingDeletion(null)}
          />
          <div className="relative z-50 w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">Delete this chat?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the conversation from your history. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setChatPendingDeletion(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmDeleteChat}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`flex h-dvh overflow-hidden bg-background text-foreground selection:bg-indigo-500/30 transition-colors duration-300 ${theme} ${showVerificationModal || chatPendingDeletion ? 'filter blur-sm pointer-events-none' : ''}`}>
        <Sidebar
          isOpen={isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
          chatHistory={chatHistoryList}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
          onDeleteChat={requestDeleteChat}
          user={user}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden transition-colors duration-300">
          <TopBar
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            user={user}
            authLoading={authLoading}
            onSignOut={handleSignOut}
            isSidebarOpen={isSidebarOpen}
          />
          {authError && (
            <div className="mx-auto mt-3 w-full max-w-3xl px-4 sm:px-6">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {authError}
              </div>
            </div>
          )}

          {(messages.length === 0 && !currentChatId) && !isLoading && !streamingAI ? (
            <section className="flex flex-1 flex-col justify-center overflow-y-auto px-4 py-6">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
                    <Image
                      src="/icon0.svg"
                      alt="PromptTune logo"
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      priority
                    />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                    {user.displayName ? `Hi, ${user.displayName.split(' ')[0]}.` : 'Welcome to PromptTune.'}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    Ask for a prompt, paste a rough idea, or refine an existing instruction.
                  </p>
                </div>

                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  {[
                    'Create a beginner prompt for a React dashboard',
                    'Improve this prompt for image generation',
                    'Make an advanced prompt for marketing research',
                    'Rewrite my idea as a clear AI instruction',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-2xl border border-border bg-muted/35 px-4 py-3 text-left text-sm transition hover:bg-muted"
                      onClick={() => handleSubmit(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <MessageInputComponent
                  value={userInput}
                  onChange={setUserInput}
                  onSend={handleSubmit}
                  disabled={isLoading || !user.emailVerified}
                  attachedFile={attachedFile}
                  onAttachFile={setAttachedFile}
                />
              </div>
            </section>
          ) : (
            <>
              <ChatAreaComponent
                messages={messages}
                streamingAI={streamingAI}
                isLoading={isLoading && !streamingAI && messages.length > 0}
                chatEndRef={conversationEndRef}
              />
              <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur transition-colors duration-300 sm:px-6">
                <div className="mx-auto w-full max-w-3xl">
                  <MessageInputComponent
                    value={userInput}
                    onChange={setUserInput}
                    onSend={handleSubmit}
                    disabled={isLoading || !user.emailVerified}
                    attachedFile={attachedFile}
                    onAttachFile={setAttachedFile}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    PromptTune can make mistakes. Review generated prompts before using them.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
