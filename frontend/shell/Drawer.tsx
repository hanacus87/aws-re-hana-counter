import { Link } from "react-router";
import { useAuth } from "../auth/auth-context";
import { LoginButton } from "../auth/LoginButton";
import { mutate } from "../lib/api";
import { Overlay } from "./Overlay";
import { LogoutIcon } from "./icons";

export function Drawer({ onClose }: { onClose: () => void }) {
  const { user, refresh } = useAuth();
  const logout = async () => {
    await mutate("/auth/logout", "POST");
    await refresh();
    onClose();
  };
  return (
    <Overlay
      overlayClassName="drawer-overlay"
      contentClassName="drawer"
      ariaLabel="メニューを閉じる"
      contentTag="nav"
      onClose={onClose}
    >
      <div className="drawer-links">
        <Link to="/" className="drawer-link" onClick={onClose}>
          カウンタ
        </Link>
        <Link to="/balance" className="drawer-link" onClick={onClose}>
          収支管理
        </Link>
      </div>
      <div className="drawer-footer">
        {user ? (
          <>
            <span className="drawer-user">{user.userName}</span>
            <button type="button" className="logout-button" onClick={logout}>
              <LogoutIcon />
              ログアウト
            </button>
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </Overlay>
  );
}
