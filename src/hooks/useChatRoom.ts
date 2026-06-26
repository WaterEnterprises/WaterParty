import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../lib/Store";
import { getAssetUrl, API_BASE, fetchWithAuth, loadChatMessagesCacheAsync, storeChatMessagesCache } from "../lib/constants";
import { cn, compressAndUpload, uploadVideo } from "../lib/utils";
import { useBackButton } from "./useBackButton";
import { saveMediaToDevice, isCapacitorNative } from "../lib/capacitor";
import type { Message } from "../lib/types";

/** Helper to fetch with session auth header */
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithAuth(url, options);
}

/** Extract a thumbnail frame from a video file */
function extractVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      // Seek to ~25% through the video for a representative frame
      const seekTime = Math.min(video.duration * 0.25, 3);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 640;
      let w = video.videoWidth || 640;
      let h = video.videoHeight || 480;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
      }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    video.src = url;
    video.load();
  });
}

export function useChatRoom() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { chats, user, sendSocketMessage, feed, registrations, addLocalChat, fetchedParties, fetchPartyById, removeChat, fetchUserProfile } = useStore();

  // ── Messages State (fetched from normalized messages table) ───
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const messagesFetchedRef = useRef(false);

  // ── Shared State ──────────────────────────────────────────────
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoThumbnail, setSelectedVideoThumbnail] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showInfo, setShowInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserPhotoIndex, setSelectedUserPhotoIndex] = useState(0);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportingInFlight, setReportingInFlight] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportTargetUser, setReportTargetUser] = useState<any | null>(null);

  const [showCameraCapture, setShowCameraCapture] = useState(false);

  const [localChat, setLocalChat] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // ── Derived data ──────────────────────────────────────────────
  const chat = chats.find((c) => c.ID === chatId) || localChat;
  const associatedParty = feed.find((p) => p.ID === chat?.PartyID) || (chat?.PartyID ? fetchedParties[chat.PartyID] : null);
  const isHost = associatedParty?.HostID === user?.ID;

  // ── Fetch messages from the API when chat changes ─────────────
  useEffect(() => {
    if (!chatId) return;
    messagesFetchedRef.current = false;
    setMessages([]);
    setMessagesLoading(true);

    const controller = new AbortController();

    // Load from IndexedDB cache first for instant display
    // Only applies if server hasn't responded yet (avoids overwriting fresh data)
    loadChatMessagesCacheAsync(chatId).then(cached => {
      if (!controller.signal.aborted && !messagesFetchedRef.current && cached?.length) {
        setMessages(cached);
        setMessagesLoading(false);
      }
    }).catch(() => {});

    // Then fetch from server for up-to-date data
    fetchWithAuth(`${API_BASE}/api/chats/${chatId}/messages?limit=100`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : [])
      .then((data: Message[]) => {
        if (!controller.signal.aborted) {
          // Merge with any NEW_MESSAGE events that arrived during fetch
          setMessages(prev => {
            const existingIds = new Set(data.map(m => m.ID));
            const merged = [...data];
            for (const msg of prev) {
              if (!existingIds.has(msg.ID)) {
                merged.push(msg);
              }
            }
            return merged;
          });
          setMessagesLoading(false);
          messagesFetchedRef.current = true;
          // Cache the fetched messages for next open
          storeChatMessagesCache(chatId, data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMessagesLoading(false);
        }
      });

    return () => controller.abort();
  }, [chatId]);

  // ── Watch for NEW_MESSAGE WebSocket event (instant delivery) ─
  useEffect(() => {
    if (!chatId || !messagesFetchedRef.current) return;

    // Poll for new messages periodically as a fallback
    const pollInterval = setInterval(() => {
      const currentChat = chats.find((c) => c.ID === chatId) || localChat;
      if (!currentChat?.RecentMessages) return;
      const lastLocalMsg = messages[messages.length - 1];
      if (!lastLocalMsg) return;
      const remoteLastMsgs = currentChat.RecentMessages || [];
      const remoteLast = remoteLastMsgs[remoteLastMsgs.length - 1];
      if (remoteLast?.Timestamp) {
        const remoteTime = new Date(remoteLast.Timestamp).getTime();
        const localTime = new Date(lastLocalMsg.CreatedAt).getTime();
        if (remoteTime > localTime + 2000) {
          fetchWithAuth(`${API_BASE}/api/chats/${chatId}/messages?limit=50`)
            .then(res => res.ok ? res.json() : [])
            .then((data: Message[]) => {
              if (data.length > messages.length) {
                setMessages(data);
                storeChatMessagesCache(chatId, data);
              }
            })
            .catch(() => {});
        }
      }
    }, 60000); // Fallback poll every 60s

    return () => clearInterval(pollInterval);
  }, [chatId, chats, localChat, messages.length]);

  // ── Effects ───────────────────────────────────────────────────
  useEffect(() => {
    const found = chats.find((c) => c.ID === chatId);
    if (found) {
      setLocalChat(found);
      setLoading(false);
    } else if (chatId && user) {
      authFetch(`${API_BASE}/api/chats`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const foundInFetched = data.find((c: any) => c.ID === chatId);
            if (foundInFetched) {
              setLocalChat(foundInFetched);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [chats, chatId, user]);

  useEffect(() => {
    if (chat?.PartyID && chat.PartyID !== 'DM' && !feed.find(p => p.ID === chat.PartyID)) {
      fetchPartyById(chat.PartyID);
    }
  }, [chat?.PartyID, feed]);

  // Reset state when chat changes
  useEffect(() => {
    setShowInfo(false);
    setSelectedUser(null);
    setSelectedUserPhotoIndex(0);
    setMessage("");
    setShowCameraCapture(false);
    setLightboxImage(null);
    setLightboxVideo(null);
    setShowReportModal(false);
    setReportReason("");
    setReportDetails("");
    setReportError(null);
    setReportSuccess(false);
    setReportTargetUser(null);
  }, [chatId]);

  // Capacitor native back button
  useBackButton(() => {
    navigate('/messages', { state: { activeTab: chat?.IsGroup ? 'party' : 'direct' } });
  });

  // ── Listen for NEW_MESSAGE WebSocket events (instant delivery) ─
  useEffect(() => {
    if (!chatId) return;

    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (!msg || msg.ChatID !== chatId) return;
      setMessages(prev => {
        // Deduplicate — skip if already present (optimistic send race)
        if (prev.some(m => m.ID === msg.ID || (m.ID.startsWith('msg_optimistic_') && m.SenderID === msg.SenderID && m.Content === msg.Content && Math.abs(new Date(m.CreatedAt).getTime() - new Date(msg.CreatedAt).getTime()) < 5000))) return prev;
        const updated = [...prev, msg];
        // Cache asynchronously
        storeChatMessagesCache(chatId, updated);
        return updated;
      });
    };

    window.addEventListener('ws:new_message', handler);
    return () => window.removeEventListener('ws:new_message', handler);
  }, [chatId]);

  // ── Smart auto-scroll (only if user is near bottom) ────────────
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 150;
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Handlers: Send & Media Upload ──────────────────────────
  const handleSend = useCallback(async (e?: any) => {
    e?.preventDefault();
    if (!message.trim() && !selectedImage && !selectedVideo) return;
    // Prevent duplicate sends from rapid taps
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setSending(true);

    const newMessageContent = message;

    let mediaId: string | undefined;
    let videoId: string | undefined;
    let thumbId: string | undefined;
    try {
      if (selectedImage && selectedImageFile) {
        mediaId = await compressAndUpload(selectedImageFile, `msg_img_${Date.now()}`);
      }
      if (selectedVideo && selectedVideoFile) {
        videoId = await uploadVideo(selectedVideoFile, `msg_vid_${Date.now()}`);
        // Upload video thumbnail if we extracted one
        if (selectedVideoThumbnail) {
          try {
            const resp = await fetch(selectedVideoThumbnail);
            const thumbBlob = await resp.blob();
            const thumbFile = new File([thumbBlob], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
            thumbId = await compressAndUpload(thumbFile, `msg_thumb_${Date.now()}`);
          } catch {}
        }
      }
    } catch {
      setUploadError("Failed to upload media. Please try again.");
      isSendingRef.current = false;
      setSending(false);
      return;
    }

    if (chat && user) {
      const now = new Date().toISOString();
      // Update local messages state optimistically
      const optimisticMsg: Message = {
        ID: "msg_optimistic_" + Date.now(),
        ChatID: chat.ID,
        SenderID: user.ID,
        Content: newMessageContent,
        ImageUrl: thumbId || mediaId || undefined,
        VideoUrl: videoId || undefined,
        CreatedAt: now,
        SenderName: user.RealName,
        SenderThumbnail: user.Thumbnail,
      };
      setMessages(prev => [...prev, optimisticMsg]);

      // Update RecentMessages for preview (keep only last message)
      addLocalChat({
        ...chat,
        RecentMessages: [
          {
            SenderID: user.ID,
            Content: newMessageContent,
            Timestamp: now,
            ImageUrl: thumbId || mediaId,
            VideoUrl: videoId,
          },
        ],
      });
    }

    sendSocketMessage("SEND_MESSAGE", {
      ChatID: chat.ID,
      Content: newMessageContent,
      ImageUrl: thumbId || mediaId,
      VideoUrl: videoId,
    });
    setMessage("");
    setSelectedImage(null);
    setSelectedImageFile(null);
    setSelectedVideo(null);
    setSelectedVideoFile(null);
    setSelectedVideoThumbnail(null);
    setUploadError(null);
    if (selectedImage?.startsWith('blob:')) URL.revokeObjectURL(selectedImage);
    if (selectedVideo?.startsWith('blob:')) URL.revokeObjectURL(selectedVideo);
    if (selectedVideoThumbnail?.startsWith('blob:')) URL.revokeObjectURL(selectedVideoThumbnail);
    isSendingRef.current = false;
    setSending(false);
  }, [message, selectedImage, selectedImageFile, selectedVideo, selectedVideoFile, selectedVideoThumbnail, chat, user, addLocalChat, sendSocketMessage]);

  const handleLocalImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 20;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (selectedImage?.startsWith('blob:')) URL.revokeObjectURL(selectedImage);
    if (selectedVideo?.startsWith('blob:')) URL.revokeObjectURL(selectedVideo);

    setUploadError(null);
    setUploadingImage(true);

    const isVideo = file.type.startsWith("video/") ||
      file.name.endsWith(".mp4") ||
      file.name.endsWith(".webm") ||
      file.name.endsWith(".mov");

    const url = URL.createObjectURL(file);

    try {
      if (isVideo) {
        setSelectedVideo(url);
        setSelectedVideoFile(file);
        setSelectedImage(null);
        setSelectedImageFile(null);
        // Extract a frame as thumbnail
        extractVideoThumbnail(file).then((thumb) => {
          if (thumb) setSelectedVideoThumbnail(thumb);
        }).catch(() => {});
      } else {
        setSelectedImage(url);
        setSelectedImageFile(file);
        setSelectedVideo(null);
        setSelectedVideoFile(null);
        setSelectedVideoThumbnail(null);
      }
    } catch (err) {
      console.error("Processing failed:", err);
      setUploadError("Could not read media file.");
      URL.revokeObjectURL(url);
    }
    setUploadingImage(false);
  }, [selectedImage, selectedVideo]);

  const handleDownloadMedia = useCallback(async (url: string, isVideo: boolean = false) => {
    const mediaId = url.match(/media_[\da-f]+/)?.[0] || `media_${Date.now()}`;
    const mimeType = isVideo ? "video/mp4" : "image/jpeg";

    if (isCapacitorNative()) {
      const ok = await saveMediaToDevice(url, mediaId, mimeType);
      if (ok) return;
    }

    const ext = isVideo ? "mp4" : "jpg";
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Water-Party-${mediaId}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = `Water-Party-${mediaId}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const handleDownloadImage = useCallback((url: string) => {
    return handleDownloadMedia(url, false);
  }, [handleDownloadMedia]);

  // ── Report Handler ────────────────────────────────────────────
  const handleReportSubmit = useCallback(async () => {
    if (!user || !reportTargetUser || !reportReason) {
      setReportError("Please select a reason for reporting.");
      return;
    }

    setReportingInFlight(true);
    setReportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ReporterID: user.ID,
          ReportedUserID: reportTargetUser.ID,
          Reason: reportReason,
          Details: reportDetails,
        }),
      });

      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
          setReportReason("");
          setReportDetails("");
          setReportTargetUser(null);
        }, 2200);
      } else {
        const errData = await res.json();
        setReportError(errData.error || "Failed to submit report. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setReportError("Network error. Please check your connection and try again.");
    } finally {
      setReportingInFlight(false);
    }
  }, [user, reportTargetUser, reportReason, reportDetails]);

  // ── User click / DM ───────────────────────────────────────────
  const handleUserClick = useCallback(async (userId: string) => {
    if (userId === user?.ID) return;
    const data = await fetchUserProfile(userId);
    if (data) {
      setSelectedUser(data);
    }
  }, [user?.ID, fetchUserProfile]);

  const handleDM = useCallback(async () => {
    if (!selectedUser || !user) return;

    const existingChat = chats.find(
      (c) =>
        !c.IsGroup &&
        c.ParticipantIDs?.includes(user.ID) &&
        c.ParticipantIDs?.includes(selectedUser.ID),
    );

    if (existingChat) {
      setSelectedUser(null);
      setSelectedUserPhotoIndex(0);
      navigate(`/chat/${existingChat.ID}`);
    } else {
      try {
        const res = await authFetch(`${API_BASE}/api/chats/dm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUserId: user.ID,
            targetUserId: selectedUser.ID,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ChatID) {
            addLocalChat({
              ID: data.ChatID,
              PartyID: "DM",
              Title: `${user.RealName} & ${selectedUser.RealName}`,
              ImageUrl: selectedUser.Thumbnail || "",
              RecentMessages: [],
              IsGroup: false,
              ParticipantIDs: [user.ID, selectedUser.ID],
            });
            sendSocketMessage("GET_CHATS", {});
            setSelectedUser(null);
            setSelectedUserPhotoIndex(0);
            navigate(`/chat/${data.ChatID}`);
          }
        }
      } catch (err) {
        console.error("Failed to create DM via POST:", err);
      }
    }
  }, [selectedUser, user, chats, navigate, addLocalChat, sendSocketMessage]);

  // ── Camera Capture ────────────────────────────────────────────
  const handleCameraCapture = useCallback((result: { file: File; previewUrl: string }) => {
    if (selectedImage?.startsWith('blob:')) URL.revokeObjectURL(selectedImage);
    if (selectedVideo?.startsWith('blob:')) URL.revokeObjectURL(selectedVideo);

    setSelectedImage(result.previewUrl);
    setSelectedImageFile(result.file);
    setSelectedVideo(null);
    setSelectedVideoFile(null);
    setUploadError(null);
  }, [selectedImage, selectedVideo]);

  // ── ETA helper ────────────────────────────────────────────────
  const getETA = useCallback(() => {
    if (!chat?.IsGroup) return "DIRECT";
    if (!associatedParty?.StartTime) return "ESTABLISHING...";

    const start = new Date(associatedParty.StartTime);
    const now = new Date();
    const diff = start.getTime() - now.getTime();

    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 24) return `IN ${Math.floor(hours / 24)}D ${hours % 24}H`;
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
    if (agoHours > 24) return `${Math.floor(agoHours / 24)}D AGO`;
    return `${agoHours}H AGO`;
  }, [chat?.IsGroup, associatedParty?.StartTime, associatedParty?.DurationHours]);

  // ── Return ────────────────────────────────────────────────────
  return {
    // Data
    messages,
    messagesLoading,
    chat,
    chatId,
    associatedParty,
    isHost,
    user,
    navigate,
    chats,
    registrations,
    sendSocketMessage,
    addLocalChat,
    removeChat,
    scrollRef,
    fileInputRef,

    // Shared State
    message, setMessage,
    selectedImage, setSelectedImage,
    selectedImageFile, setSelectedImageFile,
    selectedVideo, setSelectedVideo,
    selectedVideoFile, setSelectedVideoFile,
    uploadError, setUploadError,
    uploadingImage, setUploadingImage,
    sending,
    showInfo, setShowInfo,
    selectedUser, setSelectedUser,
    selectedUserPhotoIndex, setSelectedUserPhotoIndex,
    lightboxImage, setLightboxImage,
    lightboxVideo, setLightboxVideo,
    showReportModal, setShowReportModal,
    reportReason, setReportReason,
    reportDetails, setReportDetails,
    reportingInFlight, setReportingInFlight,
    reportSuccess, setReportSuccess,
    reportError, setReportError,
    reportTargetUser, setReportTargetUser,
    showCameraCapture, setShowCameraCapture,
    loading,

    // Shared Handlers
    handleSend,
    handleLocalImageUpload,
    handleDownloadMedia,
    handleDownloadImage,
    handleReportSubmit,
    handleUserClick,
    handleDM,
    handleCameraCapture,
    getETA,
  };
}
