export interface ErrorSurface {
  what: string;
  why: string;
  next: string;
}

export function formatError(err: unknown, stage: string): ErrorSurface {
  const msg = (err as Error).message ?? String(err);

  if (/_API_KEY|api[ _-]?key/i.test(msg)) {
    const m = msg.match(/([A-Z_]{4,})/);
    const envVar = m ? m[1] : "API key env var";
    return {
      what: `${stage} stage failed because ${envVar} is not set`,
      why: `${stage} requires this env var to authenticate the upstream service`,
      next: `Run \`export ${envVar}=...\` and retry`
    };
  }
  if (/no scan|no plan|no script|no record|missing scan|missing artifacts/i.test(msg)) {
    return {
      what: `${stage} stage failed because a prior stage's artifacts are missing`,
      why: `each stage reads from \`.tutorialvid/cache/\` produced by the previous stage`,
      next: `run \`tutorialvid <previous-stage>\` and try again`
    };
  }
  if (/selector .* failed/.test(msg)) {
    return {
      what: `${stage} stage failed waiting for a DOM selector`,
      why: msg,
      next: `verify the selector exists in the page and that the dev server is up`
    };
  }
  return {
    what: `${stage} stage failed`,
    why: msg,
    next: `run with TV_LOG_LEVEL=debug for more detail`
  };
}

export function renderError(s: ErrorSurface): string {
  return `\n✖ ${s.what}\n  why: ${s.why}\n  next: ${s.next}\n`;
}
