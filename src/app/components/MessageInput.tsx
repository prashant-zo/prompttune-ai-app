import { Button } from "@/components/ui/button";
import { useRef, useEffect, useCallback, useState } from "react";
import { ArrowUp, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import React from "react";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

function MessageInput({
  value,
  onChange,
  onSend,
  disabled,
  attachedFile,
  onAttachFile,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  attachedFile?: File | null;
  onAttachFile?: (f: File | null) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [value, adjustTextareaHeight]);

  useEffect(() => {
    if (attachedFile && attachedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(attachedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [attachedFile]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if ((event.key === 'Enter' || event.keyCode === 13) && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && (value.trim() || attachedFile)) {
        onSend();
      }
    }
  }, [disabled, onSend, value, attachedFile]);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!disabled && (value.trim() || attachedFile)) {
      onSend();
    }
  }, [disabled, onSend, value, attachedFile]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError("File must be smaller than 4MB");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (onAttachFile) onAttachFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onAttachFile]);

  return (
    <form
      className="rounded-[1.35rem] border border-border/80 bg-background p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-colors duration-300 transition-shadow focus-within:shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:bg-neutral-950 dark:shadow-none"
      onSubmit={handleSubmit}
    >
      {attachedFile && (
        <div className="mb-3 px-2 pt-2">
          <div className="relative inline-flex h-16 max-w-sm items-center gap-3 rounded-xl border border-border bg-muted/50 p-2 pr-4 shadow-sm transition-colors duration-300">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background">
                {attachedFile.type === 'application/pdf' ? <FileText className="h-6 w-6 text-sky-500" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{attachedFile.name}</span>
              <span className="text-xs text-muted-foreground">{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button
              type="button"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onAttachFile?.(null)}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {fileError && (
        <div className="mb-2 px-3 text-xs text-destructive">{fileError}</div>
      )}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          disabled={disabled || !!attachedFile} // Only 1 file allowed
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-1 h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={disabled || !!attachedFile}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message PromptTune"
          aria-label="Type your message to PromptTune"
          rows={1}
          disabled={disabled}
          className="min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]"
          style={{ boxShadow: 'none' }}
          autoFocus
        />
        <Button
          type="submit"
          size="icon"
          className="mb-1 h-11 w-11 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
          disabled={disabled || (!value.trim() && !attachedFile)}
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-3 pb-1 pt-0.5 text-[11px] text-muted-foreground">
        Enter to send, Shift + Enter for a new line.
      </div>
    </form>
  );
}

export default React.memo(MessageInput);
