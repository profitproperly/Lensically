import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Lensically",
  description: "Lensically Threads posting workspace.",
};

export default function Home() {
  redirect("/dashboard");
}
