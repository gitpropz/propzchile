<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Service import labels resolve explicit service units first, then show the property's non-ancillary units as context without changing stored associations; this distinguishes similarly named properties while preserving matching logic.
- Dashboard unit grouping lives in a pure presentation helper; retain original rows for financial totals and mutations so collapsing included units never changes accounting.
- Dashboard financial summaries resolve the final visible groups to original rows through a pure scope helper, and reuse that unit scope across comparison months to keep filters consistent without changing accounting formulas.
- Customer account types live in a protected client_accounts table, separate from legacy membership permissions; global administration derives exclusively from user_roles.superadmin to prevent public privilege escalation.
- Account provisioning is transactional and idempotent in database functions; reuse existing memberships and organizations to avoid duplication on signup or concurrent login.
- Global support selects an organization through the shared current-organization query; authorization remains in RLS and privileged functions, never in the picker.
- Content routes define leaf-specific metadata, using pageMeta for simple pages; root metadata must not prescribe a cover image for every page.
- Cross-organization references use composite foreign keys including organization_id; keep one relationship per link and use explicit constraint hints for composite API embeds to avoid ambiguous or unsupported column hints.
- Allocation recomputation validates both old and new payment organizations and scopes aggregates to the locked parent organization so allocation moves cannot contaminate totals.
