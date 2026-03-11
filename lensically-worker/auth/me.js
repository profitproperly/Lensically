import { requireAuth } from "./requireAuth.js";

export async function currentUser(request, env) {
  const user = await requireAuth(request, env);

  if (user instanceof Response) {
    return user;
  }

  return new Response(
    JSON.stringify({
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
      has_password: user.has_password,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
