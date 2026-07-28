"use client";

import * as React from "react";
import {
  FolderGit2,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Save,
  Trash2,
  Users,
  MapPin,
  Link2,
  Building2,
  ExternalLink,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  getGitHubConfigAction,
  saveGitHubConfigAction,
  deleteGitHubConfigAction,
  getGitHubOverviewAction,
} from "@/modules/github/actions";
import type { GitHubConfigDTO } from "@/modules/github/domain/config";
import {
  filterRepos,
  sortRepos,
  type GitHubProfile,
  type GitHubRepo,
  type RepoSort,
} from "@/modules/github/domain/repo";
import { RepoCard } from "./RepoCard";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function GitHubTool() {
  const [config, setConfig] = React.useState<GitHubConfigDTO | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const [profile, setProfile] = React.useState<GitHubProfile | null>(null);
  const [repos, setRepos] = React.useState<GitHubRepo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<RepoSort>("recent");
  const [includeForks, setIncludeForks] = React.useState(false);

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGitHubOverviewAction();
      if (res.ok) {
        setProfile(res.value.profile);
        setRepos(res.value.repos);
      } else {
        setError(res.error);
        setProfile(null);
        setRepos([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // First load: fetch config, and if present, the overview.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getGitHubConfigAction();
      if (cancelled) return;
      setConfig(c);
      setLoaded(true);
      if (c) {
        void loadOverview();
      } else {
        setShowSettings(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOverview]);

  const visible = React.useMemo(() => {
    const filtered = filterRepos(repos, { query, includeForks });
    return sortRepos(filtered, sort);
  }, [repos, query, includeForks, sort]);

  function handleSaved(dto: GitHubConfigDTO) {
    setConfig(dto);
    setShowSettings(false);
    void loadOverview();
  }

  function handleDeleted() {
    setConfig(null);
    setProfile(null);
    setRepos([]);
    setError(null);
    setShowSettings(true);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSettings || !config ? (
        <ConfigPanel
          config={config}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onCancel={config ? () => setShowSettings(false) : undefined}
        />
      ) : null}

      {config ? (
        <>
          {profile ? (
            <ProfileHeader
              profile={profile}
              repoCount={repos.length}
              hasToken={config.hasToken}
              onRefresh={loadOverview}
              onSettings={() => setShowSettings((s) => !s)}
              loading={loading}
            />
          ) : null}

          {error ? <ErrorNote>{error}</ErrorNote> : null}

          {loading && repos.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando repositorios…
            </div>
          ) : null}

          {repos.length > 0 ? (
            <>
              <Controls
                query={query}
                onQuery={setQuery}
                sort={sort}
                onSort={setSort}
                includeForks={includeForks}
                onIncludeForks={setIncludeForks}
                shown={visible.length}
                total={repos.length}
              />

              {visible.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                  Ningún repositorio coincide con el filtro.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((repo) => (
                    <RepoCard key={repo.id} repo={repo} />
                  ))}
                </div>
              )}
            </>
          ) : !loading && !error ? (
            <p className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No se encontraron repositorios para esta cuenta.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// --- Config panel ----------------------------------------------------------

function ConfigPanel({
  config,
  onSaved,
  onDeleted,
  onCancel,
}: {
  config: GitHubConfigDTO | null;
  onSaved: (dto: GitHubConfigDTO) => void;
  onDeleted: () => void;
  onCancel?: () => void;
}) {
  const [username, setUsername] = React.useState(config?.username ?? "");
  const [token, setToken] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await saveGitHubConfigAction({ username, token });
      if (res.ok) onSaved(res.value);
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!config) return;
    await deleteGitHubConfigAction(config.id);
    onDeleted();
  }

  return (
    <div className="glass rounded-lg border border-border/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <FolderGit2 className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">
          {config ? "Conexión con GitHub" : "Conecta tu GitHub"}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gh-user">Usuario</Label>
          <Input
            id="gh-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="octocat"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gh-token">
            Token{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </Label>
          <Input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={
              config?.hasToken ? "•••••••• (guardado)" : "ghp_… o github_pat_…"
            }
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Sin token se listan solo los repos públicos. Con un{" "}
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
        >
          personal access token
          <ExternalLink className="size-3" />
        </a>{" "}
        (scope <span className="font-mono">repo</span>) verás también los
        privados y tendrás un límite de peticiones mayor.
      </p>

      {error ? (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={save} disabled={saving || !username.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        ) : null}
        {config ? (
          <Button
            variant="danger"
            onClick={remove}
            disabled={saving}
            className="ml-auto"
          >
            <Trash2 />
            Desconectar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// --- Profile header --------------------------------------------------------

function ProfileHeader({
  profile,
  repoCount,
  hasToken,
  onRefresh,
  onSettings,
  loading,
}: {
  profile: GitHubProfile;
  repoCount: number;
  hasToken: boolean;
  onRefresh: () => void;
  onSettings: () => void;
  loading: boolean;
}) {
  return (
    <div className="glass flex flex-col gap-4 rounded-lg border border-border/70 p-5 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.avatarUrl}
        alt={profile.login}
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-full border border-border/70"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-lg font-semibold leading-tight">
            {profile.name || profile.login}
          </h2>
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            @{profile.login}
          </a>
        </div>
        {profile.bio ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {profile.bio}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookMarked className="size-3.5" />
            {repoCount} {repoCount === 1 ? "repo cargado" : "repos cargados"}
            {hasToken ? "" : " (públicos)"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {profile.followers} seguidores
          </span>
          {profile.company ? (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" />
              {profile.company}
            </span>
          ) : null}
          {profile.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {profile.location}
            </span>
          ) : null}
          {profile.blog ? (
            <a
              href={
                profile.blog.startsWith("http")
                  ? profile.blog
                  : `https://${profile.blog}`
              }
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Link2 className="size-3.5" />
              {profile.blog.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <Button
          variant="secondary"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          title="Actualizar"
          aria-label="Actualizar"
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={onSettings}
          title="Ajustes de conexión"
          aria-label="Ajustes de conexión"
        >
          <Settings />
        </Button>
      </div>
    </div>
  );
}

// --- Controls --------------------------------------------------------------

function Controls({
  query,
  onQuery,
  sort,
  onSort,
  includeForks,
  onIncludeForks,
  shown,
  total,
}: {
  query: string;
  onQuery: (v: string) => void;
  sort: RepoSort;
  onSort: (v: RepoSort) => void;
  includeForks: boolean;
  onIncludeForks: (v: boolean) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar por nombre, descripción o topic…"
          className="pl-8"
          aria-label="Buscar repositorios"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex select-none items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeForks}
            onChange={(e) => onIncludeForks(e.target.checked)}
            className="size-4 accent-foreground"
          />
          Forks
        </label>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as RepoSort)}
          className={SELECT_CLASS}
          aria-label="Ordenar"
        >
          <option value="recent">Recientes</option>
          <option value="stars">Más estrellas</option>
          <option value="name">Nombre</option>
        </select>
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {shown} / {total}
      </span>
    </div>
  );
}
