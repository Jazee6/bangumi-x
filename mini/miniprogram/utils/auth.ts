import { API_BASE } from "./request";

const TOKEN_STORAGE_KEY = "mini-auth-token";

interface AccountProfile {
  name: string;
  image: string | null;
}

export type MiniAuthState =
  | { status: "loading" }
  | { status: "unbound" }
  | { status: "bound"; profile: AccountProfile }
  | { status: "error" };

type AuthListener = (state: MiniAuthState) => void;
type PublicIdentity = Exclude<MiniAuthState, { status: "loading" | "error" }>;

class AuthRequestError extends Error {
  constructor(readonly rejected: boolean) {
    super("Mini authentication request failed");
  }
}

let state: MiniAuthState = { status: "loading" };
let token: string | null = null;
let inFlight: Promise<void> | null = null;
let tokenMutation: Promise<void> = Promise.resolve();
const listeners = new Set<AuthListener>();

function publish(nextState: MiniAuthState) {
  state = nextState;
  for (const listener of listeners) listener(state);
}

function getHeader(headers: Record<string, string>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return null;
}

function parseIdentity(value: unknown): PublicIdentity | null {
  if (typeof value !== "object" || value === null || !("state" in value)) return null;
  if (value.state === "unbound") return { status: "unbound" };
  if (
    value.state === "bound" &&
    "profile" in value &&
    typeof value.profile === "object" &&
    value.profile !== null &&
    "name" in value.profile &&
    typeof value.profile.name === "string" &&
    "image" in value.profile &&
    (typeof value.profile.image === "string" || value.profile.image === null)
  ) {
    return {
      status: "bound",
      profile: { name: value.profile.name, image: value.profile.image },
    };
  }
  return null;
}

function readStoredToken(): Promise<unknown> {
  return new Promise((resolve) => {
    wx.getStorage({
      key: TOKEN_STORAGE_KEY,
      success: (result) => resolve(result.data),
      fail: () => resolve(null),
    });
  });
}

function storeToken(nextToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.setStorage({
      key: TOKEN_STORAGE_KEY,
      data: nextToken,
      success: () => resolve(),
      fail: () => reject(new Error("Token storage failed")),
    });
  });
}

function clearStoredToken(): Promise<void> {
  return new Promise((resolve) => {
    wx.removeStorage({
      key: TOKEN_STORAGE_KEY,
      complete: () => resolve(),
    });
  });
}

function replaceToken(nextToken: string, expectedToken?: string | null): Promise<void> {
  const mutation = tokenMutation.then(async () => {
    if (expectedToken !== undefined && token !== expectedToken) return;
    await storeToken(nextToken);
    token = nextToken;
  });
  tokenMutation = mutation.catch(() => undefined);
  return mutation;
}

function removeToken(expectedToken?: string): Promise<void> {
  const mutation = tokenMutation.then(async () => {
    if (expectedToken !== undefined && token !== expectedToken) return;
    token = null;
    await clearStoredToken();
  });
  tokenMutation = mutation.catch(() => undefined);
  return mutation;
}

function getLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (result.code) resolve(result.code);
        else reject(new Error("wx.login returned no code"));
      },
      fail: () => reject(new Error("wx.login failed")),
    });
  });
}

function requestIdentity(
  path: string,
  options: { token?: string; code?: string },
): Promise<{ identity: PublicIdentity; token: string }> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/auth${path}`,
      method: options.code ? "POST" : "GET",
      header: {
        ...(options.code ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      data: options.code ? { code: options.code } : undefined,
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new AuthRequestError(response.statusCode === 401));
          return;
        }
        const identity = parseIdentity(response.data);
        const responseToken = getHeader(response.header, "set-auth-token") ?? options.token;
        if (!identity || !responseToken) {
          reject(new AuthRequestError(false));
          return;
        }
        resolve({ identity, token: responseToken });
      },
      fail: () => reject(new AuthRequestError(false)),
    });
  });
}

async function signInWithWechat(): Promise<void> {
  const code = await getLoginCode();
  const result = await requestIdentity("/mini/wechat", { code });
  await replaceToken(result.token);
  publish(result.identity);
}

async function recover(): Promise<void> {
  const storedValue = await readStoredToken();
  if (typeof storedValue === "string" && storedValue.length > 0) {
    token = storedValue;
    try {
      const result = await requestIdentity("/mini/session", { token: storedValue });
      if (result.token !== storedValue) await replaceToken(result.token, storedValue);
      publish(result.identity);
      return;
    } catch (error) {
      if (!(error instanceof AuthRequestError) || !error.rejected) throw error;
      await removeToken(storedValue);
    }
  } else if (storedValue !== null) {
    await clearStoredToken();
  }
  await signInWithWechat();
}

export function establishMiniIdentity(): Promise<void> {
  if (inFlight) return inFlight;

  publish({ status: "loading" });
  inFlight = recover()
    .catch(() => {
      token = null;
      publish({ status: "error" });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function retryMiniIdentity(): Promise<void> {
  return establishMiniIdentity();
}

export function getMiniAuthState(): MiniAuthState {
  return state;
}

export function getMiniAuthToken(): string | null {
  return token;
}

export function miniAuthRequest<T>(path: string, body: unknown): Promise<T> {
  const requestToken = token;
  if (!requestToken) return Promise.reject(new Error("Mini session is unavailable"));

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/auth${path}`,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requestToken}`,
      },
      data: body as WechatMiniprogram.IAnyObject,
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          if (response.statusCode === 401 && token === requestToken) {
            void removeToken(requestToken).then(establishMiniIdentity);
          }
          reject(new Error("Authenticated Mini request failed"));
          return;
        }
        const nextToken = getHeader(response.header, "set-auth-token");
        if (
          nextToken &&
          nextToken !== requestToken &&
          (path === "/mini-binding/confirm" || token === requestToken)
        ) {
          void replaceToken(nextToken, path === "/mini-binding/confirm" ? undefined : requestToken)
            .then(() => {
              resolve(response.data as T);
            })
            .catch(() => reject(new Error("Token renewal failed")));
          return;
        }
        resolve(response.data as T);
      },
      fail: () => reject(new Error("Authenticated Mini request failed")),
    });
  });
}

export function adoptBoundMiniIdentity(value: unknown): boolean {
  const identity = parseIdentity(value);
  if (!identity || identity.status !== "bound") return false;
  publish(identity);
  return true;
}

export function subscribeMiniAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
