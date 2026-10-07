# Campuswap full-stack plan

Status: planning only. No backend, database, branches, or deployment have been created by this document.

## 1. What we are building

Campuswap is a student-to-student marketplace for used books, notes, electronics, stationery, hostel items, and cycles. A seller posts an item; another student finds it, contacts the seller, and arranges campus handover.

Confirmed with the team lead: buyers contact sellers on WhatsApp; there is no in-app payment or delivery. There is no college-required backend stack, so this plan selects Node.js/Express + SQLite for simplicity. Starting with RCPIT and treating study material as physical listings remain planning assumptions. Digital downloads, chat, and multiple colleges need separate scope decisions.

### What exists today

| Area | Current code | Missing behavior |
| --- | --- | --- |
| Home | `index.html`, section CSS, sample cards | Real listings, search, category filters, working view-all links |
| Authentication | `Auth/user.html`, `Auth/user.css`, `user.html` redirect | Registration, login, logout, sessions, password recovery, verification |
| Product details | `product.html`, `CSS/product.css` | Load by ID, real seller/contact data, reports, real related items |
| Selling | `sell.html`, `CSS/sell.css` | Save listing/image, validate fields, enforce seller ownership |
| Backend/database | Placeholder folders | Server, schema, queries, APIs, tests, deployment |

All product cards currently open the same sample product. The WhatsApp URL has no seller number. Ratings, review counts, and seller details are sample content. `product.css` at the root and `material.html` are referenced but absent; fix those references within the relevant page tasks.

## 2. First working version

1. A visitor browses/searches available items and opens `product.html?id=123`.
2. A student registers and logs in. The account starts with verification pending.
3. An admin checks the uploaded college ID and approves or rejects it. Upload alone must never grant a verified badge.
4. An approved student creates a listing with one photo, price, condition, and handover location.
5. A logged-in student requests the seller's WhatsApp contact and arranges a handover. Tell sellers that their submitted number is shared for this purpose.
6. Sellers use My Listings to edit, mark sold, or delete their own items.
7. Students report a listing/seller; admins review reports and hide inappropriate listings.

Anyone may browse. Login is required for contact and reports. Verification is required to publish. Admin permissions are separate from student verification.

Pending users can view their verification status and resubmit a rejected ID. Do not show private ID images in public profiles. For the first release, omit nonfunctional Forgot Password and Remember Me controls; implement genuine recovery and longer session expiry as a later feature if required.

Exclude cart, checkout, payment, delivery tracking, ratings, bidding, and in-app chat from the proposed first release. Remove the sample review stars/count and any unsupported original-price claims. One photo per item keeps uploads simple; replace the sample thumbnail gallery with that photo.

## 3. Selected stack for this plan

- Frontend: retain existing HTML/CSS and add plain JavaScript modules using `fetch`.
- Backend: Node.js with Express, using the same language as the frontend.
- Database: SQLite for a small, single-server college project, with explicit SQL and a database file outside public folders. No separate database server is needed for local development. Revisit the database choice if deployment needs multiple server instances.
- Login: server-side sessions persisted in the database and an HttpOnly cookie.
- Images: public listing photos and private verification images in separate upload directories, outside source control.
- Deployment: one Node server serving the pages and `/api` on the same origin, with persistent storage for database/uploads and HTTPS.

