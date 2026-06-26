import { Mail, Briefcase, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { InstagramIcon, XIcon, VkIcon, TelegramIcon, WhatsAppIcon, FacebookIcon, getSocialColor } from './SocialIcons';
import { PhotoCarousel } from './PhotoCarousel';
import { cn } from '../lib/utils';

interface SocialLinkEntry {
  key: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }> | null;
  color: string;
  href: string;
  displayValue: string;
}

function buildSocialLinks(user: any): SocialLinkEntry[] {
  const raw = [
    { key: 'Instagram', value: user.Instagram, icon: InstagramIcon, color: getSocialColor('instagram'), href: (v: string) => `https://instagram.com/${v}`, transform: (v: string) => v },
    { key: 'X', value: user.Twitter, icon: XIcon, color: getSocialColor('x'), href: (v: string) => `https://x.com/${v}`, transform: (v: string) => v },
    { key: 'VK', value: user.VK, icon: VkIcon, color: getSocialColor('vk'), href: (v: string) => `https://vk.com/${v}`, transform: (v: string) => v },
    { key: 'Telegram', value: user.Telegram, icon: TelegramIcon, color: getSocialColor('telegram'), href: (v: string) => `https://t.me/${v}`, transform: (v: string) => v },
    { key: 'WhatsApp', value: user.WhatsApp, icon: WhatsAppIcon, color: getSocialColor('whatsapp'), href: (v: string) => `https://wa.me/${v.replace(/[^0-9]/g, '')}`, transform: (v: string) => v.replace(/[^0-9]/g, '') || v },
    { key: 'Facebook', value: user.Facebook, icon: FacebookIcon, color: getSocialColor('facebook'), href: (v: string) => `https://facebook.com/${v}`, transform: (v: string) => v },
    { key: 'Email', value: user.ShowEmail ? user.Email : '', icon: null, color: 'text-amber-400', href: (v: string) => `mailto:${v}`, transform: (v: string) => v },
  ];
  return raw
    .filter(s => s.value)
    .map(s => ({
      key: s.key,
      value: s.value,
      icon: s.icon,
      color: s.color,
      href: s.href(s.value),
      displayValue: s.transform(s.value),
    }));
}

interface ProfileDetailsProps {
  user: any;
  /** PhotoCarousel props */
  photos: string[];
  currentPhotoIndex: number;
  onPhotoIndexChange: (index: number) => void;
  onClose?: () => void;
  closeIcon?: 'back' | 'x';
  trustScore?: number;
  isLandscape?: boolean;
  showPhotoDots?: boolean;
  showPhotoArrows?: boolean;
  photoGradient?: string;
  /** Size of social icon. Default 20. */
  socialIconSize?: number;
  /** Context-specific action buttons rendered below the profile details */
  actions?: React.ReactNode;
  /** Additional class names for the outer wrapper */
  className?: string;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.4, ease: 'easeOut' },
  }),
};

/**
 * Unified profile display component that renders:
 * 1. PhotoCarousel (user photos)
 * 2. User name heading + trust score
 * 3. Bio, Gender, Social links, Work & Education (with staggered entrance animations)
 * 4. Context-specific action buttons (via `actions` slot)
 */
