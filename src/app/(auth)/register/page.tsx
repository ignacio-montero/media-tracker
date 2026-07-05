import { AuthForm } from "@/components/AuthForm";
import { registerAction } from "../actions";

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
