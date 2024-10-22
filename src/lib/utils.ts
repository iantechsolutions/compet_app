/* eslint-disable */

import { type ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import { parse, stringify } from "flatted";
import { twMerge } from "tailwind-merge";
import { MonolitoProduct } from "../server/api/routers/db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nameInitials(name: string) {
  const [firstName, lastName] = name.split(" ");
  return `${firstName?.[0] ?? ""}${lastName ? lastName[0] : ""}`;
}

export const topRightAbsoluteOnDesktopClassName = "md:absolute md:top-0 md:right-0 mr-10 mt-10";

export function formatStock(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value
    .toFixed(0)
    .replaceAll(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatStockWithDecimals(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value
    .toFixed(2)
    .replaceAll(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function getMonths(length = 12) {
  const months: string[] = [];
  for (let i = 0; i < length; i++) {
    months.push(dayjs().startOf("month").add(i, "month").format("YYYY-MM"));
  }
  return months;
}

export function monthCodeFromDate(date: Date) {
  // ex: 2021-01
  return dayjs(date).format("YYYY-MM");
}

export function monthCodeToDate(monthCode: string) {
  return dayjs(monthCode).startOf("month").toDate();
}

export function compareMonthCode(a: string, b: string) {
  return dayjs(a).diff(dayjs(b), "month");
}

export function compareObjects(a: any, b: any) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

export function encodeData<T>(data: T) {
  return stringify(data, (key, value) => {
    if (value instanceof Map) {
      return {
        $: "Map",
        value: [...value.entries()],
      };
    } else if (value instanceof Set) {
      return {
        $: "Set",
        value: [...value.values()],
      };
    } else if (value instanceof Date) {
      return {
        $: "Date",
        value: value.getTime(),
      };
    } else {
      return value;
    }
  });
}

export function decodeData<T>(data: string): T {
  return parse(data, (key, value) => {
    if (value && typeof value.$ === "string") {
      if (value.$ === "Map") {
        return new Map(value.value);
      } else if (value.$ === "Date") {
        return new Date(value.value);
      } else if (value.$ === "Set") {
        return new Set(value.value);
      }
    }

    return value;
  });
}

//que devuelva longitud de corte
export function isSemiElaborate(prod?: { additional_description: string; supplies?: NonNullable<MonolitoProduct["supplies"]>[0][] }): {
  long: number;
  supply: NonNullable<MonolitoProduct["supplies"]>[0];
} | null {
  let long = null;
  let supply = null;

  if (prod?.additional_description.trim().endsWith("mm") && prod?.supplies && prod?.supplies.length == 1) {
    supply = prod.supplies[0]!;
    long = (supply?.quantity ?? 0) * 1000;
    return {
      long,
      supply,
    };
  }

  return null;
}
