import { useState } from "react";
import { Link, Route, Routes } from "react-router";
import { Balance } from "../balance/Balance";
import { Home } from "../counter/Home";
import { Drawer } from "./Drawer";
import { Flower, MenuIcon } from "./icons";

function NotFound() {
  return <main className="notfound">404</main>;
}

function LoginError() {
  return <main className="notfound">403</main>;
}

export function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <header className="header">
        <Link to="/" className="home-link" aria-label="ホームへ">
          <Flower />
        </Link>
        <button
          type="button"
          className="menu-button"
          aria-label="メニュー"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon />
        </button>
      </header>
      {menuOpen && <Drawer onClose={() => setMenuOpen(false)} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/balance" element={<Balance />} />
        <Route path="/login-error" element={<LoginError />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
