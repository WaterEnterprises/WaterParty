import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { MessageSquare, MapPin, Clock, ChevronRight, Video, Image as ImageIcon, CheckCheck } from 'lucide-react';
import { useStore } from '../lib/Store';
import { getAssetUrl, API_BASE, PLACEHOLDER_IMAGE } from '../lib/constants';
import { useNavigate, useLocation } from 'react-router-dom';

export function MessagesPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'party' | 'direct'>(
    () => (location.state as any)?.activeTab === 'direct' ? 'direct' : 'party'
  );
  const { chats, feed, fetchedParties, fetchMissingParties } = useStore();
  const navigate = useNavigate();

  const activeChats = chats
    .filter((c) => activeTab === 'party' ? c.IsGroup : !c.IsGroup)
    .sort((a, b) => {
      // Sort by most recent message timestamp, latest first
      const aMsgs = a.RecentMessages || [];
      const bMsgs = b.RecentMessages || [];
      const aTime = aMsgs.length > 0 ? new Date(aMsgs[aMsgs.length - 1].Timestamp).getTime() : 0;
      const bTime = bMsgs.length > 0 ? new Date(bMsgs[bMsgs.length - 1].Timestamp).getTime() : 0;
      // Chats with messages come before empty chats
      if (aMsgs.length === 0 && bMsgs.length > 0) return 1;
      if (bMsgs.length === 0 && aMsgs.length > 0) return -1;
      return bTime - aTime;
    });

  useEffect(() => {
    const missingPartyIds = activeChats
      .map(c => c.PartyID)
      .filter(id => id && id !== 'DM' && !feed.find(p => p.ID === id) && !fetchedParties[id]);

    if (missingPartyIds.length > 0) {
      fetchMissingParties(missingPartyIds);
    }
  }, [activeChats, feed]);

  return (
    <div className="h-full w-full bg-transparent flex flex-col pt-8 pb-24 overflow-y-auto scrollbar-hide">
      {/* Top Tabs */}
      <div className="px-6 flex items-center justify-center z-10 mb-8 shrink-0">
        <div className="bg-elevated rounded-full p-1.5 flex w-full max-w-sm border border-border-default shadow-2xl">
          <button
            onClick={() => setActiveTab('party')}
            className={cn(
               "flex-1 py-3 text-nano font-black tracking-widest rounded-full transition-all duration-300",
               activeTab === 'party' ? "bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary shadow-xl shadow-brand-primary/20" : "text-text-faint"
            )}
          >
            PARTY CHATS
          </button>
          <button
            onClick={() => setActiveTab('direct')}
            className={cn(
               "flex-1 py-3 text-nano font-black tracking-widest rounded-full transition-all duration-300",
               activeTab === 'direct' ? "bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary shadow-xl shadow-brand-primary/20" : "text-text-faint"
            )}
          >
            DIRECT MESSAGES
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col px-6 relative overflow-y-auto scrollbar-hide">
         {activeChats.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center py-20 px-10 text-center">
             <div className="w-24 h-24 rounded-4xl bg-card border border-border-default flex items-center justify-center mb-8 shadow-2xl">
                <MessageSquare size={40} className="text-text-faint" />
             </div>
             <h2 className="text-xl font-black text-text-primary mb-2 uppercase tracking-tight">
                {activeTab === 'party' ? 'SILENCE DETECTED' : 'NO FREQUENCIES'}
             </h2>
             <p className="text-text-faint text-tiny font-bold uppercase tracking-[0.2em] leading-relaxed">
                {activeTab === 'party' 
                   ? 'Host or join a session to activate the network'
                   : 'Keep swiping to sync with other users'}
             </p>
           </div>
         ) : (
           <div className="flex flex-col space-y-4 pb-10">
              {activeChats.map(chat => {
                  const displayImage = chat.ImageUrl ? getAssetUrl(chat.ImageUrl) : PLACEHOLDER_IMAGE;
                  
                  // Find associated party for extra details
                  const associatedParty = feed.find(p => p.ID === chat.PartyID) || fetchedParties[chat.PartyID];
                  
                  if (chat.PartyID && chat.PartyID !== 'DM' && !associatedParty) {
                      console.log("Associated party not found for chat:", chat.Title, chat.PartyID);
                  }
                  
                  const getETA = () => {
                    if (!chat.IsGroup) return 'DIRECT';
                    if (!associatedParty?.StartTime) return 'TIME TBD';
                    
                    const start = new Date(associatedParty.StartTime);
                    const now = new Date();
                    const diff = start.getTime() - now.getTime();
                    
                    if (diff > 0) {
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      if (hours > 24) return `IN ${Math.floor(hours/24)}D ${hours%24}H`;
                      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      return `IN ${hours}H ${mins}M`;
                    }
                    
                    const end = new Date(start.getTime() + (associatedParty.DurationHours || 6) * 3600 * 1000);
                    if (now < end) {
                      const remainingDiff = end.getTime() - now.getTime();
                      const remHours = Math.floor(remainingDiff / (1000 * 60 * 60));
                      const remMins = Math.floor((remainingDiff % (1000 * 60 * 60)) / (1000 * 60));
                      return `${remHours}H ${remMins}M LEFT`;
                    }
                    
                    const agoDiff = now.getTime() - end.getTime();
                    const agoHours = Math.floor(agoDiff / (1000 * 60 * 60));
                    if (agoHours > 24) return `${Math.floor(agoHours/24)}D AGO`;
                    return `${agoHours}H AGO`;
                  };

                  // Helper: relative time formatting
                  const formatRelativeTime = (timestamp: string) => {
                    if (!timestamp) return '';
                    const date = new Date(timestamp);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'NOW';
                    if (diffMins < 60) return `${diffMins}m`;
                    if (diffHours < 24) return `${diffHours}h`;
                    if (diffDays < 7) return `${diffDays}d`;
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  };

                  const lastMsg = chat.RecentMessages?.length > 0
                    ? chat.RecentMessages[chat.RecentMessages.length - 1]
                    : null;

                  const isParty = chat.IsGroup;

                  return (
                     <div 
                        key={chat.ID} 
                        onClick={() => navigate(`/chat/${chat.ID}`)}
                        className={cn(
                          "group flex flex-col rounded-3xl bg-card border border-border-default active:scale-[0.98] transition-all duration-200 hover:border-brand-accent/20 cursor-pointer shadow-xl shadow-black/20",
                          isParty ? "p-4" : "p-3"
                        )}
                     >
                        <div className={cn("flex items-center", isParty ? "gap-4" : "gap-3")}>
                           <div className="relative shrink-0">
                              <img src={displayImage || PLACEHOLDER_IMAGE} className={cn("rounded-xl object-cover shrink-0 border border-border-default", isParty ? "w-16 h-16" : "w-12 h-12")} />
                              <div className={cn("absolute -bottom-0.5 -right-0.5 rounded-full bg-brand-accent border-2 border-card shadow-[0_0_6px_rgba(0,210,255,0.5)]", isParty ? "w-4 h-4" : "w-3 h-3")} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                 <h4 className={cn("font-black text-text-primary truncate uppercase tracking-wide group-hover:text-brand-accent transition-colors", isParty ? "text-sm max-w-[160px]" : "text-sm max-w-[130px]")}>
                                    {chat.Title}
                                 </h4>
                                 <div className="flex items-center gap-1.5 shrink-0">
                                    {lastMsg && (
                                      <span className={cn("font-bold text-text-faint tracking-tight", isParty ? "text-nano" : "text-micro")}>
                                        {formatRelativeTime(lastMsg.Timestamp)}
                                      </span>
                                    )}
                                    {!isParty && (
                                      <CheckCheck size={12} className="text-brand-accent/60" />
                                    )}
                                 </div>
                              </div>
                              <div className={cn("flex items-center", isParty ? "gap-1.5 mt-1" : "gap-1 mt-0.5")}>
                                <p className={cn("font-medium text-text-muted truncate flex items-center gap-1 min-w-0", "text-tiny")}>
                                  {!isParty && lastMsg && (
                                    <span className="text-nano font-black text-brand-accent uppercase tracking-widest shrink-0 mr-1">{getETA()}</span>
                                  )}
                                  {lastMsg ? (
                                    (() => {
                                      if (lastMsg.VideoUrl) {
                                        return (
                                          <span className="text-brand-accent font-bold flex items-center gap-1 truncate">
                                            <Video size={isParty ? 14 : 10} className="shrink-0" />
                                            <span className="truncate">VIDEO {lastMsg.Content ? `"${lastMsg.Content}"` : ""}</span>
                                          </span>
                                        );
                                      }
                                      if (lastMsg.ImageUrl) {
                                        return (
                                          <span className="text-brand-accent font-bold flex items-center gap-1 truncate">
                                            <ImageIcon size={isParty ? 14 : 10} className="shrink-0" />
                                            <span className="truncate">PHOTO {lastMsg.Content ? `"${lastMsg.Content}"` : ""}</span>
                                          </span>
                                        );
                                      }
                                      return <span className="truncate">{lastMsg.Content}</span>;
                                    })()
                                  ) : (
                                    <span className="italic text-text-faint">No messages yet</span>
                                  )}
                                </p>
                                <ChevronRight size={isParty ? 16 : 14} className="text-text-faint group-hover:text-brand-accent transition-colors shrink-0 ml-1" />
                              </div>

                              {/* Party-specific details: bigger & more prominent */}
                              {isParty && lastMsg && (
                                <div className="flex items-center mt-1.5">
                                  {lastMsg.SenderID && (
                                    <span className="text-micro font-black text-brand-accent uppercase tracking-widest bg-brand-accent/5 px-1.5 py-0.5 rounded-md">
                                      {getETA()}
                                    </span>
                                  )}
                                </div>
                              )}
                           </div>
                        </div>
                        
                        {associatedParty && isParty && (
                           <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glass border border-border-default">
                                 <MapPin size={10} className="text-brand-accent" />
                                 <span className="text-micro font-black text-text-secondary uppercase tracking-tighter truncate max-w-[80px]">
                                    {associatedParty.City || "LOCATION TBD"}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glass border border-border-default">
                                 <Clock size={10} className="text-brand-accent" />
                                 <span className="text-micro font-black text-text-secondary uppercase tracking-tighter">
                                    {associatedParty.StartTime ? new Date(associatedParty.StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "LIVE"}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 ml-auto">
                                 <span className="text-micro font-black text-brand-accent uppercase tracking-tighter">
                                    {associatedParty.CurrentGuestCount || 0}/{associatedParty.MaxCapacity || 0}
                                 </span>
                              </div>
                           </div>
                        )}
                     </div>
                  );
               })}
           </div>
         )}
      </div>
    </div>
  );
}
