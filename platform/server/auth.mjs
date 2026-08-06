import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createId } from "./domain.mjs";

const COOKIE_NAME = "formation_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  cost: 2 ** 15,
  blockSize: 8,
  parallelization: 3,
  maxmem: 128 * 1024 * 1024,
};
const scryptAsync = promisify(scrypt);
const DUMMY_SALT = Buffer.from("formation-auth-dummy-salt", "utf8").subarray(0, 16);
const DUMMY_HASH = Buffer.alloc(SCRYPT_KEY_LENGTH);

export async function registerAccount(store, { name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name ?? "").trim();
  validatePassword(password);
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw new AuthError(400, "Name must be between 2 and 100 characters.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const user = await store.transaction((database) => {
    if (database.users.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
      throw new AuthError(409, "Unable to create an account with those details.");
    }
    const next = {
      id: createId("usr"),
      email: normalizedEmail,
      name: normalizedName,
      passwordHash,
      createdAt: now,
    };
    database.users.push(next);
    return publicUser(next);
  });

  return createSessionForUser(store, user.id);
}

export async function authenticatePassword(store, { email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const suppliedPassword = String(password ?? "");
  if (!suppliedPassword || suppliedPassword.length > PASSWORD_MAX_LENGTH) {
    throw invalidCredentials();
  }

  const database = await store.read();
  const found = database.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);
  const valid = found?.passwordHash
    ? await verifyPassword(suppliedPassword, found.passwordHash)
    : await verifyAgainstDummyHash(suppliedPassword);
  if (!found || !found.passwordHash || !valid) throw invalidCredentials();

  return createSessionForUser(store, found.id);
}

export async function createDemoSession(store, email) {
  const normalizedEmail = normalizeEmail(email);
  const database = await store.read();
  const found = database.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);
  if (!found) throw new AuthError(403, "This account is not available in the local demo workspace.");
  return createSessionForUser(store, found.id);
}

export async function getAuthenticatedUser(store, request) {
  const token = parseCookies(request.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = Date.now();
  const database = await store.read();
  const session = database.sessions.find((entry) => entry.tokenHash === tokenHash);

  if (!session || new Date(session.expiresAt).getTime() <= now) {
    if (session) {
      await store.transaction((nextDatabase) => {
        nextDatabase.sessions = nextDatabase.sessions.filter((entry) => entry.tokenHash !== tokenHash);
      });
    }
    return null;
  }

  const user = database.users.find((entry) => entry.id === session.userId);
  if (!user) return null;
  const lastSeen = new Date(session.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeen) || now - lastSeen > 5 * 60 * 1_000) {
    await store.transaction((nextDatabase) => {
      const live = nextDatabase.sessions.find((entry) => entry.tokenHash === tokenHash);
      if (live && new Date(live.expiresAt).getTime() > Date.now()) live.lastSeenAt = new Date().toISOString();
    });
  }
  return publicUser(user);
}

export async function destroySession(store, request) {
  const token = parseCookies(request.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return;
  const tokenHash = hashToken(token);
  await store.transaction((database) => {
    database.sessions = database.sessions.filter((entry) => entry.tokenHash !== tokenHash);
  });
}

export function sessionCookie(token, request, expiresAt) {
  const secure = isSecureRequest(request) || process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function expiredSessionCookie(request) {
  const secure = isSecureRequest(request) || process.env.NODE_ENV === "production";
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function assertSameOrigin(request) {
  const method = request.method ?? "GET";
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const fetchSite = Array.isArray(request.headers["sec-fetch-site"])
    ? request.headers["sec-fetch-site"][0]
    : request.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") throw new AuthError(403, "Cross-origin mutations are not allowed.");
  const origin = request.headers.origin ?? request.headers.referer;
  if (!origin) return;

  const forwardedHost = process.env.TRUST_PROXY === "true" ? request.headers["x-forwarded-host"] : null;
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost ?? request.headers.host ?? "").split(",")[0].trim();
  if (!host) throw new AuthError(403, "Unable to validate request origin.");

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AuthError(403, "Invalid request origin.");
  }
  if (originHost !== host) throw new AuthError(403, "Cross-origin mutations are not allowed.");
}

export class AuthRateLimiter {
  #attempts = new Map();
  #windowMs;
  #maximumFailures;
  #maximumEntries;

  constructor({ windowMs = 15 * 60 * 1000, maximumFailures = 7, maximumEntries = 10_000 } = {}) {
    this.#windowMs = windowMs;
    this.#maximumFailures = maximumFailures;
    this.#maximumEntries = maximumEntries;
  }

  assertAllowed(key) {
    const entry = this.#current(key);
    if (entry.failures >= this.#maximumFailures) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1_000));
      throw new AuthError(429, "Too many sign-in attempts. Try again later.", { retryAfterSeconds });
    }
  }

  recordFailure(key) {
    const entry = this.#current(key);
    entry.failures += 1;
    this.#attempts.set(key, entry);
  }

  clear(key) {
    this.#attempts.delete(key);
  }

  #current(key) {
    const normalizedKey = String(key);
    const now = Date.now();
    const current = this.#attempts.get(normalizedKey);
    if (!current || current.resetAt <= now) {
      this.#makeRoom(now);
      const next = { failures: 0, resetAt: now + this.#windowMs };
      this.#attempts.set(normalizedKey, next);
      return next;
    }
    return current;
  }

  #makeRoom(now) {
    if (this.#attempts.size < this.#maximumEntries) return;
    for (const [key, entry] of this.#attempts) {
      if (entry.resetAt <= now) this.#attempts.delete(key);
    }
    while (this.#attempts.size >= this.#maximumEntries) {
      const oldest = this.#attempts.keys().next().value;
      if (oldest === undefined) break;
      this.#attempts.delete(oldest);
    }
  }
}

export class AuthError extends Error {
  constructor(status, message, metadata = {}) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.metadata = metadata;
  }
}

