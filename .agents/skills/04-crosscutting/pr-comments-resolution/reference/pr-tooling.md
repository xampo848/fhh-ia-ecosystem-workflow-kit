# PR tooling by runtime

Read this when Phase 1 or Phase 2.5 needs PR access. The skill names
capabilities; this table maps each one to the tool the runtime has. Use the
first available row; stop and report the blocker only when neither is
available.

| Capability | GitHub Copilot (when the tool is present) | Any runtime with the `gh` CLI |
| --- | --- | --- |
| Read the active PR and its review threads | `github-pull-request_activePullRequest` | `gh pr view --json number,title,url,reviews,comments,statusCheckRollup`, plus the review threads with their ids: `gh api graphql --paginate -f query='query($o:String!,$r:String!,$n:Int!,$endCursor:String){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{id isResolved path line comments(first:100){totalCount nodes{author{login} body}}}}}}}' -F o=<owner> -F r=<repo> -F n=<number>` (`--paginate` follows every page of threads; when a thread's `totalCount` is over 100, read the rest of that thread before deciding) |
| Resolve a thread | `github-pull-request_resolveReviewThread` | `gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -F id=<thread id>` |
| Post a reply | the runtime's PR reply tool | `gh api repos/<owner>/<repo>/pulls/<number>/comments/<comment id>/replies -f body=<text>` |

Notes:

- With `gh`, the active PR is the one for the current branch (`gh pr view`
  with no number); if there is none, ask the user for the PR number.
- `gh` must be authenticated (`gh auth status`); an unauthenticated or
  permission error is a tooling blocker, reported as such.
- Posting a reply is still subject to the user's approval of its text.
