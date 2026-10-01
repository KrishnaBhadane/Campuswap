# Campuswap coding rules

These rules apply to all four members and AI-assisted changes. Read this file before starting a task.

## Keep code easy to understand

- Write the shortest clear solution. Do not stretch two useful lines into ten, or squeeze ten operations into one line.
- Use plain HTML, CSS, JavaScript, and SQL for the proposed first version. Agree as a team before changing the stack.
- Use descriptive names: `getProduct`, `sellerId`, `totalPrice`. Avoid names such as `x`, `data2`, or `doStuff`.
- Use early returns to avoid deeply nested conditions. Prefer `async/await` for asynchronous work.
- Use two-space indentation in new code. Do not reformat unrelated existing files.
- Comment why something is needed, not what an obvious line does. Avoid numbered comments for every input or statement.
- Keep necessary validation, error handling, and permission checks even when they take extra lines.
- Every member must be able to explain the code they submit, including AI-generated code.

## Organize by responsibility

- HTML describes the page, CSS styles it, and JavaScript handles behavior. Move the current inline auth script into `JS/auth.js` during auth implementation.
- Use one frontend JavaScript file per page or feature. Extract shared code only when it is actually reused.
- Backend routes define URLs, controllers handle requests, and models contain database queries.
- Keep related small functions together. Do not create a separate file for every button, field, or two-line function.
- Split a file when it contains separate responsibilities; line count alone is not a reason.
- Avoid extra service/repository/factory layers unless a concrete problem requires them.
- Use ES modules consistently in new JavaScript. Match filename case exactly in imports and URLs.
- Add a dependency only when it solves a real need; use established libraries for passwords, sessions, and uploads.

## Frontend and API

- Follow the endpoints and field names in `FULLSTACK_PLAN.md`. Agree on contract changes before merging them.
- Put shared fetch/error handling in `JS/api.js`; page files own their loading, success, empty, and error states.
- Use `textContent` for user-written text. Never insert untrusted text into `innerHTML`.
- Validate forms in the browser for helpful feedback and on the server for correctness.
- Disable submit while a request is pending and restore it after failure.
- Use labels, useful alt text, visible keyboard focus, and mobile-friendly layouts.
- Remove demo claims such as ratings or verified badges when no real data supports them.

## Data and access

- Hash passwords using an established password library. Never store or log plain passwords.
- Use server-side sessions with an HttpOnly cookie; do not put session tokens in localStorage. Use Secure cookies with HTTPS in deployment.
- Enforce login, ownership, verification, and admin permissions on the server. Hiding a button is not authorization.
- Read the seller ID from the session, never from submitted form data.
- Use parameterized SQL. Validate allowed fields, category values, prices, IDs, and pagination limits.
- Store money as integer paise. API/database code uses `pricePaise`; the UI displays rupees.
- Validate upload size and actual file type; generate filenames. Keep college ID images private and separate from public product photos.
- Never serve the repository root as a static directory. Expose only intended public files and assets.
- Keep `.env`, databases, uploads, real student data, and secrets out of Git. Commit `.env.example` with placeholders.
- Return helpful errors without SQL details, stack traces, passwords, or private documents.

## GitHub teamwork

- Start feature branches from the shared, updated `main` after the foundation PR is merged.
- Use the member branch prefixes in `FULLSTACK_PLAN.md`, with one focused task per branch/PR.
- Coordinate before editing files owned by another member. Ask the shared-file owner to make shared changes.
- Commit only files for your task. Review `git diff` and `git status` before committing.
- Pull the latest `main` into your feature branch before requesting review; resolve conflicts together when another member's code is involved.
- Never force-push `main`, commit directly to `main`, or overwrite another member's uncommitted work.
- Require one teammate's review before merging. PR descriptions state what changed and how it was checked.
- Preserve working UI and existing local changes unless the task explicitly changes them.

## Completion checks

- Check the normal flow, invalid input, missing data, and unauthorized access relevant to the feature.
- Write focused backend integration tests for auth, ownership, persistence, and uploads. Do not test trivial wrappers just to increase test count.
- Check changed pages on mobile and desktop; check links and browser errors.
- A feature is done when its UI uses the real API, data survives restart, relevant checks pass, and another member can run it from the README.
- Update setup instructions and the API contract when behavior changes. No unrelated cleanup in a feature PR.
