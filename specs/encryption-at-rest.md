# Encryption at Rest — Session Data

> **Status:** Proposal
> **Date:** 2026-02-07
> **Context:** Session JSON files are uploaded by users and stored on the server filesystem. This document evaluates options for encrypting those files at rest.

## Current Storage Flow

All disk I/O is funnelled through a single file — `src/lib/parser/session-loader.ts`:

- **Write:** `saveSession(json)` → validates JSON → `writeFile(filePath, json, 'utf-8')`
- **Read:** `loadRawSession(id)` → `readFile(filePath, 'utf-8')` → `JSON.parse()`
- **Delete:** `deleteSession(id)` → `unlink(filePath)`
- **List:** `listSessionIds()` → `readdir()` → filter `.json` files

This single chokepoint means encryption can be added by modifying only this file, regardless of which approach is chosen.

---

## Option 1: Node.js `crypto` — AES-256-GCM (Recommended)

Encrypt/decrypt in `session-loader.ts` using Node's built-in `crypto` module. AES-256-GCM provides authenticated encryption (confidentiality + integrity).

### How It Works

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// 32-byte key from environment variable (base64-encoded)
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');

function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);                // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();            // 16-byte authentication tag
  return Buffer.concat([iv, tag, encrypted]); // wire format: iv(12) + tag(16) + ciphertext
}

function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}
```

### Changes Required

| File | Change |
|------|--------|
| `src/lib/parser/session-loader.ts` | `saveSession`: write `encrypt(json)` as binary. `loadRawSession`: read as buffer, `decrypt()`, then `JSON.parse()`. |
| `.env` / Vercel env vars | Add `ENCRYPTION_KEY` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
| File extension (optional) | Rename from `.json` to `.json.enc` to signal encrypted files |

### Pros

- **Zero dependencies** — `crypto` is built into Node.js
- **~20 lines of code**, all contained in `session-loader.ts`
- AES-256-GCM is industry-standard authenticated encryption
- Key stored as a single env var — trivial on Vercel

### Cons

- Single server-side key — if the key leaks, all files are exposed
- Key rotation requires re-encrypting all existing files
- You manage the key yourself

---

## Option 2: Web Crypto API (Client-Side Encryption)

Encrypt in the browser before upload using the Web Crypto API. The server never sees plaintext (zero-knowledge).

### How It Works

```typescript
// Client-side: compress → encrypt → upload
async function compressEncryptUpload(file: File, password: string) {
  const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();

  // Derive key from user-provided password
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed);

  // Wire format: salt(16) + iv(12) + ciphertext
  // Server stores this opaquely — cannot decrypt
}
```

### Changes Required

| File | Change |
|------|--------|
| `src/components/SessionList.tsx` | Add password prompt on upload; encrypt after compression |
| `src/components/SessionReplay.tsx` | Add password prompt on replay; decrypt before parsing |
| `src/app/api/sessions/upload/route.ts` | Skip JSON validation (body is opaque ciphertext) |
| `src/lib/parser/session-loader.ts` | Read/write as raw binary, no JSON parsing on load |

### Pros

- **True zero-knowledge** — server can never decrypt, even if fully compromised
- No server-side key management
- Web Crypto API is built into all modern browsers, zero dependencies

### Cons

- User must provide a password on upload **and** on every replay
- If the user forgets the password, data is **unrecoverable**
- Server cannot validate JSON structure or extract metadata (title, turn count) before saving
- Significantly more complex UX (password prompts, error handling for wrong passwords)

---

## Option 3: Vercel Blob Storage (Managed Encryption)

Replace the local filesystem with **Vercel Blob** (`@vercel/blob`). Files are stored in S3-backed blob storage with automatic AES-256 encryption at rest managed by Vercel.

### How It Works

```typescript
import { put, del, list } from '@vercel/blob';

// Save
const blob = await put(`sessions/${sessionId}.json`, json, {
  access: 'public',
  contentType: 'application/json',
});

