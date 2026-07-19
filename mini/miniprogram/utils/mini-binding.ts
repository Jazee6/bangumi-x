import { miniAuthRequest } from "./auth";

const BINDING_PAYLOAD = /^bgmx:mini-bind:v1:([A-Za-z0-9_-]{43})$/;

export interface BindingProfile {
  name: string;
  image: string | null;
}

export interface BindingInspection {
  status: "pending" | "confirmed" | "rejected" | "expired" | "replaced" | "consumed" | "conflict";
  expiresAt: number;
  profile?: BindingProfile;
  conflictReason?: "openid" | "target";
  identity?: { state: "bound"; profile: BindingProfile };
}

let activeChallenge: string | null = null;

export function acceptBindingPayload(payload: string): boolean {
  const match = BINDING_PAYLOAD.exec(payload);
  if (!match) return false;
  activeChallenge = match[1];
  return true;
}

export function clearBindingChallenge(): void {
  activeChallenge = null;
}

export function inspectBindingChallenge(): Promise<BindingInspection> {
  if (!activeChallenge) return Promise.reject(new Error("Binding challenge is unavailable"));
  return miniAuthRequest<BindingInspection>("/mini-binding/inspect", {
    challenge: activeChallenge,
  });
}

export function rejectBindingChallenge(): Promise<BindingInspection> {
  if (!activeChallenge) return Promise.reject(new Error("Binding challenge is unavailable"));
  return miniAuthRequest<BindingInspection>("/mini-binding/reject", {
    challenge: activeChallenge,
  });
}

export function confirmBindingChallenge(): Promise<BindingInspection> {
  if (!activeChallenge) return Promise.reject(new Error("Binding challenge is unavailable"));
  return miniAuthRequest<BindingInspection>("/mini-binding/confirm", {
    challenge: activeChallenge,
  });
}