async function createSessionForUser(store, userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  const user = await store.transaction((database) => {
    const found = database.users.find((entry) => entry.id === userId);
    if (!found) throw new AuthError(403, "Unable to start a session.");

    database.sessions = database.sessions.filter(
      (session) => session.userId !== userId && new Date(session.expiresAt).getTime() > now.getTime(),
    );
    database.sessions.push({
      id: createId("ses"),
      userId: found.id,
      tokenHash,
      createdAt: now.toISOString(),
      expiresAt,
      lastSeenAt: now.toISOString(),
    });
    return publicUser(found);
  });

  return { user, token, expiresAt };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await derivePassword(password, salt);
  return [
    "scrypt",
    SCRYPT_OPTIONS.cost,
    SCRYPT_OPTIONS.blockSize,
    SCRYPT_OPTIONS.parallelization,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return verifyAgainstDummyHash(password);
  const [, costText, blockSizeText, parallelizationText, saltText, hashText] = parts;
  const options = {
    cost: Number(costText),
    blockSize: Number(blockSizeText),
    parallelization: Number(parallelizationText),
    maxmem: SCRYPT_OPTIONS.maxmem,
  };
  if (
    !Number.isSafeInteger(options.cost) ||
    !Number.isSafeInteger(options.blockSize) ||
    !Number.isSafeInteger(options.parallelization) ||
    options.cost < 2 ** 13 ||
    options.cost > 2 ** 18 ||
    options.blockSize < 1 ||
    options.blockSize > 16 ||
    options.parallelization < 1 ||
    options.parallelization > 10
  ) {
    return verifyAgainstDummyHash(password);
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltText, "base64url");
    expected = Buffer.from(hashText, "base64url");
  } catch {
    return verifyAgainstDummyHash(password);
  }
  if (salt.length < 16 || expected.length !== SCRYPT_KEY_LENGTH) return verifyAgainstDummyHash(password);
  const actual = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, options);
  return timingSafeEqual(actual, expected);
}

async function derivePassword(password, salt) {
  return scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);
}

async function verifyAgainstDummyHash(password) {
  const actual = await derivePassword(password, DUMMY_SALT);
  return timingSafeEqual(actual, DUMMY_HASH);
}

function validatePassword(password) {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    throw new AuthError(400, `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
  }
}

function normalizeEmail(email) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new AuthError(400, "Enter a valid email address.");
  }
  return value;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function invalidCredentials() {
  return new AuthError(401, "Email or password is incorrect.");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(header) {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [part.slice(0, separator), safeDecodeCookie(part.slice(separator + 1))];
      }),
  );
}

function safeDecodeCookie(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function isSecureRequest(request) {
  const forwardedProto = process.env.TRUST_PROXY === "true" ? request.headers["x-forwarded-proto"] : null;
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : String(forwardedProto ?? "").split(",")[0].trim();
  return request.socket?.encrypted === true || protocol === "https";
}
