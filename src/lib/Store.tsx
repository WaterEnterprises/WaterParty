import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useReducer, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Party, ChatRoom } from './types';
import { WS_BASE, API_BASE, getSessionToken, clearSession, loadStoredUser, storeUser, clearStoredUser, storeChatsCache, loadChatsCacheAsync, storeFeedCache, loadFeedCacheAsync, storePartyDetail, loadPartiesDetailAsync, storeUserProfile, getUserProfileSync, getPartyDetailSync, loadProfilesAsync, clearLocalDataCache, checkCacheSize, checkCacheVersionAndInvalidateAsync } from './constants';
import { Geolocation } from '@capacitor/geolocation';
import { isCapacitorNative } from './capacitor';
import { detectCurrencyFromCoords } from './utils';
import { fetchWithAuth } from './constants';

// ─── State & Action Types ───────────────────────────────────────────────

interface AppState {
  user: User | null;
  feed: Party[];
  chats: ChatRoom[];
  registrations: any[];
  fetchedParties: Record<string, any>;
  coords: { lat: number; lon: number } | null;
  userCurrency: string;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_FEED'; payload: Party[] }
  | { type: 'ADD_TO_FEED'; payload: Party }
  | { type: 'REMOVE_FROM_FEED'; payload: string }
  | { type: 'SET_CHATS'; payload: ChatRoom[] }
  | { type: 'ADD_OR_UPDATE_CHAT'; payload: ChatRoom }
  | { type: 'REMOVE_CHAT'; payload: string }
  | { type: 'SET_REGISTRATIONS'; payload: any[] }
  | { type: 'SET_FETCHED_PARTY'; payload: { id: string; data: any } }
  | { type: 'SET_COORDS'; payload: { lat: number; lon: number } | null }
  | { type: 'SET_USER_CURRENCY'; payload: string }
  | { type: 'LOGOUT' };

const initialState: AppState = {
  user: null,
  feed: [],
  chats: [],
  registrations: [],
  fetchedParties: {},
  coords: null,
  userCurrency: 'USD',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        userCurrency: action.payload?.PreferredCurrency || state.userCurrency,
      };
    case 'SET_FEED':
      // Persist to localStorage — UI shows cached data instantly on next load
      storeFeedCache(action.payload);
      checkCacheSize();
      return { ...state, feed: action.payload };
    case 'ADD_TO_FEED':
      return { ...state, feed: [...state.feed, action.payload] };
    case 'REMOVE_FROM_FEED':
      return { ...state, feed: state.feed.filter(p => p.ID !== action.payload) };
    case 'SET_CHATS':
      storeChatsCache(action.payload);
      checkCacheSize();
      return { ...state, chats: action.payload };
    case 'ADD_OR_UPDATE_CHAT':
      return {
        ...state,
        chats: state.chats.some(c => c.ID === action.payload.ID)
          ? state.chats.map(c => c.ID === action.payload.ID ? action.payload : c)
          : [...state.chats, action.payload],
      };
    case 'REMOVE_CHAT':
      return { ...state, chats: state.chats.filter(c => c.ID !== action.payload) };
    case 'SET_REGISTRATIONS':
      return { ...state, registrations: action.payload };
    case 'SET_FETCHED_PARTY':
      storePartyDetail(action.payload.id, action.payload.data);
      return {
        ...state,
        fetchedParties: { ...state.fetchedParties, [action.payload.id]: action.payload.data },
      };
    case 'SET_COORDS':
      return { ...state, coords: action.payload };
    case 'SET_USER_CURRENCY':
      return { ...state, userCurrency: action.payload };
    case 'LOGOUT':
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Context Type ───────────────────────────────────────────────────────

interface StoreContextType {
  user: User | null;
  feed: Party[];
  chats: ChatRoom[];
  registrations: any[];
  fetchedParties: Record<string, any>;
  coords: { lat: number; lon: number } | null;
  userCurrency: string;
  login: (u: User) => void;
  saveProfile: (u: User) => void;
  logout: () => void;
  sendSocketMessage: (event: string, payload: any) => void;
  removeFromFeed: (id: string) => void;
  removeChat: (id: string) => void;
  initializeApp: (u: User, initialChats: ChatRoom[], initialFeed: Party[], coords?: { lat: number; lon: number } | null) => void;
  refreshLocation: (
    onSuccess?: (coords: { lat: number; lon: number }) => void,
    onError?: (reason: 'denied' | 'unavailable' | 'timeout') => void
  ) => void;
  addLocalChat: (chat: ChatRoom) => void;
  fetchPartyById: (id: string) => void;
  fetchMissingParties: (ids: string[]) => void;
  fetchUserProfile: (userId: string) => Promise<any | null>;
}

const StoreContext = createContext<StoreContextType | null>(null);

// ─── Helpers ────────────────────────────────────────────────────────────

async function fetchWithAuthOrBare(url: string): Promise<Response> {
  const token = getSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['x-session-token'] = token;
  }
  return fetch(url, { headers });
}

