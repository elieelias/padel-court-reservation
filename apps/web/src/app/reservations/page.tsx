import { redirect } from "next/navigation";

export const metadata = { title: "Reservations" };

export default function ReservationsPage() {
  redirect("/profile#reservations");
}
