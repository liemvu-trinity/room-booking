export enum Status {
  Pending = "PENDING",
  Confirmed = "CONFIRMED",
  Cancelled = "CANCELLED",
}

export type RoomName = "Sky" | "Ocean" | "Forest";

export interface Booking {
  readonly id: string;
  room: RoomName;
  customer: string;
  date: string; // "YYYY-MM-DD"
  start: number; // hour of the day, 0-23
  hours: number;
  status: Status;
  coupon?: string;
}

export interface CouponBase {
  readonly id: string; // coupon code, e.g. "FREE1H"
}

export interface HourCoupon extends CouponBase {
  couponType: "HOUR";
  freeHours: number;
}

export interface FixedCoupon extends CouponBase {
  couponType: "FIXED";
  discount: number; // VND
  minimum: number; // VND
}

export type Coupon = HourCoupon | FixedCoupon;

export interface Room {
  readonly id: RoomName;
  pricePerHour: number; // VND
}
