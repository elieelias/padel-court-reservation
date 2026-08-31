import type { createClient } from "@/lib/supabase/client";

export type InvitationRow = {
  invitation_id: string;
  reservation_id: string;
  host_username: string;
  invitee_username: string;
  start_at: string;
  end_at: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  is_host: boolean;
  created_at: string;
};

export async function loadPendingInvitations(client: ReturnType<typeof createClient>): Promise<InvitationRow[]> {
  const { data, error } = await client.rpc("list_private_reservation_invitations");
  if (error) throw error;
  const invitations = (data as InvitationRow[] | null) ?? [];
  const hostedIds = [...new Set(invitations.filter((item) => item.is_host).map((item) => item.reservation_id))];
  const pendingIds = new Set<string>();
  if (hostedIds.length) {
    // Use the saved booking status, not an invitation count: open courts can
    // still need players after all their invited friends have accepted.
    const { data: reservations, error: reservationError } = await client
      .from("reservations").select("id,status").in("id", hostedIds);
    if (reservationError) throw reservationError;
    for (const reservation of reservations ?? []) {
      if (reservation.status === "pending") pendingIds.add(reservation.id);
    }
  }
  return invitations.filter((item) => item.status !== "cancelled" && (
    item.is_host ? pendingIds.has(item.reservation_id) : item.status === "pending"
  ));
}
