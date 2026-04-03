import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar | Elite CRM",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
