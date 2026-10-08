import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ExpertStocks AI Advisory CRM & Sales Platform",
  robots: { index: false, follow: false },
};

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#05070B]">{children}</div>;
}
