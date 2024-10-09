/* eslint-disable */

import { type ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import { parse, stringify } from "flatted";
import { nanoid } from "nanoid";
import { twMerge } from "tailwind-merge";
import { MRPData, MRPProduct } from "~/mrp_data/transform_mrp_data";
import { queryBaseMRPData } from "~/serverfunctions";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nameInitials(name: string) {
  const [firstName, lastName] = name.split(" ");
  return `${firstName?.[0] ?? ""}${lastName ? lastName[0] : ""}`;
}

export function createId() {
  return nanoid();
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
    }

    if (value instanceof Date) {
      return {
        $: "Date",
        value: value.getTime(),
      };
    }

    return value;
  });
}

export function decodeData<T>(data: string) {
  return parse(data, (key, value) => {
    if (value && value.$ === "Map") {
      return new Map(value.value);
    }

    if (value && value.$ === "Date") {
      return new Date(value.value);
    }

    return value;
  });
}

//que devuelva longitud de corte
export function isSemiElaborate(prod: Awaited<ReturnType<typeof queryBaseMRPData>>["products"][0] | undefined): {
  long: number;
  supply: MRPData["products"][number]["supplies"][0];
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
