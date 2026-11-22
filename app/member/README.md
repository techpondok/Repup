# Member portal

Open `/member/dashboard` after `npm run dev`. `/member` redirects there.

## Structure

- `app/member/layout.tsx`, `member.css`: isolated, responsive portal shell and dark/light theme.
- `app/member/{dashboard,qr,membership,activity,profile}/page.tsx`: five member screens.
- `app/member/{loading,error}.tsx`: route loading and retry states.
- `components/member/member-layout.tsx`: desktop sidebar, mobile safe-area navigation, notifications.
- `components/member/member-provider.tsx`: shared preview state, renewal and toast feedback.
- `components/member/member-qr.tsx`: locally generated, rotating demo QR.
- `lib/member/mock.ts`: typed mock members, gym, branches, plans, visits, notifications and payments.

The member shell, profile, membership, and class preview use fictional data that resets on reload. The PT routes load live records for authenticated accounts. They authorize access through the member linkage in Supabase.

QR encoding is implemented locally in `lib/member/qr.ts` (version 3-L, byte mode, Reed-Solomon). Run `node --test lib/member/qr.test.mjs` to verify payload recovery, parity and capacity boundaries. No additional packages are required.

Use the membership status selector on My QR to preview active, expired, frozen, pending and missing-membership states. QR expiration/invalid controls allow local simulation. Every generated QR uses a random, nonpersonal `repup-demo-only` token and cannot authorize a real check-in.

Dates are relative to the current demo session; calendar dates use Asia/Jakarta. Activity supports branch/date filters, calendar navigation, weekly statistics and load more. Renew opens a confirmation flow and never charges money.

Live QR issuance requires server-validated member authorization. The existing QR remains a demo.

## Classes and personal training

Desktop sidebar and mobile bottom navigation use Home, Classes, PT, Activity, Profile. Nested routes keep their parent menu selected. QR check-in and Membership remain accessible from Home. Classes are group fitness only; PT is an independent `/member/pt` module with separate booking state and session credits.

- `/member/classes`: explore with search and schedule/branch/availability filters.
- `/member/classes/[id]`: capacity, booking, cancellation and waiting list.
- `/member/classes/bookings`: upcoming, completed, cancelled and waiting-list tabs.
- `/member/classes/history`: attendance history, independent of booking confirmation.
- `/member/pt`: PT journey and package dashboard.
- `/member/pt/trainers` and `/member/pt/trainers/[id]`: trainer discovery and selection.
- `/member/pt/packages`: package details and mock purchase confirmation.
- `/member/pt/booking`: available slots, booking and rescheduling.
- `/member/pt/sessions`: upcoming and past sessions, cancellation.

`components/member/classes` and `components/member/pt` hold reusable UI and in-memory providers. Typed mock data and transition rules live in `lib/member/classes.ts` and `lib/member/pt.ts`. Shared feedback components live in `components/member/booking-states.tsx`. Both providers are mounted above the portal layout, so navigating between member routes preserves demo bookings until a full reload.

State selectors appear only when `NODE_ENV` is `development`. These reset the corresponding module's preview state. Production builds omit the selectors. Demo purchases and bookings are local simulations.

## Live personal training

Staff manage trainers in `/trainers`, assignments and bookings in `/pt-clients`, and booking rules in `/settings`. An owner or admin activates a package with **Add PT Client**. The assignment stores the plan, member, primary trainer, quota, dates, and session duration. Member self-service payment remains a preview.

The live member routes use `members.repup_account_id` to locate package assignments. Booking, slot lookup, approvals, cancellation, and replacement share the database rules in `0015_pt_booking_workflow.sql`. See `app/actions/pt-bookings.ts` for the application entry points.

Branch hours use `branches.opening_hours` with ISO weekday keys and arrays of start and end times, for example `{"1":[{"start":"08:00","end":"17:00"}]}`. An empty object leaves branch hours unrestricted. Each trainer still needs a configured weekly schedule. Time off can cover part of a day or several days. Existing bookings stay on the calendar when availability or the primary trainer changes.

Pending approval holds reserve quota and a slot until expiry. The workspace and booking rules release expired holds automatically based on the database timestamp. The migration schedules a minute-by-minute status update when the Supabase Cron extension is available. Hosted scheduler execution needs deployment verification.

Run `node --test lib/member/classes.test.mjs lib/member/pt.test.mjs lib/member/qr.test.mjs` for booking and QR regression checks. Class cancellation closes four hours before the class; PT changes close two hours before a session. A PT booking reserves one credit, and cancellation releases it. Opening a booking page never consumes a credit. Times are displayed in WIB (Asia/Jakarta).


## PT attendance preview

- `/member/pt/sessions/[id]`: trainer, schedule, branch, separate session/attendance status and dedicated PT QR.
- `/pt-attendance`: operational layout, existing demo `pt.sessions.manage` permission; not a Member or Classes route. Live mode is explicitly disabled. Access through business demo as Trainer/authorized staff; use the same tab and client links to keep preview state.
- Add attendance demo session creates an additive fictional package/session happening now. Add ended demo session on the scanner supports no-show preview. Neither touches existing bookings or a backend.
- PT state is held by `PTPreviewProvider` at the root; the Member adapter retains existing notification behavior. Nothing is stored in a database, browser storage, URLs or network calls. Reload resets all PT preview state; cross-tab scanning is not supported.
- A `pt-demo:` opaque random token maps locally to exactly one session. No personal data is encoded. The generic QR encoder is reused, but Gym QR payloads, UI, registry and validation remain separate. TTL is 30 seconds, rotation invalidates the previous token, and the window runs from 15 minutes before start through session end. Turning off auto-refresh exposes Expired for testing; manual refresh remains available in the window.
- Showing/copying QR does not mark attendance. Only the trainer workspace simulates scan. Success stores local verified time/trainer, removes the token, and leaves the session upcoming and credit reserved. Completion requires verification and consumes that reserved credit exactly once. Verified sessions cannot cancel/reschedule. No-show requires an ended unverified session; the explicit mock penalty checkbox controls whether one credit is charged. Historical fixture no-shows may predate this policy metadata.
- Simulated trainer/branch selectors deliberately support negative validation tests. They are not authenticated identities and this preview must never be treated as real attendance authorization.

### Backend integration contract (not implemented)

The server must create cryptographically random short-lived tokens bound to tenant, session, member assignment and expiry; store only a token hash and never embed personal data. Authenticate the scan request and derive trainer/staff identity and permitted branches from the server session, never submitted selectors. Validate session status, assignment, branch, time, token expiry, rotation and consumption atomically with an attendance write and unique session-attendance constraint. Reject replay and concurrent duplicate scans; use server timestamps/audit actor. Completion and no-show policy evaluation must be authorized, idempotent transactions with credit ledger updates. A member may request/display a QR for their own session, but cannot verify attendance. Client preview state and client clocks are never trusted. Retain independent Gym check-in and Classes APIs and token namespaces.


## Camera and schedule calendars

`/pt-attendance` includes an opt-in camera preview. Native QR detection is used when available; a dynamically loaded, pinned ZXing decoder handles other browsers locally. Permission denial, unavailable camera and secure-context failures keep manual/USB entry available. Closing the camera, navigating, changing session/trainer/branch or verifying attendance stops camera tracks. Frames are never uploaded. QR tokens still belong to this same-tab mock registry; scanning a QR from an independent device/tab does not create real attendance or synchronize preview data.

The trainer's member-detail action opens a modal in the operational workspace. Calendars show month navigation, date selection, event markers and agendas. PT trainer schedules and member booking history use the same database sessions. Class Booking keeps its independent data and routes.
