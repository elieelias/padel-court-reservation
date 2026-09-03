import type { ReservationRow } from "@/features/booking/components/player-reservations";

/** History follows the match's actual end time; status updates may happen later. */
export function isReservationHistoryEntry(reservation: ReservationRow, now: Date) {
  return reservation.status !== "cancelled" && new Date(reservation.end_at).getTime() <= now.getTime();
}
