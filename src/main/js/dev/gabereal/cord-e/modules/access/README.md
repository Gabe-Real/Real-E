# Access module

Real-E is private, so servers have to ask before they can use it.

| Command | Who | What |
|---|---|---|
| `/request` | anyone | Opens the request form (invite link, their role, why they want it) |
| `/requests board` | staff | Pending / Approved / Denied tabs, ✏️ on each request to review it |
| `/requests panel` | management | Posts a "Request Real-E" button in the current channel |
| `/requests allowlist` | staff | Servers Real-E is allowed in |
| `/requests allow <server_id>` | management | Allow a server without a request (partners) |
| `/requests revoke <server>` | management | Remove access, Real-E leaves |

- **Approving** adds the server to the allowlist and DMs the requester an invite link that only works for their server.
- **Denying** DMs them your note. Denying (or moving back to pending) something you'd approved also revokes it.
- **Unapproved servers**: if Real-E gets added somewhere that isn't allowed, it DMs that server's owner, tells you, and leaves.
- **First run**: every server Real-E is already in is allowed automatically. On later startups it never leaves servers on its own, it just DMs you about any that aren't on the list.
- Who can do what comes from the staff module (`modules/staff`): staff can view requests, management can approve/deny. Devs and management get a DM for every new request.
- Banned servers (`/reale management` → ban) can't request Real-E, and it leaves if they add it.
- Your `TESTING_GUILD_ID` server is always allowed.

Optional `.env`: `ACCESS_REQUEST_URL` (where to send people who want access, default `https://discord.gabereal.co.uk`)
and `INVITE_PERMISSIONS` (permissions in approved invites, default `8` = Administrator).
