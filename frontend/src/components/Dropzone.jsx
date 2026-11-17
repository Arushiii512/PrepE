import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop file picker. Filters by extension and reports rejected files, so the
 * page can explain what went wrong.
 */
export function Dropzone({ accept = [".pdf"], multiple = false, disabled = false, onFiles, onReject, title, hint, className }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const handle = (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const ok = [];
    const bad = [];
    for (const f of files) {
      const name = f.name.toLowerCase();
      (accept.some((ext) => name.endsWith(ext)) ? ok : bad).push(f);
    }
    if (bad.length) onReject?.(bad);
    if (ok.length) onFiles?.(multiple ? ok : ok.slice(0, 1));
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-xl border-2 border-dashed bg-card/50 transition-colors",
        dragging ? "border-primary bg-primary-soft" : "border-input hover:border-primary/50 hover:bg-primary-soft/50",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl px-4 py-7 text-center"
      >
        <span className={cn("grid h-10 w-10 place-items-center rounded-full transition-colors", dragging ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
          <UploadCloud className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium">{dragging ? "Drop to add" : title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </button>
    </div>
  );
}
