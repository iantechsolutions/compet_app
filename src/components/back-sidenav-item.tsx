"use client";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidenavItem } from "./sidenav";

export function BackSidenavItem() {
  const router = useRouter();
  return (
    <SidenavItem
      icon={<ArrowLeftIcon />}
      onClick={() => {
        router.back();
      }}
    >
      Anterior
    </SidenavItem>
  );
}
