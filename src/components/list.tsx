import Link from "next/link";
import { cn } from "~/lib/utils";

export type ListProps = {
  children: React.ReactNode;
  className?: string;
};

export type ListTileProps = {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
};

export function List(props: ListProps) {
  return (
    <div className={cn("mb-3", props.className)}>
      <ul>{props.children}</ul>
    </div>
  );
}

export function ListTile(props: ListTileProps) {
  let content = (
    <>
      {props.leading && <div className="flex items-center justify-center">{props.leading}</div>}

      <div>
        <div className="flex font-medium">{props.title}</div>
        <div className="text-xs font-semibold">{props.subtitle}</div>
      </div>

      {props.trailing && <div className="flex items-center justify-center">{props.trailing}</div>}
    </>
  );

  const containerClassName = "flex gap-5 py-2 hover:bg-stone-100 active:bg-stone-200";

  if (props.href) {
    content = (
      <Link href={props.href} className={cn(containerClassName, props.className)} onClick={props.onClick}>
        {content}
      </Link>
    );
  } else {
    content = (
      <div className={cn(containerClassName, props.className)} onClick={props.onClick}>
        {content}
      </div>
    );
  }

  return (
    <li className="border-t last:border-b" role="button" onClick={props.onClick}>
      {content}
    </li>
  );
}
