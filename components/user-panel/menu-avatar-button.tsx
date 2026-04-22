"use client";

import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/client-dictionary";

interface MenuAvatarButtonProps {
  onClick: () => void;
}

export function MenuAvatarButton({ onClick }: MenuAvatarButtonProps) {
  const { user } = useAuth();
  const tUser = useT('userPanel');

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${user ? "w-auto px-1.5 gap-1.5" : "w-8 justify-center"} h-8 rounded-full border border-[rgb(10_8_0/20%)] bg-white flex items-center cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)]`}
      aria-label={tUser('panel.openMenu')}
    >
      <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-brand-black shrink-0">
        <path d="M3 5h12M3 9h12M3 13h12" />
      </svg>
      {user && (
        avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[linear-gradient(135deg,rgb(192_154_90/25%),rgb(192_154_90/12%))] flex items-center justify-center shrink-0">
            <span className="text-[8px] font-semibold text-[rgb(10_8_0/60%)] leading-none">{initials}</span>
          </div>
        )
      )}
    </button>
  );
}
