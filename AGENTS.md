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
