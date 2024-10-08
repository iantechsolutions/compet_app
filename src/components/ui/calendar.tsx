"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ui/button";
import { format } from "date-fns";

const customLocale = {
  ...es,
  localize: {
    ...es.localize,
    day: (n: number) => ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sáb"][n] || "", // Empezando por Lunes
  },
};

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={customLocale} // Usando el locale personalizado
      showOutsideDays={showOutsideDays}
      className={cn("p-3 pt-0", className)}
      classNames={{
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        caption: "flex flex-row h-full place-content-center items-end",
        caption_label: "flex text-lg justify-center", 
        nav: "flex items-center pb-3",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1  ",
        head_row: "flex justify-between",
        head_cell: "text-muted-foreground rounded-md w-8 font-medium text-[0.85rem] px-1", 
        row: "flex w-full mt-2 space-x-1 border-0",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#8B83EC] text-primary-foreground hover:bg-[#8B83EC] hover:text-primary-foreground focus:bg-[#8B83EC] focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50  aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components ={{
        IconLeft: ({ ...props }) => <ChevronLeftIcon className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRightIcon className="h-4 w-4" />,
        CaptionLabel: ({ ...props }) => <div className="flex h-full flex-col justify-between">
        <div className="flex text-lg place-content-center font-medium">
          {format(props.displayMonth, "yyyy", { locale: customLocale })}
        </div>
        <div className="flex capitalize pt-2 font-semibold">
          {format(props.displayMonth, "MMMM", { locale: customLocale })}
        </div></div>,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
