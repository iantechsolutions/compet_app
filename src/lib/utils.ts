import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { nanoid } from "nanoid"
import dayjs from "dayjs"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nameInitials(name: string) {
  const [firstName, lastName] = name.split(" ")
  return `${firstName?.[0] ?? ''}${lastName ? lastName[0] : ""}`
}

export function createId() {
  return nanoid()
}

export const topRightAbsoluteOnDesktopClassName = 'md:absolute md:top-0 md:right-0 mr-10 mt-10'

export function formatStock(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(0).replaceAll(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatStockWithDecimals(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2).replaceAll(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


export function getMonths(length: number = 12) {
  const months: string[] = []
  for (let i = 0; i < length; i++) {
    months.push(dayjs().startOf('month').add(i, 'month').format("YYYY-MM"))
  }
  return months
}

export function monthCodeFromDate(date: Date) {
  // ex: 2021-01
  return dayjs(date).format("YYYY-MM")
}

export function monthCodeToDate(monthCode: string) {
  return dayjs(monthCode).startOf('month').toDate()
}

export function compareMonthCode(a: string, b: string) {
  return dayjs(a).diff(dayjs(b), 'month')
}

export function compareObjects(a: any, b: any) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }

  return true
}