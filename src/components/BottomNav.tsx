import { Link, useLocation } from 'react-router-dom';
import { Layers, MessageSquare, PartyPopper, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useRef, useEffect } from 'react';
import { gsap } from '../lib/gsap';

export function BottomNav() {
  const location = useLocation();

  if (location.pathname.startsWith('/chat/') || location.pathname.startsWith('/admin')) return null;

  const navItems = [
    { path: '/', icon: Layers, label: 'Swipe' },
    { path: '/messages', icon: MessageSquare, label: 'Chats' },
    { path: '/create', icon: PartyPopper, label: 'Party', isNeon: true },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="w-full h-full bg-overlay/95 flex items-center justify-around px-2 z-50 border-t border-border-default backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "relative flex flex-col items-center justify-center h-full w-full gap-0.5",
              isActive ? "text-brand-primary" : "text-text-muted"
            )}
          >
            <div
              className="relative p-1 rounded-full transition-colors duration-300"
            >
              {item.isNeon && isActive && (
                <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-[6px]" />
              )}
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className={cn('relative z-10', item.isNeon && !isActive && 'text-brand-primary/50', item.isNeon && isActive && 'drop-shadow-[0_0_6px_rgba(255,59,92,0.8)]')}
              />
            </div>
            <span className="text-nano font-black uppercase tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
