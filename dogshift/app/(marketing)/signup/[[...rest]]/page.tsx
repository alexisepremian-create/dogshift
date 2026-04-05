import { redirect } from "next/navigation";

export default function SignupCatchAllPage() {
  redirect("/login");
}