This recommendation keeps the existing interface and avoids a framework migration. Express supports static assets ([documentation](https://expressjs.com/en/starter/static-files/)); Node documents SQLite access ([documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)). Select and pin a supported Node version and compatible SQLite driver during foundation setup. Express's default in-memory session store is not suitable for deployment; configure persistence ([documentation](https://expressjs.com/en/resources/middleware/session/)).

## 4. Assign work first

Names below come from the README. These are proposed assignments, not claims about anyone's experience. Swap members if their skills differ, while retaining clear ownership.

| Member | Branch prefix | Main responsibility | Owned files |
| --- | --- | --- | --- |
| Krishna Bhadane | `feature/platform-*` | Foundation, shared contracts, browsing/search, integration | `index.html`, home CSS, `JS/home.js`, `JS/api.js`, `JS/header.js`, `JS/product-card.js`, server wiring, database setup, package files, README |
| Aditya Jadhav | `feature/auth-*` | Registration/login/logout, current user, ID submission and status | `Auth/*`, `user.html`, `JS/auth.js`, auth routes/controller/model, auth middleware and auth tests |
| Roshan Patil | `feature/products-*` | Listing APIs, product details, filters/query logic, seller contact | `product.html`, `CSS/product.css`, `JS/product.js`, product routes/controller/model and product tests |
| Dipak Kadam | `feature/seller-admin-*` | Sell form, My Listings, admin verification/report review | `sell.html`, `my-listings.html`, `admin.html`, their CSS/JS, admin/report routes/controllers/models and tests |

Roshan owns all product API mutations as well as reads. Dipak consumes those APIs for sell/edit/delete/sold actions. Aditya owns submitting verification documents; Dipak owns the admin decision endpoints. Krishna owns shared upload utilities, schema integration, session wiring, and deployment setup; members contribute requirements through focused PRs.

Krishna and Roshan agree on search response fields first. Aditya and Dipak agree on verification states first. Everyone contributes end-to-end checking; Krishna coordinates the final demo rather than being the only tester.

### First task for each member

- Krishna: merge a foundation PR with startup, database initialization, example environment, shared API helper, and the agreed API contract.
- Aditya: connect login/register UI to auth endpoints and expose `GET /api/auth/me`; move the inline script to `JS/auth.js`.
- Roshan: implement list/detail product endpoints using seeded data, then wire `product.html?id=...`.
- Dipak: prepare sell/My Listings forms against the contract, including loading/error states; then connect them to Roshan's endpoints and build verification review.

## 5. Simple file structure

Proposed additions, created only as each task needs them. Existing pages and CSS remain in place initially.

```text
Campuswap/
  index.html, product.html, sell.html
  my-listings.html, admin.html
  Auth/                       # Auth page and styling
  CSS/                        # Existing and new page styles
  JS/
    api.js                    # Shared fetch and response handling
    header.js                 # Login/logout navigation
    product-card.js            # Shared listing card rendering
    home.js, auth.js, product.js
    sell.js, my-listings.js, admin.js
  backend/
    server.js                 # Start listening
    app.js                    # Middleware, routes, errors, public page mapping
    db.js                     # Database connection
    routes/                   # auth.js, products.js, admin.js, reports.js
    controllers/              # Matching request handlers
    models/                   # users.js, products.js, reports.js
    middleware/               # require-auth.js, require-admin.js, uploads.js
  database/
    schema.sql                # Initial tables and indexes
    seed.js                   # Synthetic local demo data
    migrations/               # Add only when schema changes after initialization
  storage/                    # Ignored database and upload files
    products/                 # Public item photos
    verification/             # Private college IDs
  tests/                      # Focused API integration tests
  package.json, package-lock.json
  .env.example, .gitignore
  README.md, rule.md, FULLSTACK_PLAN.md
```

Do not expose the repository root through `express.static`. Serve known HTML pages explicitly and mount only `CSS`, `JS`, `Auth` public page assets, public assets, and product photos. Never expose backend source, `.env`, database files, or verification uploads. A later move to `public/` is optional and must be coordinated as one change before branches diverge.

## 6. Data contract

| Table | Main fields |
| --- | --- |
| `users` | `id`, `name`, unique normalized `email`, `password_hash`, `college`, `phone`, `role`, `verification_status`, private `verification_image_path`, `verification_reason`, `created_at` |
| `products` | `id`, `seller_id`, `title`, `description`, `category`, `condition`, integer `price_paise`, `image_path`, `handover_location`, optional `brand`, optional `semester`, `status`, `created_at`, `updated_at` |
| `reports` | `id`, `reporter_id`, `product_id`, `reason`, `status`, optional `resolution_note`, `created_at` |
| Session store | Session identifier, session data, expiration; use the session adapter's schema |

One user has many products. A report is attached to a product and therefore its seller. Enable foreign-key enforcement. Roles: `student` and `admin`; verification: `pending`, `approved`, `rejected`; product status: `available`, `sold`, `hidden`, `deleted`; report status: `open`, `resolved`.

Use soft deletion for products so report references survive. Public queries exclude hidden/deleted rows and default to available listings. A sold item's detail page may show its sold status but must disable contact. Owner actions must not restore a hidden/deleted listing; admin moderation takes precedence.

Keep existing category values: `books`, `electronics`, `stationery`, `hostel`, `cycles`, `other`; condition values: `brand-new`, `like-new`, `good`, `fair`. Study material uses `books`, with optional semester. Initially the server accepts only the configured college.

Use snake_case in SQL and camelCase in JSON. Product response fields: `id`, `title`, `description`, `category`, `condition`, `pricePaise`, `imageUrl`, `handoverLocation`, `brand`, `semester`, `status`, `createdAt`, `seller: { id, name, college }`. Never return email, phone, password hashes, or verification paths in public product responses. Contact comes from its protected endpoint.

## 7. Shared API contract

Prefix: `/api`. Success: `{ "data": ... }`. Failure: `{ "error": "Readable message" }`. List success: `{ "data": [], "pagination": { "page": 1, "limit": 12, "total": 0 } }`. Use 201 for creation, 200 for successful reads/updates/deletes with JSON, and appropriate 400/401/403/404/409/413/429 errors.

| Endpoint | Access | Purpose / input |
| --- | --- | --- |
| `POST /auth/register` | Public | Multipart: `name`, `email`, `password`, `college`, `phone`, `idCard`; create pending account |
| `POST /auth/login` | Public | JSON: `email`, `password`; establish session |
| `POST /auth/logout` | Signed in | Destroy session and clear cookie |
| `GET /auth/me` | Signed in | Safe account fields, role, verification status/reason |
| `POST /auth/verification` | Signed in, rejected | Multipart `idCard`; replace prior private document and reset to pending |
| `GET /products` | Public | `q`, `category`, `page`, `limit`; newest available items first |
| `GET /products/mine` | Signed in | Own listings and statuses; register before `/:id` route |
| `GET /products/:id` | Public | One visible product or 404 |
| `POST /products` | Approved student | Multipart: `title`, `description`, `category`, `condition`, `pricePaise`, `image`, `handoverLocation`, optional `brand`, `semester` |
| `PATCH /products/:id` | Approved owner | Same editable fields, optional replacement image; allow status `sold` only from available |
| `DELETE /products/:id` | Owner | Soft-delete own listing; return deleted ID |
| `GET /products/:id/contact` | Signed in | Available item's WhatsApp URL, using seller phone and encoded message |
| `POST /reports` | Signed in | JSON: `productId`, `reason`; rate-limit and reject duplicate open reports |
| `GET /admin/verifications` | Admin | Pending accounts, safe metadata and protected document endpoint |
| `GET /admin/verifications/:id/image` | Admin | Stream private ID image; disable caching |
| `PATCH /admin/verifications/:id` | Admin | JSON: `status` (`approved` or `rejected`), rejection `reason` |
| `GET /admin/reports` | Admin | Reports with related listing/seller |
| `PATCH /admin/reports/:id` | Admin | JSON: `status: resolved`, `resolutionNote` |
| `PATCH /admin/products/:id` | Admin | Hide reported listing: `status: hidden` |

Require one JPEG/PNG/WebP product photo and one verification image, maximum 5 MB each; check actual image content, not just the extension. Product price may be zero for giveaways; validate a nonnegative safe integer in paise. Paginate with default 12 and maximum 50. Registration logs the user in only after successful login in this initial contract.

The registration form gains a phone field. The sell form takes seller identity from `/auth/me` instead of trusting the editable seller-name field; show the contact number from the account. Initial phone corrections can be deferred to a separate profile-edit task before a public launch.

## 8. GitHub workflow

1. Review and commit the already integrated auth UI and intended local design changes as a shared baseline. Do not accidentally include `.DS_Store` or discard uncommitted work.
2. Merge Krishna's foundation PR into `main` before creating the four implementation branches. All members agree on this contract and schema.
3. Each member creates a task branch, for example `feature/auth-login`, `feature/products-read`, `feature/seller-admin-dashboard`, or `feature/platform-search`.
4. Use small commits and PRs. Include a short description, screenshots for UI changes, and actual checks performed.
5. Before review, commit your work, fetch origin, and merge `origin/main` into the feature branch. Never run a reset to resolve conflicts by discarding someone else's work.
6. Another member reviews, then merge into `main`. Enable branch protection and required checks if available. Create the next task branch from updated `main`.

Suggested reviewer pairs: Krishna ↔ Aditya; Roshan ↔ Dipak. Shared schema/API changes require the affected feature owner's review too. Only Krishna normally edits `app.js`, `db.js`, schema, package/lock files, shared helpers, and deployment configuration. Send the required route/dependency/schema change to him rather than making four conflicting versions.

Do not merge the old remote `Auth` branch wholesale after unrelated changes accumulate. The current working tree already contains its requested auth UI changes; establish that reviewed baseline first.

## 9. Build order and acceptance gates

These are milestones, not fixed dates; estimate dates once the team confirms availability and stack.

| Stage | Parallel work after its dependencies are ready | Exit check |
| --- | --- | --- |
| Foundation | Krishna prepares startup/schema/contracts; others review fields and page needs | A fresh clone can install, initialize synthetic data, and run using README commands |
| Read + accounts | Aditya implements auth; Roshan implements product reads; Krishna connects home; Dipak prepares seller/admin UI against fixtures | Login persists on reload; search and product details use actual database rows |
| Listing lifecycle | Roshan implements product writes/contact; Dipak connects sell/My Listings; Aditya handles verification submission; Dipak then connects admin decisions | Approved seller creates a listing, another account sees it, owner edits/marks sold |
| Moderation + hardening | Dipak handles reports/admin; others test permissions, uploads, mobile states and shared navigation | Nonowners cannot mutate listings, nonadmins cannot see IDs or review reports |
| Deployment + demo | Krishna deploys; all four run assigned smoke checks and document their module | Data and images survive restart; complete two-account flow works over HTTPS |

Fixtures are temporary developer data; a feature is not complete while its page still uses fixtures instead of the API. Build login → approved seller → create item → browse → contact → sold as the first end-to-end flow before adding optional polish.

## 10. Verification and release

- Auth: duplicate emails, wrong passwords, session expiry, logout, private response fields, pending/rejected/approved transitions.
- Products: required/invalid fields, free items, pagination, unknown IDs, nonowner update/delete rejection, hidden/deleted exclusion, sold contact disabled.
- Uploads: invalid file content, oversized files, unauthorized upload, private ID access, replacement and failed-request file cleanup.
- UI: empty search, failed network request, disabled submission, real category links, keyboard access, mobile layouts, and useful 404 handling.
- Admin: ordinary students cannot list verification requests, fetch IDs, approve accounts, or hide products. Provision the first admin through a local setup command, never a public registration field.
- Sessions: database-backed storage, session rotation at login, HTTPS cookies in deployment, SameSite policy plus CSRF protection/origin checks for state changes, rate limits on auth/contact/report routes.
- Hosting: select a Node-capable host with persistent disk for this single-instance SQLite design; GitHub Pages alone cannot run the backend. Do not put the database on an ephemeral filesystem. Document backups and restoration before real users.
- Demo: use synthetic users/ID images. When collecting real IDs, explain purpose, restrict access, and define deletion after review instead of indefinite retention.

Each owner adds meaningful integration checks for their feature. The foundation PR defines the exact install/start/test commands and pins dependencies; these commands do not exist yet.

## 11. Decisions to confirm before implementation

- Confirm the other members can run the selected Node/Express + SQLite stack during foundation setup. WhatsApp with no in-app payment or delivery is already confirmed.
- Are notes/previous papers physical listings, or should downloadable files be a later feature?
- Is college-ID verification/admin review required for the first demo? If not, remove ID collection and verification gating together; do not collect IDs without a review process.
- Are the proposed member assignments suitable, and what is the submission deadline?

Read `rule.md` before implementation. Keep this plan and the real API consistent as decisions change.
