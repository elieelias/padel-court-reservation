type ReservationShare = { title: string; text: string; url: string };
type ShareEnvironment = {
  share?: (data: ReservationShare) => Promise<void>;
  copy?: (text: string) => Promise<void>;
};

/** No booking tokens or personal details belong in this payload. */
export async function shareReservationDetails(data: ReservationShare, environment: ShareEnvironment) {
  if (environment.share) {
    try {
      await environment.share(data);
      return "shared" as const;
    } catch (error) {
      // Closing the device's share sheet is not an error and must not copy
      // anything to the clipboard against the player's intent.
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
        return "cancelled" as const;
      }
    }
  }

  if (environment.copy) {
    try {
      await environment.copy(`${data.text}\n${data.url}`);
      return "copied" as const;
    } catch {
      // Clipboard access may be blocked, particularly on a local-network HTTP
      // address. Let the player select the details and copy them manually.
    }
  }
  return "manual" as const;
}