export function ProfileDetails({
  user,
  photos,
  currentPhotoIndex,
  onPhotoIndexChange,
  onClose,
  closeIcon = 'back',
  trustScore,
  isLandscape,
  showPhotoDots = true,
  showPhotoArrows = false,
  photoGradient = 'from-overlay via-overlay/40 to-transparent',
  socialIconSize = 20,
  actions,
  className,
}: ProfileDetailsProps) {
  const socials = buildSocialLinks(user);
  const hasWork = !!(user.JobTitle || user.Company);
  const hasEducation = !!(user.School || user.Degree);
  const displayTrustScore = trustScore ?? (user.TrustScore ?? 100);

  let animIdx = 0;

  return (
    <div className={cn('flex flex-col overflow-y-auto scrollbar-hide', className)}>
      {photos.length > 0 ? (
        <PhotoCarousel
          photos={photos}
          currentIndex={currentPhotoIndex}
          onIndexChange={onPhotoIndexChange}
          onClose={onClose}
          closeIcon={closeIcon}
          isLandscape={isLandscape}
          contain
          dotVariant="profile"
          showDots={showPhotoDots}
          showArrows={showPhotoArrows}
          gradient={photoGradient}
        >
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none z-10">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-black text-white tracking-tight uppercase drop-shadow-xl">
                {user.RealName}
              </h2>
              <span className="px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5 shadow-sm shrink-0">
                🛡️ {displayTrustScore.toFixed(1)}
              </span>
            </div>
            {user.Gender && (
              <p className="text-sm font-bold text-white/80 uppercase tracking-widest drop-shadow-lg">
                {user.Gender}
              </p>
            )}
          </div>
        </PhotoCarousel>
      ) : (
        <PhotoCarousel
          photos={[]}
          currentIndex={0}
          onIndexChange={() => {}}
          isLandscape={isLandscape}
          contain
          dotVariant="profile"
          showDots={false}
          emptyText={user.RealName ? `${user.RealName}'s Profile` : 'No Photos'}
        />
      )}

      <div className="px-6 -mt-4 relative z-10 pb-8">
        {/* Bio */}
        {user.Bio && (
          <motion.div
            custom={animIdx++}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="mb-5 text-center w-full bg-card border border-border-default rounded-2xl px-5 py-4"
          >
            <h3 className="text-xs font-black text-text-muted tracking-[0.2em] mb-2 uppercase">
              About Me
            </h3>
            <p className="text-sm text-text-primary leading-relaxed font-medium">{user.Bio}</p>
          </motion.div>
        )}


        {/* Social Links */}
        {socials.length > 0 && (
          <motion.div
            custom={animIdx++}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="mb-5 w-full"
          >
            <h3 className="text-xs font-black text-text-muted tracking-[0.2em] mb-3 uppercase text-center">
              Social Media
            </h3>
            <div className="flex flex-col items-center gap-2.5">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-3 bg-card border border-border-default rounded-xl px-5 py-3.5 hover:bg-glass hover:border-brand-accent/30 transition-all duration-200 group w-full"
                  >
                    {Icon ? (
                      <Icon size={socialIconSize} className={cn(s.color, 'shrink-0 transition-transform duration-200 group-hover:scale-110')} />
                    ) : (
                      <Mail size={socialIconSize} className={cn(s.color, 'shrink-0 transition-transform duration-200 group-hover:scale-110')} />
                    )}
                    <span className="text-sm font-bold text-text-primary group-hover:text-text-bright truncate transition-colors">
                      {s.displayValue}
                    </span>
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Work & Education */}
        {(hasWork || hasEducation) && (
          <motion.div
            custom={animIdx++}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="mb-5 w-full"
          >
            <h3 className="text-xs font-black text-text-muted tracking-[0.2em] mb-3 uppercase text-center">
              Work & Education
            </h3>
            <div className="flex flex-col gap-2.5">
              {hasWork && (
                <div className="bg-card border border-border-default rounded-xl px-5 py-3.5 flex items-center justify-center gap-3 w-full hover:bg-glass transition-colors duration-200">
                  <Briefcase size={16} className="text-text-faint shrink-0" />
                  <span className="text-sm font-bold text-text-primary truncate">
                    {user.JobTitle}{user.Company && <span className="text-text-muted"> @ {user.Company}</span>}
                  </span>
                </div>
              )}
              {hasEducation && (
                <div className="bg-card border border-border-default rounded-xl px-5 py-3.5 flex items-center justify-center gap-3 w-full hover:bg-glass transition-colors duration-200">
                  <GraduationCap size={16} className="text-text-faint shrink-0" />
                  <span className="text-sm font-bold text-text-primary truncate">
                    {user.School}{user.Degree && <span className="text-text-muted"> — {user.Degree}</span>}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Actions slot */}
        {actions && (
          <motion.div
            custom={animIdx++}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
}
