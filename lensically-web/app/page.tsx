import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ACCESS_COOKIE = "lensically_workspace_access";
const DEFAULT_WORKSPACE_PASSWORD = "Lensically$$$$";

async function workspaceSessionValue(password: string) {
  const encoded = new TextEncoder().encode(`lensically:${password}:workspace`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function unlockWorkspace(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const workspacePassword =
    process.env.LENSICALLY_WORKSPACE_PASSWORD ?? DEFAULT_WORKSPACE_PASSWORD;

  if (password !== workspacePassword) {
    redirect("/?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, await workspaceSessionValue(workspacePassword), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}

export const metadata: Metadata = {
  title: "Lensically",
  description:
    "Private access for the Lensically Threads posting workspace.",
};

type HomeProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const hasError = params?.error === "invalid";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#15130f]">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#7a5c2e]">
            Lensically
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
            Private Threads workspace
          </h1>
          <p className="mt-4 text-base leading-7 text-[#625b50]">
            Enter the workspace password to manage drafts, schedules, and posting.
          </p>
        </div>

        <form
          action={unlockWorkspace}
          className="rounded-lg border border-[#d9cdbd] bg-white p-5 shadow-sm"
        >
          <label
            className="mb-2 block text-sm font-medium text-[#3b3328]"
            htmlFor="workspace-password"
          >
            Password
          </label>
          <input
            className="h-12 w-full rounded-md border border-[#cbbca8] bg-[#fffdf9] px-4 text-base outline-none transition focus:border-[#7a5c2e] focus:ring-4 focus:ring-[#7a5c2e]/15"
            id="workspace-password"
            name="password"
            placeholder="Enter password"
            type="password"
          />
          {hasError ? (
            <p className="mt-3 text-sm font-medium text-red-700">
              That password did not unlock the workspace.
            </p>
          ) : null}
          <button
            className="mt-4 h-12 w-full rounded-md bg-[#17130d] px-4 text-base font-semibold text-white transition hover:bg-[#2f271c] focus:outline-none focus:ring-4 focus:ring-[#17130d]/20"
            type="submit"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
