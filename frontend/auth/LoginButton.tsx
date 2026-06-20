import { GoogleGIcon } from "../shell/icons";

export function LoginButton() {
  return (
    <a className="login-button" href="/auth/login">
      <GoogleGIcon />
      Google でログイン
    </a>
  );
}
