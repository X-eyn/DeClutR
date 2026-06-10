# TempoFlow Production Deployment Runbook

Last verified: 2026-06-10

This document is the operational handoff for TempoFlow (repository name:
DeClutR). It explains the production architecture, networking, security,
deployment process, Google OAuth configuration, recovery procedures, and the
important decisions made while putting the application online.

This file intentionally contains no passwords, private SSH keys, database
credentials, Google client secrets, or DuckDNS tokens.

## Quick Reference

| Item | Value |
|---|---|
| Production URL | https://declutr.duckdns.org |
| Login URL | https://declutr.duckdns.org/login |
| Public IPv4 | `168.144.107.18` |
| Public IPv6 | `2400:6180:0:d2:0:2:ef2c:8000` |
| Provider | DigitalOcean |
| Droplet name | `tempoflow-production` |
| Region | Singapore (`SGP1`) |
| Operating system | Ubuntu 24.04 LTS x64 |
| Plan | Basic shared CPU, $6/month |
| Resources | 1 vCPU, 1 GB RAM, 25 GB disk |
| Domain provider | DuckDNS |
| Hostname | `declutr.duckdns.org` |
| Git repository | https://github.com/X-eyn/DeClutR.git |
| Production branch | `master` |
| SSH user | `deploy` |
| Application service | `tempoflow.service` |
| Reverse proxy | Nginx |
| TLS provider | Let's Encrypt via Certbot |
| Database | Supabase PostgreSQL, external to the Droplet |

## Architecture

```text
Browser
  |
  | HTTPS :443
  v
declutr.duckdns.org
  |
  | DuckDNS A record -> 168.144.107.18
  v
DigitalOcean firewall / Ubuntu UFW
  |
  v
Nginx :80/:443
  |
  | reverse proxy
  v
Next.js standalone server on 127.0.0.1:3000
  |
  +--> Supabase PostgreSQL
  |
  +--> Google OAuth, Calendar API, and Tasks API
```

PostgreSQL is not installed on the Droplet. The application continues to use
the existing Supabase database through `DATABASE_URL`. This is important
because running PostgreSQL alongside Next.js would put unnecessary pressure on
the 1 GB server.

## DNS And Networking

DuckDNS hosts `declutr.duckdns.org`.

The required DNS record is:

```text
declutr.duckdns.org A 168.144.107.18
```

The DuckDNS IPv6 field was intentionally left empty. If the Droplet IP changes,
update the DuckDNS A record before changing anything in Nginx or Auth.js.

Verify DNS using a public resolver:

```powershell
Resolve-DnsName declutr.duckdns.org -Type A -Server 1.1.1.1
nslookup declutr.duckdns.org 8.8.8.8
```

Expected IPv4:

```text
168.144.107.18
```

If Windows shows an old address while public resolvers show the correct one:

```powershell
ipconfig /flushdns
```

### Open Ports

UFW is enabled with default-deny incoming traffic. Only these ports are open:

| Port | Purpose |
|---|---|
| `22/tcp` | SSH |
| `80/tcp` | HTTP, redirected to HTTPS |
| `443/tcp` | HTTPS |

Port `3000` is not publicly exposed. Next.js listens only on
`127.0.0.1:3000`, and Nginx proxies public requests to it.

PostgreSQL port `5432` must not be opened on the Droplet.

Useful checks:

```bash
sudo ufw status verbose
curl -I http://declutr.duckdns.org/login
curl -I https://declutr.duckdns.org/login
```

HTTP should return a redirect to HTTPS. HTTPS should return `200 OK`.

## SSH Access And Security

Normal administration uses the non-root user:

```powershell
ssh deploy@168.144.107.18
```

The Windows SSH key currently used is:

```text
C:\Users\User\.ssh\id_ed25519
```

The private key is passphrase-protected. Never send the private key or its
passphrase to another person or AI.

To unlock the key for the current Windows session:

```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add "$env:USERPROFILE\.ssh\id_ed25519"
```

Security settings currently enforced:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

Additional protections:

- UFW firewall
- Fail2ban
- Ubuntu unattended security upgrades
- SSH key authentication
- Direct root SSH disabled
- Nginx is the only public application entry point
- The Node service runs as `deploy`, not root

Do not casually re-enable root SSH or password SSH.

### DigitalOcean Recovery Console

DigitalOcean's ordinary Web Console may fail for `root` because direct root SSH
is disabled. This is expected.

For emergency root access:

1. Open the Droplet in DigitalOcean.
2. Use the Recovery Console.
3. If required, select Reset Root Password.
4. Log in as `root` with the emailed temporary password.
5. Ubuntu will force an immediate password change.
6. Prefer an ASCII-only temporary password because browser console keyboard
   layouts can mishandle symbols.

Recovery-console access does not require enabling remote root SSH.

## Server Software

Verified production software:

| Component | Version/State |
|---|---|
| Ubuntu | 24.04 LTS |
| Linux kernel | `6.8.0-71-generic` |
| Node.js | `v22.22.3` |
| Nginx | `1.24.0` |
| Swap | 2 GB at `/swapfile` |
| Fail2ban | enabled and active |
| Unattended upgrades | enabled and active |

