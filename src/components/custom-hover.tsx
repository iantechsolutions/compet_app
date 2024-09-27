import { CalendarDays } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Button } from "./ui/button";
import HelpCircleIcon from "./icons/help-circle-stroke-rounded";

export function CustomHover(props: { hoverContent: React.ReactNode }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="question" className="">
        <HelpCircleIcon />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 bg-[#eeeeee] border-0">
        <div className="flex">
          <p className="text-sm text-[#aaaaaa] text-justify">{props.hoverContent}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
