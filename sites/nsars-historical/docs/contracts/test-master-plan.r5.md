# Test Master Plan — NS-ARS Sites Slice R5

Scope: one synthetic Home page plus Russian `/admin` draft/preview/publish/rollback. No real media, contact delivery, external network, deployment or domain action.

## Pre-code

- Validate every JSON document and duplicate-key policy.
- Verify source hashes and exact decision scope.
- Verify BR01/BR12/BR13/BR15/BR17 are the only enabled public blocks in the first slice.
- Verify BR04/05/07/08/10/11/16/18 cannot become public in the first slice.
- Verify no price, geography, child photo, real case, contact recipient or legal claim is seeded.

## Runtime

1. Build: production build completes with the exact lockfile.
2. Persistence: D1 schema migration is deterministic and re-runnable.
3. Authoring: create/edit draft, persisted read-back, preview exact draft.
4. Publish: server validation creates one immutable revision and atomically switches the active pointer.
5. Rollback: previous immutable revision becomes active without code deployment.
6. Authorization: anonymous and non-allowlisted writes fail; preview bypass works only with exact local host and explicit local flag.
7. Form boundary: disabled brief returns a durable rejection and stores no submitted body.
8. Accessibility: keyboard path, focus visibility, headings, landmarks, labels, errors, reduced motion and automated scan.
9. Responsive: 320/360/390/768/1024/1440 with no horizontal overflow; 200% text zoom at 390 and 1440.
10. SEO: title, description, canonical policy, robots and sitemap; draft/admin/preview are noindex.
11. Security: CSP/security headers, no raw HTML/JS/CSS fields, no secrets, no open redirect and exact host denylist.
12. External effects: no external request, checkpoint deployment, DNS or production action.

## Deferred but mandatory before release

- Real screen-reader smoke on a named environment.
- Rights-ledger and visual QA for every real photograph.
- Legal/privacy/consent verification and real recipient acceptance.
- Backup/restore drill for the selected production storage.
- Candidate fingerprint and explicit staging/release approval.
