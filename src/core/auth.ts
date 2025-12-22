/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import crypto from "crypto";
import { RateLimiter } from "./security-utils";
import { logSecurityEvent } from "./audit-logger";
import { AutomationError, ErrorCode } from "./errors";

/**
 * Authentication middleware for MCP server
 * Implements API key validation and rate limiting per client
 */

/**
 * In-memory API key store.
 * In a production environment, this should be backed by a persistent database (e.g., SQLite, PostgreSQL).
 */
const validApiKeys = new Map<
  string,
  {
    id: string;
    name: string;
    createdAt: Date;
    lastUsed: Date;
  }
>();

/**
 * Global rate limiter instance.
 * Defaults to 10 requests per second per client ID.
 */
const rateLimiter = new RateLimiter(10, 1000);

/**
 * Initialize with default API key (development only)
 * For production, generate keys securely and store in environment variables
 */
export function initializeAuth(): void {
  // Check for API keys in environment
  const envApiKey = process.env.ULTRAMAC_MCP_API_KEY;

  if (envApiKey) {
    const keyId = crypto
      .createHash("sha256")
      .update(envApiKey)
      .digest("hex")
      .substring(0, 8);
    validApiKeys.set(envApiKey, {
      id: keyId,
      name: "Environment Key",
      createdAt: new Date(),
      lastUsed: new Date(),
    });
    console.log(`[Auth] Loaded API key from environment: ${keyId}`);
  } else if (process.env.NODE_ENV !== "production") {
    // Development mode: create a default key
    const devKey = generateApiKey("development");
    console.warn(
      "[Auth] ⚠️  No API key set. Using development key (DO NOT use in production)"
    );
    console.warn(`[Auth] Development API Key: ${devKey}`);
  } else {
    console.error("[Auth] ❌ No API key configured in production mode!");
    console.error("[Auth] Set ULTRAMAC_MCP_API_KEY environment variable");
  }
}

/**
 * Generate a new API key
 */
export function generateApiKey(clientName: string = "default"): string {
  const key = `umcp_${crypto.randomBytes(32).toString("hex")}`;
  const keyId = crypto
    .createHash("sha256")
    .update(key)
    .digest("hex")
    .substring(0, 8);

  validApiKeys.set(key, {
    id: keyId,
    name: clientName,
    createdAt: new Date(),
    lastUsed: new Date(),
  });

  logSecurityEvent(
    "api_key_generated",
    {
      keyId,
      clientName,
    },
    "low"
  );

  return key;
}

/**
 * Validate API key
 * @throws {AutomationError} if key is invalid or rate limited
 */
export function validateApiKey(apiKey: string): boolean {
  // Allow empty key if not in production and no keys are configured
  if (
    !apiKey &&
    process.env.NODE_ENV !== "production" &&
    validApiKeys.size === 0
  ) {
    return true;
  }

  const keyInfo = validApiKeys.get(apiKey);

  if (!keyInfo) {
    logSecurityEvent(
      "invalid_api_key",
      {
        attemptedKey: apiKey ? apiKey.substring(0, 10) + "..." : "none",
      },
      "medium"
    );
    throw new AutomationError("Invalid API key", ErrorCode.AUTH_INVALID_KEY);
  }

  // Update last used timestamp
  keyInfo.lastUsed = new Date();

  // Check rate limit
  if (!rateLimiter.isAllowed(keyInfo.id)) {
    logSecurityEvent(
      "rate_limit_exceeded",
      {
        keyId: keyInfo.id,
        clientName: keyInfo.name,
      },
      "medium"
    );
    throw new AutomationError(
      "Rate limit exceeded",
      ErrorCode.AUTH_RATE_LIMIT_EXCEEDED
    );
  }

  return true;
}

/**
 * Get client info from API key
 */
export function getClientInfo(
  apiKey: string
): { id: string; name: string } | null {
  const keyInfo = validApiKeys.get(apiKey);
  return keyInfo ? { id: keyInfo.id, name: keyInfo.name } : null;
}

/**
 * Revoke an API key
 */
export function revokeApiKey(apiKey: string): boolean {
  const keyInfo = validApiKeys.get(apiKey);
  if (keyInfo) {
    validApiKeys.delete(apiKey);
    logSecurityEvent(
      "api_key_revoked",
      {
        keyId: keyInfo.id,
        clientName: keyInfo.name,
      },
      "high"
    );
    return true;
  }
  return false;
}

/**
 * List all active API keys (for admin use)
 */
export function listApiKeys(): Array<{
  id: string;
  name: string;
  createdAt: Date;
  lastUsed: Date;
}> {
  return Array.from(validApiKeys.values());
}

/**
 * Middleware function for FastMCP
 * Returns true to allow, throws AutomationError to deny
 */
export function authMiddleware(request: any): boolean {
  // 1. Skip if explicitly disabled via environment
  if (process.env.ULTRAMAC_MCP_DISABLE_AUTH === "true") {
    return true;
  }

  // 2. Skip if in development mode AND no API key is provided
  // This allows "out of the box" local use
  const isDev = process.env.NODE_ENV !== "production";

  // Extract API key from headers or query params
  const apiKey =
    request.headers?.["x-api-key"] ||
    request.query?.apiKey ||
    request.query?.api_key;

  if (!apiKey) {
    if (isDev) {
      // In dev, we log it but don't block
      if (validApiKeys.size > 0) {
        // If keys are configured, warn that none was provided
        console.warn(
          "[Auth] No API key provided, but keys are configured. Allowing access in development mode."
        );
      }
      return true;
    }

    logSecurityEvent(
      "missing_api_key",
      {
        ip: request.ip || "unknown",
        userAgent: request.headers?.["user-agent"] || "unknown",
      },
      "low"
    );
    throw new AutomationError("Missing API key", ErrorCode.AUTH_MISSING_KEY);
  }

  return validateApiKey(apiKey);
}

/**
 * Initialize authentication module on start.
 * Skips initialization in test environments to avoid side effects during parallel testing.
 */
if (process.env.NODE_ENV !== "test") {
  initializeAuth();
}
