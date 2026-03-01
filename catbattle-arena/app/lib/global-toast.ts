export type GlobalToastPayload = {
  message: string;
  durationMs?: number;
};

export const GLOBAL_TOAST_EVENT = 'catclash:toast';

export function showGlobalToast(message: string, durationMs = 4500) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GlobalToastPayload>(GLOBAL_TOAST_EVENT, {
      detail: { message, durationMs },
    }),
  );
}
