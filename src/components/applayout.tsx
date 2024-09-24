import { MenuIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import NavUserSection, { type NavUserData } from "./nav-user-section";
import { SidenavSheet } from "./sidenav-sheet";
import { Button } from "./ui/button";

export type AppLayoutProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
  sidenav?: React.ReactNode;
  user?: NavUserData;
  hideMenuOnDesktop?: boolean;
  noPadding?: boolean;
  noUserSection?: boolean;
  actions?: React.ReactNode;
};

export default function AppLayout(props: AppLayoutProps) {
  return (
    <div>
      <header className="fixed left-0 right-0 top-0 z-10 flex h-[70px] items-center border-b px-2 backdrop-blur-md md:px-4">
        <SidenavSheet
          trigger={
            <Button
              variant="ghost"
              className={cn({
                "md:hidden": !props.hideMenuOnDesktop,
              })}
            >
              <MenuIcon />
            </Button>
          }
          content={props.sidenav}
        />
        <div className="w-full">{props.title}</div>
        {props.actions}
        {props.user && !props.noUserSection && <NavUserSection user={props.user} />}
      </header>
      <aside
        className={cn("fixed bottom-0 left-0 top-[70px] hidden max-h-full w-[250px] overflow-y-auto border-r", {
          "md:block": !props.hideMenuOnDesktop,
        })}
      >
        {props.sidenav}
      </aside>
      <main
        className={cn("relative mt-[70px] max-w-[100vw] overflow-x-hidden", {
          "px-2 py-7 md:p-10": !props.noPadding,
          "md:ml-[250px]": !props.hideMenuOnDesktop,
        })}
      >
        {props.children}
      </main>
    </div>
  );
}
