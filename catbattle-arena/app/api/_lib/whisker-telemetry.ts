export async function trackWhiskerEvent(
  supabase: any,
  userId: string,
  eventName: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('whisker_telemetry').insert({
      user_id: userId,
      event_name: eventName,
      payload,
    });
  } catch {
    // Best-effort: telemetry must never break gameplay paths.
  }
}
