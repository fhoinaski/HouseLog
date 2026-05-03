# R2 Bucket Security Checklist

This document describes the required Cloudflare R2 configuration and the media
security policy enforced by the HouseLog API.

---

## Bucket configuration (Cloudflare dashboard)

| Setting | Required value | Reason |
|---------|---------------|--------|
| Public access | **Disabled** | Prevents unauthenticated direct access to all objects |
| Custom domain / public URL | Only for the **public bucket** (avatars) | See "Two-bucket strategy" below |
| CORS policy | Not required (Workers proxy all access) | — |

> **Action required**: verify that the bucket storing documents, photos, videos,
> invoices, and inventory has **no public access enabled** in the Cloudflare R2
> dashboard. Objects in a bucket with public access can be fetched by anyone who
> knows the key, bypassing all API authentication.

---

## Category policy

The policy is enforced in `apps/api/src/lib/media-security.ts`.

| Category | Classification | Served via |
|----------|---------------|------------|
| `avatars` | **public** | `GET /api/v1/media/:key` (no auth) |
| `documents` | private | `GET /properties/:id/documents/:id/download` (auth) |
| `photos` | private | `GET /properties/:id/services/:id/media/*` (auth) |
| `videos` | private | `GET /properties/:id/services/:id/media/*` (auth) |
| `invoices` | private | Provider invoice endpoint (auth) |
| `inventory` | private | `GET /properties/:id/inventory/:id/photo` (auth) |
| Service-request media | private (stored as photos/videos/documents) | `GET /properties/:id/service-requests/:id/media/:index` (auth) |

**Rule**: `canUsePublicUrl(key)` returns `true` only for `avatars`.
No other category may use `getPublicUrl()` or `R2_PUBLIC_URL` to build a
publicly-accessible URL that is returned to clients.

---

## Two-bucket strategy (recommended)

For stronger isolation, use two separate R2 buckets:

1. **Public bucket** — contains only `avatars/`. Public access enabled.
   Exposed via `R2_PUBLIC_URL` and served at `/api/v1/media/avatars/*`.

2. **Private bucket** — contains everything else. Public access **disabled**.
   Accessed exclusively through Cloudflare Workers with authentication.

If a single bucket is used today, disabling public access is still the correct
posture: the Worker accesses R2 via binding (`c.env.STORAGE`), which is not
subject to the public-access setting.

---

## Environment variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `R2_PUBLIC_URL` | Base URL for the public bucket (avatars only) | Yes |
| `R2_ACCOUNT_ID` | Used to build presigned PUT URLs for service-request media | Yes (if uploads enabled) |
| `R2_BUCKET_NAME` | Bucket name for presigned PUT | Yes (if uploads enabled) |
| `R2_ACCESS_KEY_ID` | S3-compatible API key | Yes (if uploads enabled) |
| `R2_SECRET_ACCESS_KEY` | S3-compatible API secret | Yes (if uploads enabled) |

`R2_PUBLIC_URL` must point to the **public** bucket (avatars only).
It must **not** point to the private bucket.

---

## Operational checklist (run before each production deployment)

- [ ] Private R2 bucket has public access **disabled** in Cloudflare dashboard.
- [ ] `R2_PUBLIC_URL` points to the avatars/public bucket, not the private one.
- [ ] No route returns `getPublicUrl()` for a private category.
- [ ] `canServeDirectMediaKey` test suite passes (`npm run test:api`).
- [ ] `canUsePublicUrl` test suite passes.
- [ ] No presigned URL is returned without a corresponding authenticated serving
      endpoint for the same resource.
- [ ] Presigned PUT URLs expire in ≤ 900 seconds.
