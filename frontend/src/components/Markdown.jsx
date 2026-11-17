import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders model output as Markdown. react-markdown does not render raw HTML, so this is safe. */
export function Markdown({ children }) {
  return (
    <div className="answer-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
