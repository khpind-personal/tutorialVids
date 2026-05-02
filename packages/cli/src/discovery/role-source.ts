import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { RoleDef, RolesFile } from "./types.js";

export class RoleSourceError extends Error {}

export async function loadRolesFile(projectRoot: string, override?: string): Promise<RoleDef[]> {
  const path = override ?? join(projectRoot, "tutorialvid.roles.json");
  try { await access(path); }
  catch { throw new RoleSourceError(`tutorialvid.roles.json not found at ${path}`); }
  let parsed: RolesFile;
  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as RolesFile;
  } catch (err) {
    throw new RoleSourceError(`failed to parse roles file at ${path}: ${(err as Error).message}`);
  }
  if (!parsed.roles || !Array.isArray(parsed.roles) || parsed.roles.length === 0) {
    throw new RoleSourceError(`roles file at ${path} must define a non-empty 'roles' array`);
  }
  for (const r of parsed.roles) {
    if (!r.id) throw new RoleSourceError(`role missing 'id' in ${path}`);
    if (!r.label) throw new RoleSourceError(`role ${r.id} missing 'label' in ${path}`);
    if (!r.auth) throw new RoleSourceError(`role ${r.id} missing 'auth' in ${path}`);
    if (r.auth.mode === "credentials") {
      if (!r.auth.username_env || !r.auth.password_env) {
        throw new RoleSourceError(`role ${r.id} credentials auth missing username_env/password_env`);
      }
    } else if (r.auth.mode === "storage_state") {
      if (!r.auth.storage_state_path) {
        throw new RoleSourceError(`role ${r.id} storage_state auth missing storage_state_path`);
      }
    } else {
      throw new RoleSourceError(`role ${r.id} unknown auth.mode`);
    }
  }
  return parsed.roles;
}
