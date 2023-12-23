"use client"
import { ArrowLeftIcon } from "lucide-react";
import { SidenavItem } from "./sidenav";
import { useRouter } from "next/navigation";

export function BackSidenavItem() {
    const router = useRouter()
    return <SidenavItem icon={<ArrowLeftIcon />} onClick={() => {
        router.back()
    }}>Anterior</SidenavItem>
}