import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders approved policy markdown. Raw HTML in the source is not rendered. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-policy">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
}
