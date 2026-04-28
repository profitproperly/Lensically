const WORKSPACE_USER = {
  id: "workspace-owner",
  email: "workspace@lensically.local",
  timezone: "America/New_York",
  clock_format: "12h",
  email_verified: true,
  is_admin: true,
  has_password: true,
};

export async function requireAuth(_request, _env) {
  return WORKSPACE_USER;
}
