"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getProfile } from "@/lib/api";
import { User } from "@/lib/types";

const TOKEN_KEY = "meetsync-auth-v2";
const USER_KEY = "meetsync-user-v2";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Team Chat", href: "/team-chat" },
  { label: "Whiteboards", href: "/whiteboards" },
  { label: "Apps", href: "/apps" },
];

type HeaderUser = User & {
  public_id: string;
  email?: string;
  profile_photo?: string;
};

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<HeaderUser | null>(null);
  const [photo, setPhoto] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      localStorage.removeItem("meetsync-token");
      localStorage.removeItem("meetsync-user");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      router.replace("/auth");
      return;
    }

    const parsedUser = JSON.parse(rawUser) as HeaderUser;

    setUser(parsedUser);
    setPhoto(parsedUser.profile_photo || "");
    setChecked(true);

    if (parsedUser.public_id) {
      getProfile(parsedUser.public_id)
        .then((profile) => {
          const updatedUser = {
            ...parsedUser,
            name: profile.name,
            email: profile.email,
            profile_photo: profile.profile_photo,
          };

          setUser(updatedUser);
          setPhoto(profile.profile_photo || "");
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        })
        .catch(() => {
          // Keep local user if profile request fails
        });
    }
  }, [router]);

  function signOut() {
    localStorage.removeItem("meetsync-token");
    localStorage.removeItem("meetsync-user");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    router.push("/");
  }

  if (!checked) {
    return null;
  }

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="app-header">
      <Link href="/dashboard" className="app-brand">
        <div className="brand-logo">M</div>

        <div className="app-brand-text">
          <p>Video Conferencing Platform</p>
          <h1>MeetSync Pro</h1>
        </div>
      </Link>

      <nav className="app-nav">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-header-actions">
        <ThemeToggle />

        <Link href="/settings" className="settings-button">
          ⚙️ Settings
        </Link>

        <button className="signout-button" onClick={signOut}>
          Sign out
        </button>

        <Link href="/profile" className="profile-chip profile-chip-link">
          {photo ? (
            <img className="profile-chip-avatar" src={photo} alt="Profile" />
          ) : (
            <span className="profile-initial">{initial}</span>
          )}

          <div>
            <strong>{user?.name || "User"}</strong>
            <small>View profile</small>
          </div>
        </Link>
      </div>
    </header>
  );
}