// Load
const response = await fetch(blob.url);
const json = await response.text();

// Delete
await del(blob.url);
```

### Changes Required

| File | Change |
|------|--------|
| `src/lib/parser/session-loader.ts` | Replace all `fs` calls with `@vercel/blob` API calls |
| `package.json` | Add `@vercel/blob` dependency |
| Vercel dashboard | Create a Blob store, add `BLOB_READ_WRITE_TOKEN` env var |
| `next.config.ts` | Remove `outputFileTracingIncludes` (no longer needed) |

### Pros

- **Encryption is automatic and fully managed** — no keys to handle
- Solves the Vercel ephemeral filesystem problem (serverless `/tmp` is wiped between cold starts)
- Scales naturally, no disk space concerns
- Vercel handles key rotation transparently

### Cons

- Paid feature (free tier: 500 MB storage, 1 GB bandwidth/month)
- Adds a dependency (`@vercel/blob`)
- Changes storage layer from filesystem to HTTP-based blob store
- Files accessible via URL — must configure access controls
- You trust Vercel with the encryption keys (standard cloud trust model)

---

## Option 4: `libsodium` / `sodium-native` (Envelope Encryption)

Use **envelope encryption**: each file is encrypted with a unique random data key, and that data key is encrypted with a master key. This is the pattern used by AWS KMS, GCP CMEK, etc.

### How It Works

```
Per file on disk:
  [encrypted_data_key (48 bytes)] + [nonce (24 bytes)] + [ciphertext]

Encrypt:
  1. Generate random 32-byte data key
  2. Encrypt JSON with data key (XSalsa20-Poly1305)
  3. Encrypt data key with master key
  4. Write: encrypted_data_key + nonce + ciphertext

Decrypt:
  1. Read encrypted_data_key, nonce, ciphertext
  2. Decrypt data key with master key
  3. Decrypt ciphertext with data key
```

### Changes Required

| File | Change |
|------|--------|
| `src/lib/parser/session-loader.ts` | Encrypt/decrypt with envelope pattern |
| `package.json` | Add `sodium-native` dependency |
| `.env` / Vercel env vars | Add `MASTER_KEY` |

### Pros

- Per-file keys — compromising one file doesn't expose others
- `sodium-native` is well-audited, high-performance native binding
- Supports **key rotation without re-encrypting data** (just re-wrap the data keys with the new master key)

### Cons

- Native dependency (`sodium-native`) — can cause build issues on Vercel serverless
- More complex than plain `crypto` for marginal benefit in this use case
- Overkill unless there are regulatory or compliance requirements

---

## Recommendation Summary

| Priority | Option | Best For |
|----------|--------|----------|
| **1st** | **Node.js `crypto` AES-256-GCM** | Best balance of simplicity, security, and zero dependencies. One env var, ~20 lines, all in `session-loader.ts`. |
| **2nd** | **Vercel Blob** | Production Vercel deployments. Solves encryption *and* ephemeral filesystem in one move. |
| **3rd** | **Web Crypto (client-side)** | Zero-knowledge requirement where the server must never see plaintext. Significant UX cost. |
| **4th** | **libsodium envelope** | Compliance requirements demanding per-file keys or formal key rotation procedures. |

### Key Generation (for Options 1 & 4)

```bash
# Generate a 256-bit key, base64-encoded
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Set as environment variable
# Local: add to .env.local
# Vercel: Settings → Environment Variables → ENCRYPTION_KEY
```

### Note on Compression + Encryption Order

The current upload pipeline compresses on the client (gzip via `CompressionStream`) before sending. For all server-side encryption options (1, 3, 4), the flow is:

```
Client: JSON → gzip compress → upload
Server: gzip decompress → validate JSON → encrypt → write to disk
Server: read from disk → decrypt → JSON.parse → serve API response
```

Compression happens before encryption, which is correct — encrypting first would destroy compressibility.
