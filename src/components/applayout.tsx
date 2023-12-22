import { MenuIcon } from "lucide-react";
import { Button } from "./ui/button";
import { SidenavSheet } from "./sidenav-sheet";
import NavUserSection, { NavUserData } from "./nav-user-section";
import { cn } from "~/lib/utils";

export type AppLayoutProps = {
    children: React.ReactNode
    title?: React.ReactNode
    sidenav?: React.ReactNode
    user?: NavUserData
    hideMenuOnDesktop?: boolean
    noPadding?: boolean
}

export default function AppLayout(props: AppLayoutProps) {
    return (
        <div>
            <header className="h-[70px] flex items-center px-2 md:px-4 border-b backdrop-blur-md fixed left-0 right-0 top-0">
                <SidenavSheet
                    trigger={<Button variant="ghost" className={cn({
                        "md:hidden": !props.hideMenuOnDesktop
                    })}><MenuIcon /></Button>}
                    content={props.sidenav}
                />
                <div className="w-full">
                    {props.title}
                </div>
                {props.user && <NavUserSection user={props.user} />}
            </header>
            <aside className={cn("fixed top-[70px] left-0 bottom-0 hidden w-[250px] border-r overflow-y-auto max-h-full", {
                "md:block": !props.hideMenuOnDesktop
            })}>
                {props.sidenav}
            </aside>
            <main className={cn("mt-[70px] relative", {
                "p-10": !props.noPadding,
                "md:ml-[250px]": !props.hideMenuOnDesktop
            })}>
                {props.children}
            </main>
        </div>
    )
}