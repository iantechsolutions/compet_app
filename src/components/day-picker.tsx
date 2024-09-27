"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

interface DatePickerProps {
  label: string;
  message?: string;
  value?: Date;
  onChange: React.Dispatch<Date | undefined>;
}
export function DatePicker(props: DatePickerProps) {
  const currentMonth = props.value ?? new Date();

  return (
    <Popover>
    <PopoverTrigger
      asChild
      className="rounded-lg border border-gray-200 hover:border-[#8B83EC]"
    >
          <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-between text-left font-normal rounded-lg border border-gray-200 hover:border-[#8B83EC]",
            !props.value && "text-muted-foreground"
          )}
        >
          <span className="text-left">
            {props.value
              ? format(props.value, "PPP", { locale: es })
              : props.label}
          </span>

          <CalendarIcon className="h-4 w-4 ml-auto" />
        </Button>
    </PopoverTrigger>

    <PopoverContent className="w-auto p-0 rounded-lg shadow-lg">
      <div className="p-3 text-center">
        <Calendar
          mode="single"
          selected={props.value}
          onSelect={(date) => props.onChange(date)}
          defaultMonth={props.value ?? new Date()}
          //onDayClick={(date) => props.onChange(date)}
        />
      </div>
    </PopoverContent>
  </Popover>
  );
}
