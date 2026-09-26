# Saha development workflow

The user has requested that all ongoing code changes be committed and pushed to GitHub.

- GitHub source repository: https://github.com/nakul175/saha-health (private).
- Commit each completed, meaningful batch of changes, including relevant tests and documentation, and push it before reporting completion.
- Check the remote branch before updating it. Preserve concurrent work; never force-push or overwrite unrelated changes.
- Use the authenticated GitHub connector when native git authentication is unavailable. Create a commit from the current remote parent, update its branch, and verify the resulting tree matches the intended source. Connector commits may have different SHAs from local commits.
- Report a failed push accurately and retain the local commit for recovery.
- Keep credentials, real patient records, local databases, generated build output, and dependencies out of git. Track only the empty environment template.
- Retain Sites hosting configuration. GitHub source publication does not move or redeploy the running application.

The initial GitHub source import is the complete Release 3 working tree. Earlier development history remains in the Sites-managed repository.
