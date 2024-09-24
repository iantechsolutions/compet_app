import { CalendarDays } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Button } from "./ui/button";

export function CustomHover(props: { hoverText: string; hoverContent: React.ReactNode }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="underline hover:no-underline">
          {props.hoverText}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <div className="space-y-1">
            {/* <h4 className="text-sm font-semibold">{props.hoverText}</h4> */}
            <p className="text-sm">{props.hoverContent}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
