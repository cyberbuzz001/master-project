import type { Metadata } from "next";
import { AuthProvider } from "@/components/app/AuthProvider";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthenticatedLayout({ children }: LayoutProps<"/">) {
  return <AuthProvider>{children}</AuthProvider>;
}
