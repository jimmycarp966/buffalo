import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import PublicLayout from "../(public)/layout";

export const metadata: Metadata = {
  title: `Menu - ${brand.name}`,
  description: `${brand.onlineOrderingLabel} de ${brand.name} ${brand.descriptor}`,
  robots: "index, follow",
};

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
