import { AppShell } from "@/components/app/AppShell";

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return <AppShell area="portal">{children}</AppShell>;
}
