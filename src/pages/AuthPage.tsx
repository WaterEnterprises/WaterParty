import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../lib/Store';
import { API_BASE, storeSessionToken, getSessionToken } from '../lib/constants';
import { Waves, Mail, Lock, User as UserIcon, PenTool, X, Plus, Loader, Crop, Camera, ImagePlus } from 'lucide-react';
import { compressImageForProfile, blobToBase64 } from '../lib/utils';
import { PhotoEditor } from '../components/PhotoEditor';
import { useCamera } from '../hooks/useCamera';
import type { ChatRoom, Party } from '../lib/types';

type LoadStage = 'auth' | 'data' | 'done';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [school, setSchool] = useState('');
  const [degree, setDegree] = useState('');

  const { initializeApp } = useStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState<LoadStage>('auth');
  const [loadMessage, setLoadMessage] = useState('');
  const { pickImage, takePhoto } = useCamera();
  const uploadFilesRef = useRef<Map<string, File>>(new Map());
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const profilePhotosRef = useRef(profilePhotos);
  profilePhotosRef.current = profilePhotos;

  const addCameraResult = useCallback(async (result: import('../hooks/useCamera').CameraImageResult) => {
    const remainingSlots = 9 - profilePhotos.length;
    if (remainingSlots <= 0) return;
    const file = result.file;
    try {
      const croppedBlob = await compressImageForProfile(file);
      const url = URL.createObjectURL(croppedBlob);
      const croppedFile = new File([croppedBlob], file.name || `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(url, croppedFile);
      setProfilePhotos(prev => {
        if (prev.length >= 9) { URL.revokeObjectURL(url); uploadFilesRef.current.delete(url); return prev; }
        return [...prev, url];
      });
    } catch (err) {
      console.error('Image crop failed, falling back:', err);
      const url = URL.createObjectURL(file);
      uploadFilesRef.current.set(url, file);
      setProfilePhotos(prev => {
        if (prev.length >= 9) { URL.revokeObjectURL(url); uploadFilesRef.current.delete(url); return prev; }
        return [...prev, url];
      });
    }
  }, [profilePhotos.length]);

  const handlePickFromGallery = useCallback(async () => {
    const results = await pickImage();
    for (const result of results) {
      await addCameraResult(result);
    }
    setShowPhotoActions(false);
  }, [pickImage, addCameraResult]);

  const handleTakePhoto = useCallback(async () => {
    const result = await takePhoto();
    if (result) {
      await addCameraResult(result);
    }
    setShowPhotoActions(false);
  }, [takePhoto, addCameraResult]);

  const handleStartEditing = useCallback((index: number) => setEditingPhotoIndex(index), []);
  const handleCropPhoto = useCallback(async (_blob: Blob, croppedUrl: string) => {
    if (editingPhotoIndex === null) return;
    const idx = editingPhotoIndex;
    const oldUrl = profilePhotosRef.current[idx];
    if (oldUrl?.startsWith('blob:')) {
      const oldFile = uploadFilesRef.current.get(oldUrl);
      uploadFilesRef.current.delete(oldUrl);
      URL.revokeObjectURL(oldUrl);
      if (oldFile) {
        const newFile = new File([_blob], oldFile.name || `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadFilesRef.current.set(croppedUrl, newFile);
      }
    } else {
      const newFile = new File([_blob], `cropped_auth_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(croppedUrl, newFile);
    }
    setProfilePhotos(prev => { const u = [...prev]; u[idx] = croppedUrl; return u; });
    setEditingPhotoIndex(null);
  }, [editingPhotoIndex]);

  const removePhoto = useCallback((index: number) => {
    setProfilePhotos(prev => {
      const removed = prev[index];
      if (removed?.startsWith('blob:')) { URL.revokeObjectURL(removed); uploadFilesRef.current.delete(removed); }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Quick GPS attempt — returns null if unavailable or denied (non-blocking)
  const tryGetCoords = (): Promise<{ lat: number; lon: number } | null> => {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password.length < 8) { setError('Password must be at least 8 characters long'); return; }
    if (!isLogin && profilePhotos.length === 0) { setError('Please upload at least 1 profile photo'); return; }
    if (!isLogin && jobTitle.length > 100) { setError('Job title must be 100 characters or less'); return; }
    if (!isLogin && company.length > 100) { setError('Company name must be 100 characters or less'); return; }
    if (!isLogin && school.length > 100) { setError('School name must be 100 characters or less'); return; }
    if (!isLogin && degree.length > 100) { setError('Degree must be 100 characters or less'); return; }

    setLoading(true);
    setLoadStage('auth');
    setLoadMessage('Authenticating...');

    const endpoint = isLogin ? '/login' : '/register';
    let body: any;
    if (isLogin) {
      body = { email, password };
    } else {
      // Convert photos to base64 data URIs (no session yet, so skip /api/upload)
      const photoDataUris = await Promise.all(
        profilePhotos.map(async (photo) => {
          if (photo.startsWith('blob:')) {
            const file = uploadFilesRef.current.get(photo);
            if (file) {
              try {
                const compressed = await compressImageForProfile(file);
                return await blobToBase64(compressed);
              } catch { return photo; }
            }
          } else if (photo.startsWith('data:') || photo.startsWith('media_')) {
            return photo;
          } else {
            try {
              const resp = await fetch(photo);
              const rawBlob = await resp.blob();
              const compressed = await compressImageForProfile(rawBlob);
              return await blobToBase64(compressed);
            } catch { return photo; }
          }
          return photo;
        })
      );
      // Try to get GPS coords for currency detection during registration
      const coords = await tryGetCoords();
      body = {
        password,
        user: { RealName: name, Email: email, ProfilePhotos: photoDataUris, Thumbnail: photoDataUris[0] || '', Bio: bio, Gender: gender, Birthday: birthday, Instagram: instagram, Twitter: twitter, JobTitle: jobTitle, Company: company, School: school, Degree: degree, ShowEmail: false },
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      clearTimeout(timeoutId);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(text || 'Request failed'); }
      if (!res.ok) throw new Error(data?.error || data?.message || 'Request failed');

      if (data.sessionId) storeSessionToken(data.sessionId);
      uploadFilesRef.current.forEach((_file, url) => URL.revokeObjectURL(url));
      uploadFilesRef.current.clear();
      const userData = data.user || data;

      setLoadStage('data');
      setLoadMessage('Loading your parties and messages...');
      const token = getSessionToken();
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders['x-session-token'] = token;
      const feedUrl = `${API_BASE}/api/feed`;
      const chatsController = new AbortController();
      const chatsTimeoutId = setTimeout(() => chatsController.abort(), 15000);
      const feedController = new AbortController();
      const feedTimeoutId = setTimeout(() => feedController.abort(), 15000);
      const [chatsRes, feedRes] = await Promise.all([
        fetch(`${API_BASE}/api/chats`, { headers: authHeaders, signal: chatsController.signal }).catch(() => null),
        fetch(feedUrl, { headers: authHeaders, signal: feedController.signal }).catch(() => null),
      ]);
      clearTimeout(chatsTimeoutId);
      clearTimeout(feedTimeoutId);
      const initialChats: ChatRoom[] = chatsRes?.ok ? await chatsRes.json().catch(() => []) : [];
      const initialFeed: Party[] = feedRes?.ok ? await feedRes.json().catch(() => []) : [];

      setLoadStage('done');
      setLoadMessage('Welcome!');
      await new Promise(r => setTimeout(r, 400));
      // Location is handled by SwipePage — skip it during auth
      initializeApp(userData, initialChats, initialFeed, null);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.');
      } else {
        setError(err.message);
      }
      setLoading(false);
      setLoadStage('auth');
    }
  };

  // ── Loading screen ──
  if (loading && loadStage !== 'auth') {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 text-text-primary absolute inset-0 z-[100] overflow-hidden bg-auth box-border pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))]">
        <div className="absolute inset-0 bg-auth/85 backdrop-blur-[10px] z-0" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/10 blur-[120px] pointer-events-none animate-pulse z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-secondary/10 blur-[120px] pointer-events-none animate-pulse z-0" />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-brand-accent to-brand-secondary blur-md opacity-60" />
            <img src="/icon.png" alt="WaterParty" className="relative w-20 h-20 rounded-2xl object-cover shadow-xl border border-border-default" />
          </div>
          <Loader size={32} className="text-brand-accent animate-spin" />
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-accent/20 border border-brand-accent">
                <Waves size={14} className="text-brand-accent" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-text-primary">Loading your experience</span>
            </div>
          </div>
          <p className="text-tiny font-bold text-text-muted tracking-wider uppercase animate-pulse">{loadMessage}</p>
        </div>
      </div>
    );
  }

  // ── Main auth form ──
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 text-text-primary absolute inset-0 z-[100] overflow-x-hidden overflow-y-auto bg-auth box-border pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))]">
      <div className="absolute inset-0 bg-auth/85 backdrop-blur-[10px] z-0" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/10 blur-[120px] pointer-events-none animate-pulse z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-secondary/10 blur-[120px] pointer-events-none animate-pulse z-0" />
      <div className="w-full max-w-md my-8 flex flex-col items-center relative z-10">
        <div className="flex flex-col items-center gap-3 mb-6 select-none animate-fadeIn">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-brand-accent to-brand-secondary blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            <img src="/icon.png" alt="WaterParty Icon" className="relative w-24 h-24 rounded-2xl object-cover hover:scale-105 transition-transform duration-300 shadow-xl border border-border-default"
              referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
            <div style={{ display: 'none' }} className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-brand-accent to-brand-secondary flex-col items-center justify-center shadow-lg border border-border-default">
              <Waves size={40} className="text-text-primary animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-[0.25em] uppercase text-text-primary drop-shadow-md">WaterParty</h1>
        </div>
        <div className={`w-full bg-card/90 backdrop-blur-2xl border border-border-default ${isLogin ? 'rounded-2xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]' : 'rounded-2xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]'} transition-all`}>
          <h2 className="text-nano font-black uppercase tracking-[0.25em] mb-4 text-center text-text-muted">{isLogin ? "Sign In" : "Registration Hub"}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="space-y-3 animate-fadeIn">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-nano font-black tracking-widest text-brand-accent uppercase">GALLERY PHOTOS (UP TO 9)</label>
                    <span className="text-nano font-bold text-text-faint">{profilePhotos.length}/9</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {profilePhotos.map((photo, index) => (
                      <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border-default bg-[#16192E] group cursor-pointer">
                        <img src={photo} alt="" className="w-full h-full object-cover animate-scaleUp" />
                        <div onClick={() => handleStartEditing(index)} className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                          <Crop size={18} className="text-text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100" />
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(index); }} className="absolute top-1 right-1 bg-black/80 w-4 h-4 rounded-full flex items-center justify-center text-text-primary hover:bg-black p-1 transition-colors z-10">
                          <X size={8} />
                        </button>
                        <div className="absolute bottom-1 left-1.5 bg-brand-accent/95 px-1 py-0.5 rounded-md text-2xs font-black text-overlay uppercase">{index === 0 ? 'MAIN' : `#${index + 1}`}</div>
                      </div>
                    ))}
                    {profilePhotos.length < 9 && (
                      <div onClick={() => setShowPhotoActions(true)} className="aspect-[3/4] rounded-xl border border-dashed border-brand-accent/30 bg-brand-accent/5 hover:bg-brand-accent/10 cursor-pointer text-brand-accent flex flex-col items-center justify-center transition-all active:scale-95">
                        <Camera size={16} className="animate-pulse" /><span className="text-2xs font-black tracking-widest uppercase mt-0.5">ADD</span>
                      </div>
                    )}
                  </div>
                  {/* Photo action sheet — compact inline row */}
                  {showPhotoActions && (
                    <>
                      <div className="fixed inset-0 z-50" onClick={() => setShowPhotoActions(false)} />
                      <div className="relative mt-1.5 z-50 bg-elevated backdrop-blur-xl border border-border-default rounded-lg shadow-2xl overflow-hidden">
                        <div className="flex">
                          <button
                            type="button"
                            onClick={handleTakePhoto}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 active:bg-glass-hover transition-all"
                          >
                            <Camera size={12} className="text-brand-accent" />
                            <span className="text-2xs font-bold text-text-primary uppercase tracking-wider">Camera</span>
                          </button>
                          <div className="w-px bg-glass-hover" />
                          <button
                            type="button"
                            onClick={handlePickFromGallery}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 active:bg-glass-hover transition-all"
                          >
                            <ImagePlus size={12} className="text-brand-accent" />
                            <span className="text-2xs font-bold text-text-primary uppercase tracking-wider">Gallery</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon size={14} className="text-text-faint" /></div>
                  <input type="text" required placeholder="FULL NAME" value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 pl-9 pr-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent focus:bg-glass-hover transition-all" autoComplete="name" />
                </div>
                <div className="relative">
                  <label className="text-nano font-black tracking-widest text-brand-accent uppercase block mb-1.5">BIRTHDAY</label>
                  <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                    className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 px-3 text-tiny font-bold text-text-primary outline-none focus:border-brand-accent focus:bg-glass-hover transition-all [color-scheme:dark]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-nano font-black tracking-widest text-brand-accent uppercase">SEX</label>
                  <div className="flex gap-2">
                    {['MALE', 'FEMALE', 'OTHER'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGender(option === gender ? '' : option)}
                        className={`flex-1 py-2 rounded-xl text-nano font-black tracking-widest uppercase border transition-all ${
                          gender === option
                            ? 'bg-brand-accent border-brand-accent text-overlay shadow-lg shadow-brand-accent/20'
                            : 'bg-glass border-border-default text-text-muted hover:bg-glass-hover'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute top-2.5 left-3 pointer-events-none"><PenTool size={12} className="text-text-faint" /></div>
                  <textarea placeholder="BIO (Tell us about your party vibe)" value={bio} onChange={e => setBio(e.target.value)}
                    className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 pl-9 pr-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent focus:bg-glass-hover transition-all min-h-[50px] resize-none leading-normal" />
                </div>                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-faint font-black text-micro uppercase tracking-widest">ig</div>
                      <input type="text" placeholder="INSTAGRAM" value={instagram} onChange={e => setInstagram(e.target.value)}
                        className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 pl-8 pr-2 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" />
                    </div>
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-faint font-black text-micro uppercase tracking-widest">x</div>
                      <input type="text" placeholder="TWITTER" value={twitter} onChange={e => setTwitter(e.target.value)}
                        className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 pl-8 pr-2 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="text-nano font-black tracking-widest text-brand-accent uppercase block mb-1.5">WORK</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type="text" placeholder="JOB TITLE" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                          className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 px-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" maxLength={100} />
                      </div>
                      <div className="relative flex-1">
                        <input type="text" placeholder="COMPANY" value={company} onChange={e => setCompany(e.target.value)}
                          className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 px-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" maxLength={100} />
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="text-nano font-black tracking-widest text-brand-accent uppercase block mb-1.5">EDUCATION</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type="text" placeholder="SCHOOL" value={school} onChange={e => setSchool(e.target.value)}
                          className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 px-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" maxLength={100} />
                      </div>
                      <div className="relative flex-1">
                        <input type="text" placeholder="DEGREE" value={degree} onChange={e => setDegree(e.target.value)}
                          className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 px-3 text-tiny font-bold placeholder:text-text-faint outline-none focus:border-brand-accent transition-all" maxLength={100} />
                      </div>
                    </div>
                  </div>
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={12} className="text-text-faint" /></div>
              <input type="text" required placeholder="EMAIL OR USERNAME" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 text-tiny font-bold pl-9 pr-3 placeholder:text-text-faint outline-none focus:border-brand-accent focus:bg-glass-hover transition-all" autoComplete="username" />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={12} className="text-text-faint" /></div>
              <input type="password" required placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-glass hover:bg-glass border border-border-default rounded-xl py-2 text-tiny font-bold pl-9 pr-3 placeholder:text-text-faint outline-none focus:border-brand-accent focus:bg-glass-hover transition-all"
                autoComplete={isLogin ? "current-password" : "new-password"} />
            </div>
            {error && <p className="text-brand-primary text-nano font-bold text-center mt-2 bg-brand-primary/5 py-1.5 px-2 rounded-lg border border-brand-primary/15 animate-shake">⚠️ {error}</p>}
            <button disabled={loading} type="submit"
              className="w-full mt-2 py-2 text-tiny tracking-[0.15em] rounded-xl bg-gradient-to-r from-brand-accent to-brand-secondary text-text-primary font-black uppercase shadow-md active:scale-95 hover:brightness-115 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none">
              {loading ? 'PROCESSING...' : (isLogin ? 'ENTER' : 'REGISTER')}
            </button>
          </form>
        </div>
        <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="mt-5 text-nano font-black tracking-widest text-text-muted uppercase hover:text-text-primary transition-colors duration-200">
          {isLogin ? "NO ACCOUNT? " : "ALREADY REGISTERED? "}<span className="text-brand-accent">{isLogin ? "CREATE ONE" : "SIGN IN"}</span>
        </button>
      </div>
      {editingPhotoIndex !== null && profilePhotos[editingPhotoIndex] && (
        <PhotoEditor isOpen={true} imageSrc={profilePhotos[editingPhotoIndex]} onClose={() => setEditingPhotoIndex(null)} onSave={handleCropPhoto} aspectRatio="9:16" />
      )}
    </div>
  );
}