The server has approximately 24 GB usable disk space.

Useful health checks:

```bash
free -h
df -h /
swapon --show
systemctl is-active tempoflow nginx fail2ban unattended-upgrades
```

## Application Layout On The Server

| Path | Purpose |
|---|---|
| `/home/deploy/tempoflow/releases/current` | Active standalone release |
| `/home/deploy/tempoflow/.env.production.local` | Production secrets and URLs |
| `/home/deploy/tempoflow/setup` | Setup scripts and service templates |
| `/var/www/tempoflow` | Git clone and initial install workspace |
| `/etc/systemd/system/tempoflow.service` | Application service |
| `/etc/nginx/sites-available/tempoflow` | Nginx virtual host |
| `/etc/letsencrypt/live/declutr.duckdns.org` | TLS certificate files |

The active application process is managed by systemd:

```bash
sudo systemctl status tempoflow
sudo systemctl restart tempoflow
sudo journalctl -u tempoflow -n 100 --no-pager
```

The `deploy` user has narrowly scoped passwordless sudo access for managing the
TempoFlow service. It does not have general unrestricted sudo access.

## Environment Variables

Production variables are stored only on the server at:

```text
/home/deploy/tempoflow/.env.production.local
```

Permissions should remain `600`.

Required variables:

```dotenv
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://declutr.duckdns.org
AUTH_URL=https://declutr.duckdns.org
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Never commit the production environment file. Never paste its values into an
issue, chat, screenshot, or handoff document.

The repository contains `.env.example` with placeholders only.

After changing production variables:

```bash
sudo systemctl restart tempoflow
sudo journalctl -u tempoflow -n 50 --no-pager
```

## Google OAuth Configuration

Google Cloud must use a Web application OAuth client.

Authorized JavaScript origin:

```text
https://declutr.duckdns.org
```

Authorized redirect URI:

```text
https://declutr.duckdns.org/api/auth/callback/google
```

Local development redirect URI may also remain configured:

```text
http://localhost:3000/api/auth/callback/google
```

Required Google APIs:

- Google Calendar API
- Google Tasks API

The application requests:

- OpenID
- Email and profile
- Calendar event access
- Google Tasks access
- Offline access for refresh tokens

### OAuth Problems Previously Solved

`invalid_request` on the raw IP occurred because Google does not allow a plain
HTTP public IP as a production OAuth redirect. The DuckDNS hostname and HTTPS
certificate solved this.

`MissingCSRF` occurred because the old login page fetched an Auth.js CSRF token
on the server but did not forward the corresponding cookie to the browser. The
login now uses client-side `signIn("google")`, which creates the token and
cookie in the same browser session.

`redirect_uri_mismatch` was solved by adding the exact HTTPS callback URI to
Google Cloud.

If OAuth fails again, first inspect:

```bash
sudo journalctl -u tempoflow -n 100 --no-pager
```

Then confirm that the Google error's `redirect_uri` exactly matches the URI
registered in Google Cloud.

## HTTPS And Certificates

Certbot configured Nginx and issued a Let's Encrypt certificate for:

```text
declutr.duckdns.org
```

HTTP redirects to HTTPS, and Certbot's renewal dry run succeeded during setup.

Useful checks:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
systemctl status certbot.timer
```

Do not delete `/etc/letsencrypt` or manually replace the certificate paths in
Nginx unless intentionally migrating TLS providers.

## Why Standalone Builds Are Required

The $6 Droplet has only 1 GB RAM. Running `next build` directly on it exhausted
RAM and the full 2 GB swap, drove load above 18, and made SSH temporarily
unresponsive.

Therefore:

- Build on the Windows development machine.
- Deploy the generated Next.js standalone output.
- Do not run production Next.js builds on this Droplet.

The repository includes:

```ts
output: "standalone"
```

Prisma includes both Windows and Ubuntu engines:

```prisma
binaryTargets = ["native", "debian-openssl-3.0.x"]
```

Without the Linux Prisma target, production fails with:

```text
Prisma Client could not locate the Query Engine for runtime
"debian-openssl-3.0.x"
```

## Build And Deployment Procedure

Run these steps from the repository on the Windows development machine.

### 1. Update And Validate

```powershell
git checkout master
git pull --ff-only
npm ci
npx prisma generate
npm run build
```

### 2. Package Standalone Output

The release must contain:

- Everything from `.next/standalone`
- `.next/static`
- `public`

Example PowerShell procedure:

```powershell
$stage = ".codex-temp\tempoflow-release"
$archive = ".codex-temp\tempoflow-release.tar.gz"

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $archive -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null

Copy-Item ".next\standalone\*" $stage -Recurse -Force
New-Item -ItemType Directory -Path "$stage\.next\static" -Force | Out-Null
Copy-Item ".next\static\*" "$stage\.next\static" -Recurse -Force
Copy-Item "public" $stage -Recurse -Force

tar -czf $archive -C $stage .
```