function fastHTTPFetchAll(userId: string, dispatch: React.Dispatch<AppAction>) {
  fetch(`${API_BASE}/api/users/${userId}`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && !data.error) {
        dispatch({ type: 'SET_USER', payload: data });
        storeUser(data);
      }
    })
    .catch(() => {});

  // Feed fetched via HTTP as initial data — WS updates keep it fresh
  fetchWithAuthOrBare(`${API_BASE}/api/feed`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && !data.error) {
        dispatch({ type: 'SET_FEED', payload: data });
      }
    })
    .catch(() => {});
}

// ─── Provider Component ─────────────────────────────────────────────────

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, feed, chats, registrations, fetchedParties, coords, userCurrency } = state;

  const socketRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<{ event: string; payload: any }[]>([]);
  const navigate = useRef<ReturnType<typeof useNavigate> | null>(null);
  const navTrigger = useNavigate();
  const fetchedPartiesRef = useRef<Record<string, boolean>>({});
  const chatsHydratedRef = useRef(false);
  const feedHydratedRef = useRef(false);
  const lastChatsFetchRef = useRef(0);
  const lastFeedFetchRef = useRef(0);
  const lastProfileFetchRef = useRef(0);
  const FEED_FETCH_COOLDOWN_MS = 15_000;
  const CHATS_FETCH_COOLDOWN_MS = 15_000;
  const PROFILE_FETCH_COOLDOWN_MS = 15_000;

  useEffect(() => {
    navigate.current = navTrigger;
  }, [navTrigger]);

  const fetchPartyById = (id: string) => {
    if (fetchedPartiesRef.current[id]) return;
    // Check in-memory IndexedDB cache first
    const cached = getPartyDetailSync(id);
    if (cached) {
      fetchedPartiesRef.current[id] = true;
      dispatch({ type: 'SET_FETCHED_PARTY', payload: { id, data: cached } });
      return;
    }
    fetchedPartiesRef.current[id] = true;
    fetch(`${API_BASE}/api/party/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          dispatch({ type: 'SET_FETCHED_PARTY', payload: { id, data } });
        }
      })
      .catch(err => console.error("Party fetch failed for", id, err));
  };

  const fetchMissingParties = (ids: string[]) => {
    const uncached = ids.filter(id => id && id !== 'DM' && !fetchedPartiesRef.current[id]);
    if (uncached.length === 0) return;
    uncached.forEach(id => { fetchedPartiesRef.current[id] = true; });
    fetch(`${API_BASE}/api/parties?ids=${uncached.join(",")}`)
      .then(res => res.ok ? res.json() : [])
      .then(parties => {
        if (Array.isArray(parties)) {
          parties.forEach((party: any) => {
            if (party && party.ID) {
              dispatch({ type: 'SET_FETCHED_PARTY', payload: { id: party.ID, data: party } });
            }
          });
        }
      })
      .catch(err => console.error("Batch party fetch failed:", err));
  };

  /** Fetch a user profile by ID — returns cached if available, else fetches and caches */
  const fetchUserProfile = useCallback(async (userId: string): Promise<any | null> => {
    if (!userId) return null;
    // Check in-memory cache first
    const cached = getUserProfileSync(userId);
    if (cached) return cached;
    // Fetch from server
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) {
          storeUserProfile(userId, data);
          return data;
        }
      }
    } catch (e) {
      console.error("Failed to fetch user profile:", e);
    }
    return null;
  }, []);

  const refreshLocation = useCallback(async (
    onSuccess?: (coords: { lat: number; lon: number }) => void,
    onError?: (reason: 'denied' | 'unavailable' | 'timeout') => void
  ) => {
    try {
      const isNative = isCapacitorNative();
      if (!isNative) {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              dispatch({ type: 'SET_COORDS', payload: newCoords });
              if (onSuccess) onSuccess(newCoords);
            },
            (error) => {
              console.error("Browser location error:", error);
              if (error.code === error.PERMISSION_DENIED) {
                onError?.('denied');
              } else if (error.code === error.TIMEOUT) {
                onError?.('timeout');
              } else {
                onError?.('unavailable');
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        } else {
          onError?.('unavailable');
        }
      } else {
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location === 'granted' || permResult.location === 'prompt') {
          const pos = await Geolocation.getCurrentPosition();
          const newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          dispatch({ type: 'SET_COORDS', payload: newCoords });
          if (onSuccess) onSuccess(newCoords);
        } else {
          onError?.('denied');
        }
      }
    } catch (e) {
      console.warn("Location permission denied or unavailable:", e);
      onError?.('unavailable');
    }
  }, []);

  /**
   * Quick, silent GPS check on app open.
   * Only dispatches coords if location changed from stored DB value.
   */
  const detectCurrencyOnOpen = async (userData: any) => {
    try {
      let pos: { lat: number; lon: number } | null = null;
      if (!isCapacitorNative()) {
        if (!('geolocation' in navigator)) return;
        pos = await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        });
      } else {
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location !== 'granted' && permResult.location !== 'prompt') return;
        const p = await Geolocation.getCurrentPosition();
        pos = { lat: p.coords.latitude, lon: p.coords.longitude };
      }
      if (!pos) return;

      const storedLat = userData?.Latitude;
      const storedLon = userData?.Longitude;

      if (storedLat === undefined || storedLon === undefined ||
          storedLat === null || storedLon === null) {
        dispatch({ type: 'SET_COORDS', payload: pos });
        return;
      }

      if (Math.abs(pos.lat - storedLat) > 0.1 || Math.abs(pos.lon - storedLon) > 0.1) {
        dispatch({ type: 'SET_COORDS', payload: pos });
      }
    } catch {
      // GPS unavailable — skip silently
    }
  };

  // When GPS coords are available/change, detect currency via server
  useEffect(() => {
    if (coords) {
      detectCurrencyFromCoords(coords.lat, coords.lon, fetchWithAuth).then(currency => {
        if (currency) {
          dispatch({ type: 'SET_USER_CURRENCY', payload: currency });
        }
      });
    }
  }, [coords?.lat, coords?.lon]);

  // Restore user + cached data from IndexedDB on mount (instant paint before WS connects)
  useEffect(() => {
    const storedUser = loadStoredUser<User>();
    if (storedUser) {
      dispatch({ type: 'SET_USER', payload: storedUser });

      // Hydrate from IndexedDB cache (separate flags per data type)
      const hydrateFromCache = async () => {
        // Check cache version first — clears stale data if app updated
        await checkCacheVersionAndInvalidateAsync().catch(() => {});
        const [cachedChats, cachedFeed, partiesDetail] = await Promise.all([
          loadChatsCacheAsync<ChatRoom>(),
          loadFeedCacheAsync<Party>(),
          loadPartiesDetailAsync(),
          loadProfilesAsync(),
        ]);

        let chatsHydrated = false;
        let feedHydrated = false;

        if (!chatsHydratedRef.current && cachedChats && cachedChats.length > 0) {
          dispatch({ type: 'SET_CHATS', payload: cachedChats });
          chatsHydrated = true;
        }
        if (!feedHydratedRef.current && cachedFeed && cachedFeed.length > 0) {
          dispatch({ type: 'SET_FEED', payload: cachedFeed });
          feedHydrated = true;
        }

        // Dispatch cached party details into state (so they show instantly)
        if (partiesDetail && typeof partiesDetail === 'object') {
          const entries = Object.entries(partiesDetail);
          for (const [id, data] of entries) {
            if (data && data.ID) {
              fetchedPartiesRef.current[id] = true;
              dispatch({ type: 'SET_FETCHED_PARTY', payload: { id, data } });
            }
          }
        }

        // Only fetch via HTTP if cache was empty — WS will deliver real data
        if (!chatsHydrated || !feedHydrated) {
          if (!chatsHydrated) {
            lastChatsFetchRef.current = Date.now();
            fetchWithAuthOrBare(`${API_BASE}/api/chats`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d && !d.error) dispatch({ type: 'SET_CHATS', payload: d }); })
              .catch(() => {});
          }
          if (!feedHydrated) {
            lastFeedFetchRef.current = Date.now();
            fetchWithAuthOrBare(`${API_BASE}/api/feed`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d && !d.error) dispatch({ type: 'SET_FEED', payload: d }); })
              .catch(() => {});
          }
        }

        // Always fetch user profile from server (for up-to-date data)
        lastProfileFetchRef.current = Date.now();
        fetch(`${API_BASE}/api/users/${storedUser.ID}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && !data.error) {
              dispatch({ type: 'SET_USER', payload: data });
              storeUser(data);

              // After loading fresh profile, request GPS to detect currency
              detectCurrencyOnOpen(data);
            }
          })
          .catch(() => {});
      };

      hydrateFromCache().catch(e => console.error("Cache hydration failed:", e));
    }
  }, []);

  // Background sync — polls chats/feed/profile when visible
  useEffect(() => {
    if (!user) return;

    const visibleRef = { current: true };
    const handleVisibility = () => { visibleRef.current = !document.hidden; };
    document.addEventListener('visibilitychange', handleVisibility);

    let mounted = true;

    const schedule = (fn: () => void, intervalMs: number) => {
      let timerId: ReturnType<typeof setTimeout>;
      let cancelled = false;

      const run = () => {
        if (cancelled || !mounted) return;

        if (!visibleRef.current) {
          timerId = setTimeout(run, intervalMs);
          return;
        }

        const doWork = () => {
          if (!cancelled && mounted) {
            fn();
            timerId = setTimeout(run, intervalMs);
          }
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(doWork, { timeout: 2000 });
        } else {
          doWork();
        }
      };

      timerId = setTimeout(run, intervalMs);
      return () => { cancelled = true; clearTimeout(timerId); };
    };

    const cleanupChats = schedule(() => {
      // Skip if we fetched recently (e.g. mount fallback just ran)
      if (Date.now() - lastChatsFetchRef.current < CHATS_FETCH_COOLDOWN_MS) return;
      // HTTP fallback — primary updates come via WebSocket CHATS_LIST
      lastChatsFetchRef.current = Date.now();
      fetchWithAuthOrBare(`${API_BASE}/api/chats`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && !d.error) dispatch({ type: 'SET_CHATS', payload: d }); })
        .catch(() => {});
    }, 120000);

    const cleanupFeed = schedule(() => {
      // Skip if we fetched recently (e.g. mount fallback or WS just delivered)
      if (Date.now() - lastFeedFetchRef.current < FEED_FETCH_COOLDOWN_MS) return;
      lastFeedFetchRef.current = Date.now();
      fetchWithAuthOrBare(`${API_BASE}/api/feed`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && !d.error) dispatch({ type: 'SET_FEED', payload: d }); })
        .catch(() => {});
    }, 60000);        const cleanupProfile = schedule(() => {
      if (Date.now() - lastProfileFetchRef.current < PROFILE_FETCH_COOLDOWN_MS) return;
      lastProfileFetchRef.current = Date.now();
      fetch(`${API_BASE}/api/users/${user.ID}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && !d.error) {
            dispatch({ type: 'SET_USER', payload: d });
            storeUser(d);
          }
        })
        .catch(() => {});
    }, 120000);

    return () => {
      mounted = false;
      cleanupChats();
      cleanupFeed();
      cleanupProfile();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.ID, dispatch]);

  // WebSocket management
  useEffect(() => {
    if (!user) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    let ws: WebSocket | null = null;
    const connect = () => {
      const sessionToken = getSessionToken();
      const wsUrl = sessionToken
        ? `${WS_BASE}?session=${sessionToken}`
        : `${WS_BASE}?uid=${user.ID}`;
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      const wsToken = sessionToken || user.ID;
      ws.onopen = () => {
        const send = (ev: string, payload: any) => {
          ws?.send(JSON.stringify({ Event: ev, Payload: payload, SessionToken: wsToken }));
        };
        send('GET_CHATS', {});
        send('GET_FEED', { Lat: coords?.lat || 0, Lon: coords?.lon || 0 });
        if (coords) {
          send('UPDATE_LOCATION', { Lat: coords.lat, Lon: coords.lon });
        }

        // Flush queued messages
        while (messageQueueRef.current.length > 0) {
          const queued = messageQueueRef.current.shift();
          if (queued) {
            send(queued.event, queued.payload);
          }
        }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          switch (data.Event) {
            case 'FEED_UPDATE':
              feedHydratedRef.current = true;
              dispatch({ type: 'SET_FEED', payload: data.Payload || [] });
              break;
            case 'CHATS_LIST':
              chatsHydratedRef.current = true;
              dispatch({ type: 'SET_CHATS', payload: data.Payload || [] });
              break;
            case 'PROFILE_UPDATED':
              dispatch({ type: 'SET_USER', payload: data.Payload });
              storeUser(data.Payload);
              break;
            case 'PARTY_CREATED':
              dispatch({ type: 'ADD_TO_FEED', payload: data.Payload });
              break;
            case 'REGISTRATIONS_LIST':
              dispatch({ type: 'SET_REGISTRATIONS', payload: data.Payload || [] });
              break;
            case 'DM_CREATED':
              if (navigate.current) navigate.current(`/chat/${data.Payload.ChatID}`);
              break;
            case 'NEW_MESSAGE':
              window.dispatchEvent(new CustomEvent('ws:new_message', { detail: data.Payload }));
              break;
          }
        } catch (e) {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setTimeout(() => {
          if (socketRef.current === ws) connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      ws?.close();
      socketRef.current = null;
    };
  }, [user?.ID]); // intentionally only reconnect on user change, not coords

  const sendSocketMessage = useCallback((event: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      const sessionToken = getSessionToken();
      socketRef.current.send(JSON.stringify({
        Event: event, Payload: payload, SessionToken: sessionToken,
      }));
    } else {
      const exists = messageQueueRef.current.some(
        m => m.event === event && JSON.stringify(m.payload) === JSON.stringify(payload)
      );
      if (!exists) {
        messageQueueRef.current.push({ event, payload });
      }
    }
  }, [user]);

  const initializeApp = useCallback((u: User, initialChats: ChatRoom[], initialFeed: Party[], coords?: { lat: number; lon: number } | null) => {
    dispatch({ type: 'SET_USER', payload: u });
    dispatch({ type: 'SET_CHATS', payload: initialChats });
    dispatch({ type: 'SET_FEED', payload: initialFeed });
    if (coords) dispatch({ type: 'SET_COORDS', payload: coords });
    storeUser(u);
  }, []);

  const login = useCallback((u: User) => {
    dispatch({ type: 'SET_USER', payload: u });
    storeUser(u);
    fastHTTPFetchAll(u.ID, dispatch);
  }, []);

  const saveProfile = useCallback((u: User) => {
    // Same as login but WITHOUT fastHTTPFetchAll — avoids race condition
    // where stale server data overwrites local edits.
    // The WebSocket PROFILE_UPDATED event will sync from server later.
    dispatch({ type: 'SET_USER', payload: u });
    storeUser(u);
  }, []);

  const logout = useCallback(() => {
    // Clear session on server
    const token = getSessionToken();
    if (token) {
      fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        headers: { 'x-session-token': token },
      }).catch(() => {});
    }
    clearSession();
    clearLocalDataCache();
    dispatch({ type: 'LOGOUT' });
    clearStoredUser();
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const removeFromFeed = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FROM_FEED', payload: id });
  }, []);

  const addLocalChat = useCallback((chat: ChatRoom) => {
    dispatch({ type: 'ADD_OR_UPDATE_CHAT', payload: chat });
  }, []);

  const removeChat = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CHAT', payload: id });
  }, []);

  return (
    <StoreContext.Provider value={{
      user, feed, chats, registrations, fetchedParties, coords, userCurrency,
      login, saveProfile, logout, sendSocketMessage, removeFromFeed,
      refreshLocation,      fetchPartyById, fetchMissingParties, fetchUserProfile, addLocalChat, removeChat, initializeApp,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
};
