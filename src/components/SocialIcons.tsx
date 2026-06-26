import React from "react";
import {
  SiInstagram,
  SiX,
  SiFacebook,
  SiVk,
  SiTelegram,
  SiWhatsapp,
} from "@icons-pack/react-simple-icons";

interface SocialIconProps {
  size?: number;
  className?: string;
}

export function InstagramIcon({ size = 18, className }: SocialIconProps) {
  return <SiInstagram size={size} className={className} title="Instagram" />;
}

export function XIcon({ size = 18, className }: SocialIconProps) {
  return <SiX size={size} className={className} title="X" />;
}

export function FacebookIcon({ size = 18, className }: SocialIconProps) {
  return <SiFacebook size={size} className={className} title="Facebook" />;
}

export function VkIcon({ size = 18, className }: SocialIconProps) {
  return <SiVk size={size} className={className} title="VK" />;
}

export function TelegramIcon({ size = 18, className }: SocialIconProps) {
  return <SiTelegram size={size} className={className} title="Telegram" />;
}

export function WhatsAppIcon({ size = 18, className }: SocialIconProps) {
  return <SiWhatsapp size={size} className={className} title="WhatsApp" />;
}

/** Map of social platform names to their icon component */
export const socialIconMap: Record<string, React.FC<SocialIconProps>> = {
  instagram: InstagramIcon,
  twitter: XIcon,
  x: XIcon,
  facebook: FacebookIcon,
  vk: VkIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
};

/** Get the brand color for a social platform */
export function getSocialColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: "text-pink-500",
    twitter: "text-blue-400",
    x: "text-blue-400",
    facebook: "text-blue-600",
    vk: "text-blue-500",
    telegram: "text-sky-500",
    whatsapp: "text-green-500",
  };
  return colors[platform.toLowerCase()] || "text-text-muted";
}
