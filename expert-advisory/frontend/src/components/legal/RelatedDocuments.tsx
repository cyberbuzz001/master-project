import Link from "next/link";
import { ArrowRight, AlertTriangle, FileText, Headset, Lock, FileCheck, RefreshCw, Cookie } from "lucide-react";
import { getRelatedDocs } from "./legal-data";

interface RelatedDocumentsProps {
  currentSlug: string;
}

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  "alert-triangle": AlertTriangle,
  scale: FileText,
  headset: Headset,
  lock: Lock,
  "file-check": FileCheck,
  "refresh-cw": RefreshCw,
  cookie: Cookie,
};

export function RelatedDocuments({ currentSlug }: RelatedDocumentsProps) {
  const related = getRelatedDocs(currentSlug);

  return (
    <div className="mt-16 pt-10 border-t border-[#1C2734] print:hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#43D9FF] block mb-1">
            Documentation Directory
          </span>
          <h2 className="text-xl font-bold font-display text-[#F5F7FA]">
            You May Also Need
          </h2>
        </div>
        <Link
          href="/legal"
          className="text-xs font-mono text-[#9AA7B5] hover:text-[#43D9FF] flex items-center gap-1 transition-colors"
        >
          <span>All 7 Policies</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {related.map((doc) => {
          const Icon = ICON_MAP[doc.iconName] || FileText;
          return (
            <Link
              key={doc.slug}
              href={`/legal/${doc.slug}`}
              className="group rounded-xl border border-[#1C2734] bg-[#0D131C] p-4 hover:border-[#43D9FF]/40 hover:bg-[#111923] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="size-8 rounded-lg bg-[#162130] border border-[#1C2734] flex items-center justify-center text-[#43D9FF]">
                    <Icon className="size-4" />
                  </div>
                  <span className="text-[10px] font-mono text-[#667383]">
                    {doc.categoryBadge}
                  </span>
                </div>
                <h3 className="text-sm font-semibold font-display text-[#F5F7FA] group-hover:text-[#43D9FF] transition-colors">
                  {doc.title}
                </h3>
                <p className="mt-1.5 text-xs text-[#9AA7B5] line-clamp-2 leading-relaxed">
                  {doc.lead}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1C2734]/60 flex items-center justify-between text-xs font-mono text-[#43D9FF]">
                <span>Read Document</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