### 3. Upload

```powershell
scp .codex-temp\tempoflow-release.tar.gz `
  deploy@168.144.107.18:/home/deploy/tempoflow/release-new.tar.gz
```

### 4. Activate Release

```powershell
ssh deploy@168.144.107.18
```

On the server:

```bash
set -e
rm -rf /home/deploy/tempoflow/releases/next
mkdir -p /home/deploy/tempoflow/releases/next
tar -xzf /home/deploy/tempoflow/release-new.tar.gz \
  -C /home/deploy/tempoflow/releases/next

rm -rf /home/deploy/tempoflow/releases/previous
mv /home/deploy/tempoflow/releases/current \
  /home/deploy/tempoflow/releases/previous
mv /home/deploy/tempoflow/releases/next \
  /home/deploy/tempoflow/releases/current

sudo systemctl restart tempoflow
```

### 5. Verify Before Removing Rollback

```bash
curl -I http://127.0.0.1:3000/login
curl -I https://declutr.duckdns.org/login
sudo journalctl -u tempoflow -n 100 --no-pager
```

If healthy:

```bash
rm -rf /home/deploy/tempoflow/releases/previous
rm -f /home/deploy/tempoflow/release-new.tar.gz
```

## Rollback

If a newly deployed release fails and `releases/previous` still exists:

```bash
sudo systemctl stop tempoflow
mv /home/deploy/tempoflow/releases/current \
  /home/deploy/tempoflow/releases/broken
mv /home/deploy/tempoflow/releases/previous \
  /home/deploy/tempoflow/releases/current
sudo systemctl start tempoflow
sudo journalctl -u tempoflow -n 100 --no-pager
```

After confirming recovery, inspect or delete `releases/broken`.

## Database Migrations

The database is Supabase PostgreSQL. Prisma migrations live in:

```text
prisma/migrations
```

Before a release that includes schema changes:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Run migrations from a trusted environment containing the production
`DATABASE_URL`. Review migration SQL before applying it.

Do not expose the Supabase database password or pooler URL.

## Routine Operations

### Application Status

```bash
sudo systemctl status tempoflow --no-pager
sudo journalctl -u tempoflow -n 100 --no-pager
```

### Restart Application

```bash
sudo systemctl restart tempoflow
```

### Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

### Resource Usage

```bash
free -h
df -h /
uptime
ps -eo pid,%cpu,%mem,cmd --sort=-%mem | head
```

### Security Services

```bash
sudo ufw status verbose
sudo fail2ban-client status
systemctl status unattended-upgrades --no-pager
```

### Public Health Test

```powershell
curl.exe -I https://declutr.duckdns.org/login
```

Expected result: `HTTP/1.1 200 OK`.

## Cost And Cancellation

The current Droplet is approximately `$6/month`, billed hourly up to the
monthly cap. Optional paid backups are not enabled.

Powering off a Droplet does not stop billing. To end billing, destroy the
Droplet and remove any separately billed resources. Before destroying it,
preserve:

- Production environment variables
- Any needed server logs
- Any setup/configuration not already in this runbook
- Database backups in Supabase

The database and DuckDNS account are separate services and are not deleted when
the Droplet is destroyed.

## Important Repository Commits

These commits established the current production-compatible setup:

| Commit | Purpose |
|---|---|
| `6a73493` | Robust Google sync workflow |
| `e9d4a7c` | Standalone Next.js output and Linux Prisma engine |
| `ff3f8e2` | Correct browser-side OAuth CSRF initialization |

## Current Known Limitations

- The $6 server is suitable for the current light workload, but not for builds
  or high concurrent traffic.
- Always build releases elsewhere.
- There is no DigitalOcean automated backup enabled.
- DuckDNS is a free hostname, not a privately owned custom domain.
- Production deployment is currently a manual artifact upload process.
- The server has limited disk and memory, so logs and old releases should not
  accumulate indefinitely.

## New-Agent Onboarding Checklist

An agent taking over should:

1. Read this document completely.
2. Check `git status` and avoid overwriting unrelated work.
3. Confirm DNS resolves to `168.144.107.18`.
4. Confirm `https://declutr.duckdns.org/login` returns `200`.
5. Connect as `deploy`, never request the private SSH key or passphrase.
6. Inspect `tempoflow`, Nginx, memory, disk, and recent logs.
7. Preserve server-side environment secrets.
8. Build on the local Windows machine, never on the 1 GB Droplet.
9. Package standalone output including static and public assets.
10. Keep a rollback release until production verification succeeds.
11. Test Google login after authentication-related changes.
12. Commit and push repository changes after validation.

## Secret Inventory

The following secrets exist but are deliberately not documented here:

- SSH private key passphrase
- DigitalOcean account credentials
- DigitalOcean root recovery password
- Supabase database URL and password
- NextAuth/Auth.js secret
- Google OAuth client secret
- DuckDNS account token

If any of these are exposed, rotate the affected secret immediately.
