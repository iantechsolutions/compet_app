import { cn } from "~/lib/utils";

export function Title(props: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("mb-3 text-2xl font-semibold", props.className)}>{props.children}</h2>;
}
