export interface RoleAuthCredentials {
  mode: "credentials";
  username_env: string;
  password_env: string;
  username_selector?: string;
  password_selector?: string;
  submit_selector?: string;
  login_url?: string;
}

export interface RoleAuthStorageState {
  mode: "storage_state";
  storage_state_path: string;
}

export type RoleAuth = RoleAuthCredentials | RoleAuthStorageState;

export interface RoleDef {
  id: string;
  label: string;
  auth: RoleAuth;
  homepage_route?: string;
}

export interface RolesFile {
  roles: RoleDef[];
}

export interface RouteRoleCell {
  accessible: boolean;
  dom_hash?: string;
  title?: string;
  unique_elements?: string[];
  redirected_to?: string;
}

export interface ContextSource {
  path: string;
  bytes: number;
}

export interface Discovery {
  context_sources: ContextSource[];
  context_corpus: string;
  roles: RoleDef[];
  route_role_matrix: Record<string, Record<string, RouteRoleCell>>;
  common_pages: string[];
  created_at: string;
}
