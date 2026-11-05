# `@brabo/runner`

> **Repository:** `viralabs-dev/brabo-runner`, extracted from the `daneiel/brabo` monorepo (AT-699, ADR 0252) with the history of `apps/runner/`. The Docker port comes from `brabo-contracts#v1.0.0`. Development: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Permanent branches are `dev` and `main`; tags only by workflow. The `github.com/daneiel/brabo/...` links below point to the origin monorepo and will be updated by AT-691.

A CLI that runs **on the user's own machine**, connected to the engine through a
Phoenix channel authenticated by a single-use ticket (ADR 0102/0103). It
exists for projects in `runner` mode (ADR 0104): the code folder
stays on the user's machine, with no bind mount at all. Running with the
privileges of whoever executes it, it:

- runs agent commands already **approved** by the `proposed_action` pipeline
  (`exec`), confirming the real path of the folder;
- offers a real interactive terminal (PTY) for the **Terminal** tab of the
  web app;
- does the local folder navigation (`fs_list_dir`/`fs_home_dir`) that feeds
  the folder picker ("Procurar pasta...") in project creation/adoption.

It decides no policy: it only does what the product has already approved. See the
docblocks of `src/channel.ts`, `src/exec.ts`, `src/pty.ts`, `src/guard.ts` and
`src/fs-browser.ts` for the design of each part. The Docker port, the
foundation of container execution (ADR 0128), lives in the
`@brabo/docker-port` package since it gained a second server-side consumer
(ADR 0130); from here, **nothing calls it yet**: no channel message
reaches it and no container starts on your machine. The docblock of the two files
of that package explains the five-operation port and the packaging proof
that chose the implementation. See also
[ADR 0107](https://github.com/daneiel/brabo/blob/main/docs/adr/0107-navegacao-de-pasta-local-via-o-runner.md)
for the security argument behind the folder navigation.

## Via the installer (recommended)

The path is the Brabo installer, the same command the project screen
(`runner` mode) shows:

```sh
curl -fsSLO https://github.com/daneiel/brabo/releases/latest/download/install.sh && bash install.sh
```

It downloads the binary, checks it against the signed `checksums.txt` of the release, installs
it already executable (`install -m 0755`) and pairs the machine through the terminal
(`device-key create`/`finish`, below), installing the machine agent as a
service (RN-547).

Until ADR 0203 there was an **automatic mode through the browser** (ADR 0118): the screen
wrote the binary, `brabo-runner.config.json` and a device key to a folder.
It was **retired**: it was the only path that ended in a manual
`chmod +x`. A folder configured that way **keeps working**: the CLI
still reads the config and the key from the folder it is run from, with no project id
and no token, and an explicit flag always wins over the local file when both
appear.

## Installation

### Via npm (requires Node.js >= 22.6)

```sh
npm install -g @brabo/runner
```

### Standalone binary (no Node/npm)

Download the executable for your platform straight from a
[GitHub Release](https://github.com/daneiel/brabo/releases). It needs
no Node, npm or build toolchain installed:

| Platform | File |
|---|---|
| Linux x64 | `brabo-runner-linux-x64` |
| Linux ARM64 | `brabo-runner-linux-arm64` |
| macOS Apple Silicon | `brabo-runner-darwin-arm64` |

> The table is the MATRIX, not what each Release has: up to `v5.0.0` only the two
> Linux binaries were ever attached (check with `gh release view`).
>
> **macOS Intel has no binary, by decision** (ADR 0174): the
> `macos-13` runner was retired by GitHub, and on `macos-15-intel` the binary
> builds but fails `--self-test-pty`, because of a Bun bug with
> `node-pty` on macOS (oven-sh/bun#25822). The SAME proof passes under Node, so
> on an Intel Mac the path is `npm install -g @brabo/runner`, and that is what
> `install.sh` says instead of downloading.
>
> **Windows has no binary, by decision** (ADR 0187): the binary builds and
> loads `node-pty`, but under Bun the ConPTY output pipe ends after the
> first chunk: even `cmd.exe /c echo` dies with 0xC000013A, the same
> family as the Mac Intel bug. On Windows the path is
> `npm install -g @brabo/runner`, under Node; `install.sh` already refused Windows
> (ADR 0150).

```sh
# Linux/macOS
chmod +x ./brabo-runner-<plataforma>
./brabo-runner-<plataforma> --project <projectId> --dir <caminho-absoluto> --token brb_...
```

The binary is a single file. The native addon (`node-pty`, used only by the
interactive terminal of the Code tab) is already embedded inside it (ADR 0112),
extracted to a temporary directory on the first run. It is not
signed/notarized yet (macOS Gatekeeper and Windows SmartScreen will
warn on first use), a backlog item declared in ADR 0112 that requires the
product owner to obtain/fund a code-signing identity.

## Usage

```sh
brabo-runner --project <projectId> --dir <caminho-absoluto> --token brb_... [--api-url <url>]
```

All the flags below are optional when the current folder has
`brabo-runner.config.json`/`brabo-runner-device-key.jwk.json` (automatic
mode, above); a flag given explicitly always wins over the value
in the local file.

- `--project`: the project id in Brabo, with `execution_mode` = `runner`.
  Only **one** runner per project in the whole cluster
  (`Engine.Runners.Registry`): a second `brabo-runner` for the same
  project is refused at join. When omitted, the CLI only continues as a **machine
  agent** (below), which requires a machine key and a consented base; otherwise it
  prints the usage saying what was missing.
- `--dir`: the absolute folder where the project's code lives on this machine,
  the root for commands (`exec`) and the terminal (PTY). When omitted, the root is the
  folder the command runs from (`cwd`). If the folder does not yet
  exist, it is **created automatically** (`mkdir -p`); if `--dir` points
  to an existing file, it is an error: this CLI never overwrites a
  file (RN-435, ADR 0104). The folder navigation
  (`fs_list_dir`/`fs_home_dir`) is **not** restricted to this folder: it
  navigates freely across the machine, on purpose (see `src/fs-browser.ts`). On
  **Linux**, `--dir` is only accepted inside the user's `$HOME` (the home itself
  or a subfolder of it); outside Linux this restriction does not apply
  (RN-434, ADR 0104); the `$HOME` check runs BEFORE the automatic
  creation, so a folder outside the home on Linux is still refused
  even when it does not exist yet.
- `--token`: a Personal Access Token (`brb_...`), generated in **Project
  settings -> Access tokens**. It can also come from the environment variable
  `BRABO_ACCOUNT_TOKEN`; it is never written to disk by this CLI. Without
  `--token`/`BRABO_ACCOUNT_TOKEN`, the local device key of the automatic
  mode is used to authenticate (a short-lived EdDSA JWT, signed on
  each connection attempt).
- `--api-url`: priority order: explicit flag -> `BRABO_API_URL` ->
  `apiUrl` of the local `brabo-runner.config.json` -> `http://localhost:3000`.
- `--base`: this machine's **projects base**, the folder under which each
  project is a **subfolder** (ADR 0151, RN-529). When omitted, it is read from
  `$XDG_CONFIG_HOME/brabo/runner.json` (otherwise
  `~/.config/brabo/runner.json`), which is where the installer writes it; the explicit
  flag wins over the file. **With no flag and no file the runner runs without a
  base, exactly as it always did.**

### The base and `--dir` are different things, and one does not invalidate the other

`--dir` is the root of **this** project; the base is where a **new** project
folder is born. A project whose folder is outside the base is still
perfectly valid: the base is a **creation** rule, and the validation of
`--dir` (RN-434/RN-435) does not consult it. It is the same prohibition the api
already declares in writing in `project-workspaces-root.ts` for
`BRABO_PROJECTS_BASE` (RN-500/RN-501).

The base is **local** and never arrives over the network: whoever executes owns the root,
and what the server sends is the **relative segment** (the invariant of ADR
0130/0144). What the base refuses, with a named reason: a relative path, one with
`..`, `/`, an existing file, outside `$HOME` on Linux (the same rule
as `--dir`), and a base that is **inside** this project's folder or equal
to it, in which case every new project would be born inside this one. The opposite
direction (the project folder inside the base) is the normal arrangement.

A refusal coming from the **flag** ends the process with code 2; a refusal coming from the
**file** is reported on `stderr`, names what is lost, and the runner carries on without a
base: bringing down an agent that serves a project because of a
configuration it does not use yet would be disproportionate. A file that
exists and does not declare `base` is an absence, not a refusal.

This is **best-effort**, like `guard.ts` and `espelho-guard.ts`: the security
boundary remains authentication + approval pipeline + the
consent of whoever ran the CLI.

### What the base ENABLES: `workspace_create` (RN-532)

With a consented base, this runner declares a fourth capability in the `join`,
`workspace`, and starts serving the `workspace_create` message (ADR 0151
points 3 to 6). The server sends the `projectId` and the **relative segment** to the
base (never an absolute path); the runner does `mkdir -p` and then
`git init`, or clones, when the request carries a repository URL, in which case the
credential travels in `env` and the clone runs on the **HOST**, through the same
mechanism as `exec` (ADR 0145).

When it succeeds, it pushes the `workspace_confirm` that already existed, and
that one, and only that one, WRITES. No new write route was
created, and the only path that stamps `workspace_verified_at` is still a single one. The
`workspace_create_result` only unblocks the requester: success with the final
path, or a **named** error (`sem-base`, `segmento`, `nao-e-pasta`, `mkdir`,
`git`).

Two things worth recording. The `workspace` capability is the only one whose
declaration depends on the **state of this run** and not on the binary version:
without a base there is nowhere to create a folder, and declaring it anyway would be the silent
defect that the negotiation exists to prevent. And `estado.dir` **does not change**:
the created folder is the project's from the server's point of view, but the root that
`guard.ts` uses to contain approved commands is still that of this run;
swapping it at runtime would move a containment boundary because of a
network message.

### The git credential does NOT enter the container, and the refusal says so (RN-558)

Once this runner has started the project container (`container_start`, ADR 0137),
it routes **every** command into it through `docker exec`, and the product's Docker
port **has no `env` field**, on purpose (ADR 0130: no free `-e` at all).
The git credential (ADR 0056) only exists in the environment of the child process of the
**HOST** path.

Until RN-558 the command ran anyway, with the credential helper installed
and the variables **empty**: `git fetch` failed authentication, and whoever
investigated hunted for a token, permission or network issue. And that is the **common** path, not
an edge case: the `running` container that the server requires before any git
operation (RN-507) only exists because **this same runner** started it.

Now the runner **refuses** that pair before executing anything, with an output
that says what happened, why, and that **nothing** was executed. The refusal
never cites the names or values of the variables, only how many there were.

**Since ADR 0193 (RN-676) the credentialed git runs on the HOST:** the engine marks the
authenticated `git fetch` with `gitCredenciado: true`, and this runner, with the mark
**and** a non-empty `env`, runs the command on the host even with the container up,
in the same folder, since it is the bind mount of `/work`. The dev agent's commands
still go to `docker exec`, which still has no `env`. An `env` **without** the mark,
with an active container, is still refused as above: it is the engine's mark, and not the
credential, that decides whether to go to the host. A local repository (no credential) is not
affected, nor is `workspace_create`, which has always run on the host.

### MACHINE agent: no `--project`, one connection per project (RN-544)

With a **machine device key** (ADR 0154, RN-543) and a **consented
base**, `brabo-runner` runs without `--project`: it queries
`GET /runner/projects` and opens **one connection per project** the route lists,
each in the folder `<base>/<workspaceDirName>`.

```sh
# a base vem do instalador (~/.config/brabo/runner.json) ou de --base
brabo-runner --api-url https://brabo.exemplo
```

The mode with `--project` **did not change at all**: it remains the path of
whoever has a folder configured by the old browser flow (ADR 0118,
retired in ADR 0203) or uses explicit flags, with a single
connection. The **two** conditions of the new mode are mandatory and for
different reasons: the machine credential is what the route accepts, and the base is where
each project's folder is derived from. Without a base, running without `--project` falls into the
usage block saying exactly that.

This CLI **does not know** what kind its own key is: on disk, the machine key
and the project key are the same file (a JWK with `kid`). The server knows, and
a credential tied to a project is refused with 403 and a message of its own, which
the CLI relays, naming the fix (`--project`).

What changes in behavior, and is worth knowing before operating:

- **With at least one live connection, the list is queried only at start.**
  A project created after that joins when the agent reconnects: re-polling
  periodically would let a list that comes back smaller (project deleted? converted?
  transient 500?) bring down a live connection out of ambiguity.
- **An empty list is normal, and the agent STAYS UP waiting** (RN-550): it is the
  state of every new installation, and with **zero** connections there is nothing to
  bring down and no ambiguity to resolve; any project that appears is pure
  gain. It re-queries every **15s, 30s and then 60s** (the last repeats
  forever) and **stops re-querying** as soon as the first non-empty list
  arrives. Waiting has no ceiling; **ten consecutive failures** of the query do: then the
  process exits with 1 naming the number. A query that answers, including
  an empty one, resets that counter. Every 30 queries with no project it prints a
  heartbeat saying how many there were, so that "waiting" does not look like
  "stuck" in `journalctl`.
- **A non-empty list with every project refused still exits with 1.** It is
  the declared exception to the rule above: there each refusal names a local defect
  with its own fix, and re-querying would repeat the same lines forever.
- **The attempt ceiling and the join refusal are PER PROJECT.** A refused project
  (second runner on the same project, invalid ticket) or one that exhausted
  its attempts ends on its own, **named**, and the others carry on. Only when none
  is left does the process exit with 1, listing the outcome of each one.
- **Every log of the loop is prefixed with the project name**: with N interleaved
  loops, a "falha na conexão" with no owner says nothing.
- `--api-url` in machine mode comes from the flag, from `BRABO_API_URL` or from the default:
  `brabo-runner.config.json` is **per project** and does not take part.

The mirror (RN-516) and `workspace_create` (RN-532) remain identical: both
are per project and travel in the `join` grant of **that** connection, which is what
already makes them correct with N. Since RN-545, `service install --machine` puts this
process up as a user service; see *User service*, below.

### Running straight from the monorepo checkout (without installing via npm)

```bash
git clone <o repositório do Brabo>
cd brabo
pnpm install
pnpm --filter runner start -- --project <projectId> --dir <pasta-absoluta> --token brb_...
```

Requires **Node.js 22.6 or newer** (the native *type stripping* of `.ts`
that this path uses only exists from that version on).

### macOS: the `node-pty` `spawn-helper` gets the execute bit at startup (AT-114)

The `node-pty@1.1.0` tarball ships `prebuilds/darwin-<arch>/spawn-helper` with
mode `0644`, and neither `pnpm install` nor `npm install` marks it executable.
`node-pty` EXECUTES that file every time a terminal is opened; without the bit, the error is
`posix_spawnp failed`, the same as for a missing file. That is why, under **Node** (from
source, as above, and through the `npm install -g` package), the runner checks the
`spawn-helper` when loading `node-pty` (`src/spawn-helper.ts`): macOS only,
idempotent (an already executable file is not touched), looking in the SAME order as
`node-pty` (`build/Release`, `build/Debug`, `prebuilds/darwin-<arch>`). If the
bit is missing, it adds it and says so on `stderr`. If the `spawn-helper` (or
`pty.node`) does not exist, or if the `chmod` is refused (a global install
by another owner), the runner STOPS with an error naming the path and the fix
(`chmod +x "<caminho>"`), instead of failing on the first terminal. Under `pnpm` the
file is a hardlink of the store, so the `chmod` also applies to the store.

The standalone binary does not depend on this: it embeds the content of the
`spawn-helper` and extracts it with `0755` (`native-pty-loader.ts`). And this is not the
Bun bug (oven-sh/bun#25822), which fails the binary even with the right bit.

That Bun bug is MEASURED (AT-342): under Bun, the `tty.ReadStream` with which
`node-pty` reads the PTY is an `fs.ReadStream`, and the first read with no data on the
non-blocking fd surfaces as `EAGAIN`, destroys the stream and closes the fd; the terminal
stops receiving output after the first chunk, on any Unix platform.
Under Bun (the binary, or `bun run` in dev) the runner swaps that reader, only
during `spawn`, for its own reader of the same fd that waits and retries on
`EAGAIN` (`leitor-de-pty.ts`; the idle fd is polled at most every 32 ms).
Under Node nothing changes. `--self-test-pty` does two round trips with a pause between
them, and it is the pause that fails the old reader; before, on Linux, the proof
passed because the first read brought the echo and the reply together. On Windows
the self-test uses `cmd.exe` (there is no `/bin/cat`) and counts the marker without the
ConPTY control sequences.

## Import local API keys (`credentials import`)

AT-611, RN-927. An INTERACTIVE subcommand (it refuses without a TTY, exiting 2 without reading anything;
the service unit never runs it). It finds the LLM API keys that Claude Code,
Codex, OpenCode, Kilo and Hermes already store, lists each one (tool, origin,
Brabo provider, last 4 digits) and, item by item, asks whether to import. Each
yes becomes a `POST /runner/llm-credentials` with the folder's MACHINE device key
(PATs and project keys get 403); on 409 it asks whether to replace. Subscription
login is only listed, never importable. The key value is never
printed. The credential belongs to the ACCOUNT of whoever runs it; the agents spend the one of the
workspace holder (RN-058). API: `--api-url`, `BRABO_API_URL` or the local config.

```bash
brabo-runner credentials import
```

## Device key through the terminal (`device-key create | finish`)

The Ed25519 pair can be born **on this machine**, without going through the browser (ADR
0155 point 4, RN-551); this is how the installer pairs the agent on a new
installation. The private half **never travels**.

```sh
# 1) gera o par aqui e imprime a JWK PÚBLICA (uma linha, no stdout)
PUB=$(brabo-runner device-key create)

# 2) registre essa pública na api — quem faz isso é quem tem a credencial
#    para registrar (o instalador, com o service token), nunca este CLI
ID=$(… POST {"name": "…", "publicKeyJwk": '"$PUB"'} … | jq -r .id)

# 3) carimba o `kid` (que É o id do registro) e grava a chave de verdade
brabo-runner device-key finish --id "$ID"
```

- **There are two steps because of the `kid`.** It is the registration id **on the
  server** (RN-475), the only link between the file on disk and the public
  key the api keeps, and it only exists after registration. A private key
  written before it is born useless, and the CLI always refuses it. That is why `create`
  writes to `brabo-runner-device-key.jwk.json.parcial`, a name the runner
  does **not** look for: the file it reads is either complete or does not exist.
- **Where:** `$XDG_CONFIG_HOME/brabo/` (otherwise `~/.config/brabo/`), next to
  `runner.json`. It is the **machine's** key, and it has no project folder to
  live in. `--dir <folder>` points to another destination (for example, a project's
  folder). The private key is written in **mode 600**; the folder, when this command
  creates it, in 700.
- **stdout is for scripts, stderr is for people.** `create` prints only the public
  JWK on stdout; `finish`, only the file path. Everything else,
  including the next command to run, goes to stderr.
- **Overwriting a complete key is refused**, and there is no `--force`: silently replacing the
  identity of an already paired machine would leave an agent
  signing with a key the server does not know. Revoke the current key,
  delete the file and start again from `create`.
- This CLI does **not** claim what kind of key it creates: on disk, the
  machine key and the project key are the same file. The route that
  registered the public key knows.

## User service (`service install | uninstall | status`)

For the runner to start with your session instead of living in an open
terminal, install it as a **user service**: `systemd --user` on Linux,
`LaunchAgent` on macOS (ADR 0147, RN-518):

```sh
# de dentro de uma pasta com brabo-runner.config.json (o antigo fluxo do navegador)
brabo-runner service install
brabo-runner service status
brabo-runner service uninstall

# ou, para o agente desta MÁQUINA (atende todos os seus projetos em modo runner)
brabo-runner service install --machine
brabo-runner service status --machine
brabo-runner service uninstall --machine
```

- **User level, always.** Never a system service, never root: running
  `service install` as root is **refused**, without writing any file. The
  runner runs with the privileges of whoever executes it **by design**, and that premise
  underpins the three boundaries described in *Security*, below.
- **Windows is out of scope**, by declared decision: a user service
  there is a third mechanism, not a variation of the other two. The three subcommands
  refuse, naming the platform; running in the foreground keeps working.
- **TWO kinds of unit, and they coexist** (ADR 0154 point 4, RN-545). The
  **project** one (`brabo-runner-<projectId>.service` /
  `dev.brabo.runner.<projectId>`) is the behavior as always, byte for byte:
  `--project` and `--dir` stay optional, and without them the
  `brabo-runner.config.json` and the current folder apply. The **machine** one
  (`brabo-runner.service` / `dev.brabo.runner`, no suffix) runs the agent from
  *MACHINE agent* described above: one process, one connection per project.
  The names do not collide: the `projectId` is never empty, so the project one always
  has a `-` where the machine one has a `.`.
- **The new kind is an explicit opt-in (`--machine`)**, and never "the absence of
  `--project`": the normal path today is to run `install` with no flag at all from
  inside the configured folder, with `brabo-runner.config.json` answering
  who the project is; treating that as "machine" would silently convert the
  installation of whoever already uses the product. `--machine` together with `--project` is
  a named refusal.
- **`install --machine` requires a consented base** (RN-529) and refuses a folder
  that has `brabo-runner.config.json`: without a base the machine agent does not start, and
  with that file in the `WorkingDirectory` the service would silently start in
  **project** mode, serving just one. `XDG_CONFIG_HOME` is
  **frozen** into the unit when it is set (it decides where the base file lives,
  and neither manager passes on the shell environment); the base
  **value** is not: changing it means editing the file and restarting.
- **`install` refuses when the OTHER kind is already installed**, naming each
  unit and the `uninstall` of each, without removing or writing anything. Both together
  would be two processes fighting over the same project, and the server would deny one
  of them. There is no `--force`.
- **The credential is the folder's device key**, and only that.
  `--token`/`BRABO_ACCOUNT_TOKEN` are ignored on purpose: writing them to
  a unit file would leave them on disk, and this CLI never writes a credential to
  disk.
- **`uninstall` removes three things**: the unit file, the
  `brabo-runner.config.json` and the `brabo-runner-device-key.jwk.json`. The folder to
  clean is read from the unit file itself (the record of what was installed),
  never guessed from the current directory; without a unit, pass `--dir`. The
  key leaves **this disk**: it is **not** revoked on the server, which is done
  from the project screen.
- **`uninstall` with no kind named REFUSES** and lists what exists on disk, with
  the exact command for each. It does not inherit the default of `status` on purpose:
  reading the wrong kind costs a wrong line, removing the wrong one costs a
  service and a device key.
- **`status` answers one of four states**, each with its own sentence and exit code
  and none collapsed into another: not installed (`4`), installed and running
  (`0`), installed and stopped (`3`), and installed with the service manager
  not responding (`5`); this last one is never presented as "stopped". With both
  kinds on disk, the **code remains that of the unit asked about** (the
  four do not become eight nor add up), and the other one appears as **text**, as
  presence read from DISK, saying its state was not asked of the
  manager. Without `--machine` and with no resolvable project, the answer is about the
  **machine** unit, and the output names `--project` for whoever wanted the other.

The `PATH` at install time is **frozen** inside the unit (both managers
give the service a minimal PATH, and the runner calls `git` and
`docker`): if your PATH changed, run `service install` again.

> **A unit installed by an earlier version does not start: reinstall.** Until this
> fix, `WorkingDirectory=` was written **in quotes**, and systemd does not unquote
> that directive (unlike `ExecStart=`, where quotes are right): the value
> no longer started with `/`, the unit was refused at load
> (`Loaded: bad-setting`, `WorkingDirectory= path is not absolute`) and **never
> started**, in both kinds. There is no partial fix and no file to
> edit: `service install` overwrites the whole file, so just run it
> again. `status` and `uninstall` still read the folder of a unit in the old state,
> on purpose: whoever is in it must not lose the way out as well.
> `%` is the only character the folder escapes (`%%`), because that directive
> goes through specifier expansion; a space goes literal, since the whole line
> is the path.
>
> **`XDG_CONFIG_HOME` or `PATH` with `%`, space, quotes or a backslash: reinstall
> too.** Until AT-095 both were written raw (`Environment=XDG_CONFIG_HOME=...`),
> and `Environment=` splits on spaces and expands `%`: the unit started, but with
> `/home/eu/50%off com espaco` the service received `/home/eu/50<id-do-os>ff` and
> looked for the key in a folder that does not exist. Now the whole assignment goes
> in quotes and escaped. A line break in those two values is refused at
> `install`. Check the value systemd understood, never the file:
> `systemctl --user show -p Environment brabo-runner.service`.

## Reconnection

When the connection drops, the runner **asks for a NEW ticket** and tries again, with
backoff (`1s, 2s, 5s, 10s, 30s`) and a ceiling of 10 consecutive attempts without
success; past that, it gives up and tells you to run it again. A refusal to
join the channel (invalid ticket, another runner already connected on this project)
is **not** transient: it exits right away, with the message, without an
automatic loop.

The built-in auto-reconnect of the `phoenix` library is deliberately **off**
(`reconnectAfterMs`), and that is no detail: the socket ticket is **single use**
(RN-108), and the lib's reconnect repeats the SAME parameters, that is,
the same already-consumed ticket, refused every time. An earlier version of this
CLI shipped with it ON (the code comment said otherwise) and the measured
effect was: a refusal every ~5.13s indefinitely, and **429 (rate limit)
on the browser screen of the account owner**: the api limit is per
user, and the one blowing it was the runner. If you see 429 on the web with no explanation,
check whether the runner binary is up to date.

## Security

The runner's security boundary **is not sandboxing**; it is the composition of
three things: authentication (the Personal Access Token of your account), the usual
approval pipeline (every agent command still is born a proposed
action, subject to the project's policy) and your consent to run this
binary on your own machine, with your privileges.

## Tests, typecheck and lint of this workspace

```bash
pnpm --filter runner test
pnpm --filter runner typecheck
pnpm --filter runner lint
```

The `lint` is the same `oxlint` as the web app, in check mode (no `--fix`), over
`src/` and `scripts/`, with the `correctness` category as an error and
`--deny-warnings`; it is the "Oxlint (runner)" step of the `Lint` job in `ci.yml`.

Build the standalone binary (requires [Bun](https://bun.sh) installed,
`curl -fsSL https://bun.sh/install | bash`, only for the CURRENT platform; it never
cross-compiles a native addon):

```bash
pnpm --filter runner build:bin
pnpm --filter runner smoke:bin
```

## More

Full documentation, including the architecture decision behind the local
runner, in [ADR 0103](https://github.com/daneiel/brabo/blob/main/docs/adr/0103-runner-local-execucao-na-maquina-do-usuario.md),
[ADR 0104](https://github.com/daneiel/brabo/blob/main/docs/adr/0104-execution-mode-tres-valores-e-workspace-verificado-pelo-runner.md),
[ADR 0105](https://github.com/daneiel/brabo/blob/main/docs/adr/0105-personal-access-token-do-runner-escopado-por-construcao.md),
[ADR 0106](https://github.com/daneiel/brabo/blob/main/docs/adr/0106-distribuicao-do-runner-via-tsup-e-npm-publish.md),
[ADR 0107](https://github.com/daneiel/brabo/blob/main/docs/adr/0107-navegacao-de-pasta-local-via-o-runner.md)
and [ADR 0112](https://github.com/daneiel/brabo/blob/main/docs/adr/0112-binario-standalone-do-runner-via-bun-build-compile.md)
(the standalone binary).

## License

MIT. The third-party software notices, with the written offer for the LGPL libraries of the Bun runtime, are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
