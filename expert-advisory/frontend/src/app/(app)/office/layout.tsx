import { AppShell } from "@/components/app/AppShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Back-Office | Expert Stocks Consultancy",
  robots: { index: false, follow: false },
};

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="office">{children}</AppShell>;
}
