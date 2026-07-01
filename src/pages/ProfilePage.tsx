import { useState, useRef, useCallback, useEffect } from 'react';
import { User as UserIcon, Edit, Save, Camera, Crop, X, BarChart3, Wallet, ImagePlus, Loader, Sun, Moon, AlertTriangle, Trash2 } from 'lucide-react';
import { gsap } from '../lib/gsap';
import { ProfileDetails } from '../components/ProfileDetails';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PhotoEditor } from '../components/PhotoEditor';
import { useStore } from '../lib/Store';
import { getAssetUrl, API_BASE, getSessionToken } from '../lib/constants';
import { useNavigate } from 'react-router-dom';
import { cn, compressImageForProfile, uploadImage, useMediaQuery } from '../lib/utils';
import { useCamera } from '../hooks/useCamera';
import { useTheme } from '../lib/ThemeContext';




// ─── Main ProfilePage ──────────────────────────────────────────────────
export function ProfilePage() {
  const { user, logout, saveProfile, sendSocketMessage } = useStore();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [editData, setEditData] = useState({
    RealName: '', Bio: '', Thumbnail: '', ProfilePhotos: [] as string[],
    Instagram: '', Twitter: '', VK: '', Telegram: '', WhatsApp: '', Facebook: '',
    Gender: '', Birthday: '', JobTitle: '', Company: '', School: '', Degree: '', ShowEmail: false
  });
  const { pickImage, takePhoto } = useCamera();
  const uploadFilesRef = useRef<Map<string, File>>(new Map());
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const isLandscape = useMediaQuery('(orientation: landscape) and (min-width: 768px)');
  const { theme, toggle } = useTheme();

  // Stable callbacks for memoized children
  const handleEditClick = useCallback(() => {
    setValidationErrors({});
    setEditData({
      RealName: user.RealName || '', Bio: user.Bio || '',
      Thumbnail: user.Thumbnail || (user.ProfilePhotos?.length > 0 ? user.ProfilePhotos[0] : ''),
      ProfilePhotos: user.ProfilePhotos || [],
      Instagram: user.Instagram || '', Twitter: user.Twitter || '',
      VK: user.VK || '', Telegram: user.Telegram || '', WhatsApp: user.WhatsApp || '', Facebook: user.Facebook || '',
      Gender: user.Gender ? user.Gender.charAt(0).toUpperCase() + user.Gender.slice(1).toLowerCase() : '',
      Birthday: user.Birthday || '', JobTitle: user.JobTitle || '',
      Company: user.Company || '', School: user.School || '', Degree: user.Degree || '',
      ShowEmail: user.ShowEmail ?? false
    });
    setIsEditing(true);
  }, [user.RealName, user.Bio, user.Thumbnail, user.ProfilePhotos,
      user.Instagram, user.Twitter, user.VK, user.Telegram, user.WhatsApp, user.Facebook,
      user.Gender, user.Birthday, user.JobTitle, user.Company, user.School, user.Degree, user.ShowEmail]);

  const handleLogout = useCallback(() => logout(), [logout]);

  const handleCancelEdit = useCallback(() => {
    setValidationErrors({});
    setIsEditing(false);
  }, []);

  const validateForm = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const name = (editData.RealName || '').trim();
    if (!name || name.length < 2) errors.RealName = 'Full name must be at least 2 characters';
    if (editData.Bio && editData.Bio.length > 500) errors.Bio = 'Bio must be 500 characters or less';
    if (editData.Birthday && !/^\d{4}-\d{2}-\d{2}$/.test(editData.Birthday)) errors.Birthday = 'Use YYYY-MM-DD format';
    if (editData.Gender && !['Male', 'Female', 'Other'].includes(editData.Gender)) errors.Gender = 'Select Male, Female, or Other';
    if (editData.Instagram && editData.Instagram.length > 100) errors.Instagram = 'Max 100 characters';
    if (editData.Twitter && editData.Twitter.length > 100) errors.Twitter = 'Max 100 characters';
    if (editData.VK && editData.VK.length > 100) errors.VK = 'Max 100 characters';
    if (editData.Telegram && editData.Telegram.length > 100) errors.Telegram = 'Max 100 characters';
    if (editData.WhatsApp) {
      const digitsOnly = editData.WhatsApp.replace(/[^0-9]/g, '');
      if (digitsOnly.length < 7) errors.WhatsApp = 'Phone number too short (min 7 digits)';
      else if (digitsOnly.length > 15) errors.WhatsApp = 'Phone number too long (max 15 digits)';
      else if (editData.WhatsApp.length > 100) errors.WhatsApp = 'Max 100 characters';
    }
    if (editData.Facebook && editData.Facebook.length > 100) errors.Facebook = 'Max 100 characters';
    if (editData.JobTitle && editData.JobTitle.length > 100) errors.JobTitle = 'Max 100 characters';
    if (editData.Company && editData.Company.length > 100) errors.Company = 'Max 100 characters';
    if (editData.School && editData.School.length > 100) errors.School = 'Max 100 characters';
    if (editData.Degree && editData.Degree.length > 100) errors.Degree = 'Max 100 characters';
    return errors;
  }, [editData]);

  // Wrapper that validates then saves
  const handleSaveClick = async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await handleSave();
    } catch (err) {
      console.error('Save failed:', err);
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`${API_BASE}/api/account`, {
        method: 'DELETE',
        headers: {
          'x-session-token': token || '',
        },
      });
      if (res.ok) {
        logout();
        navigate('/');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete account');
      }
    } catch (e) {
      console.error('Delete account failed:', e);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    const cleanHandle = (handle: string) => {
      if (!handle) return '';
      let h = handle.trim().replace(/^@/, '');
      if (h.includes('instagram.com/')) h = h.split('instagram.com/')[1].split('/')[0].split('?')[0];
      if (h.includes('twitter.com/')) h = h.split('twitter.com/')[1].split('/')[0].split('?')[0];
      if (h.includes('x.com/')) h = h.split('x.com/')[1].split('/')[0].split('?')[0];
      if (h.includes('vk.com/')) h = h.split('vk.com/')[1].split('/')[0].split('?')[0];
      if (h.includes('t.me/')) h = h.split('t.me/')[1].split('/')[0].split('?')[0];
      if (h.includes('wa.me/')) h = h.split('wa.me/')[1].split('/')[0].split('?')[0];
      if (h.includes('facebook.com/')) h = h.split('facebook.com/')[1].split('/')[0].split('?')[0];
      return h;
    };



    const uploadedPhotos = await Promise.all(
      editData.ProfilePhotos.map(async (photo, idx) => {
        if (photo.startsWith('media_')) return photo;
        if (photo.startsWith('blob:')) {
          const file = uploadFilesRef.current.get(photo);
          if (file) {
            try {
              const compressedBlob = await compressImageForProfile(file);
              return await uploadImage(compressedBlob, undefined, `profile_${idx}_${Date.now()}`);
            } catch { return photo; }
          }
          return photo;
        }
        try {
          const resp = await fetch(photo);
          const rawBlob = await resp.blob();
          const croppedBlob = await compressImageForProfile(rawBlob);
          return await uploadImage(croppedBlob, undefined, `profile_url_${idx}_${Date.now()}`);
        } catch { return photo; }
      })
    );

    uploadFilesRef.current.forEach((_file, url) => URL.revokeObjectURL(url));
    uploadFilesRef.current.clear();

    const validatedData = {
      ...user, ...editData,
      ProfilePhotos: uploadedPhotos,
      Instagram: cleanHandle(editData.Instagram),
      Twitter: cleanHandle(editData.Twitter),
      VK: cleanHandle(editData.VK),
      Telegram: cleanHandle(editData.Telegram),
      WhatsApp: editData.WhatsApp.trim(),
      Facebook: cleanHandle(editData.Facebook),
      ShowEmail: !!editData.ShowEmail,
      Thumbnail: uploadedPhotos.length > 0 ? uploadedPhotos[0] : ''
    };
    saveProfile(validatedData);
    sendSocketMessage('UPDATE_PROFILE', validatedData);
    // Brief pause so user can see the saved confirmation before closing edit mode
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setIsEditing(false);
  };

  const addCameraResult = useCallback(async (result: import('../hooks/useCamera').CameraImageResult) => {
    const remainingSlots = 9 - editData.ProfilePhotos.length;
    if (remainingSlots <= 0) return;
    const file = result.file;
    try {
      const croppedBlob = await compressImageForProfile(file);
      const url = URL.createObjectURL(croppedBlob);
      const croppedFile = new File([croppedBlob], file.name || `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(url, croppedFile);
      setEditData(prev => {
        if (prev.ProfilePhotos.length >= 9) {
          URL.revokeObjectURL(url);
          uploadFilesRef.current.delete(url);
          return prev;
        }
        return { ...prev, ProfilePhotos: [...prev.ProfilePhotos, url] };
      });
    } catch (err) {
      console.error('Image crop failed, falling back:', err);
      const url = URL.createObjectURL(file);
      uploadFilesRef.current.set(url, file);
      setEditData(prev => {
        if (prev.ProfilePhotos.length >= 9) {
          URL.revokeObjectURL(url);
          uploadFilesRef.current.delete(url);
          return prev;
        }
        return { ...prev, ProfilePhotos: [...prev.ProfilePhotos, url] };
      });
    }
  }, [editData.ProfilePhotos.length]);

  const handlePickFromGallery = useCallback(async () => {
    const results = await pickImage();
    for (const result of results) {
      await addCameraResult(result);
    }
    setShowPhotoActions(false);
  }, [pickImage, addCameraResult]);

  const handleTakePhoto = useCallback(async () => {
    const result = await takePhoto();
    if (result) await addCameraResult(result);
    setShowPhotoActions(false);
  }, [takePhoto, addCameraResult]);

  const handlePhotoEdit = (index: number) => setEditingPhotoIndex(index);

  const handleCropPhoto = async (_blob: Blob, croppedUrl: string) => {
    if (editingPhotoIndex === null) return;
    const idx = editingPhotoIndex;
    const oldUrl = editData.ProfilePhotos[idx];

    if (oldUrl?.startsWith('blob:')) {
      const oldFile = uploadFilesRef.current.get(oldUrl);
      uploadFilesRef.current.delete(oldUrl);
      URL.revokeObjectURL(oldUrl);
      if (oldFile) {
        const newFile = new File([_blob], oldFile.name || `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadFilesRef.current.set(croppedUrl, newFile);
      }
    } else {
      const newFile = new File([_blob], `cropped_profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(croppedUrl, newFile);
    }

    setEditData(prev => {
      const updated = [...prev.ProfilePhotos];
      updated[idx] = croppedUrl;
      return { ...prev, ProfilePhotos: updated };
    });
    setEditingPhotoIndex(null);
  };

  const removePhoto = (index: number) => {
    setEditData(prev => {
      const removed = prev.ProfilePhotos[index];
      if (removed?.startsWith('blob:')) {
        URL.revokeObjectURL(removed);
        uploadFilesRef.current.delete(removed);
      }
      return { ...prev, ProfilePhotos: prev.ProfilePhotos.filter((_, i) => i !== index) };
    });
    if (currentPhotoIndex >= editData.ProfilePhotos.length - 1) {
      setCurrentPhotoIndex(0);
    }
  };

  return (
    <div className="h-full w-full bg-transparent flex flex-col overflow-y-auto pb-24">
      {isEditing ? (
        <>
          <PhotoCarousel
            photos={editData.ProfilePhotos}
            currentIndex={currentPhotoIndex}
            onIndexChange={setCurrentPhotoIndex}
            isLandscape={isLandscape}
            contain
            dotVariant="profile"
            trustScore={user.TrustScore}
            showArrows
            clickToNavigate
          />
          <div className="px-6 -mt-4 relative z-10 space-y-8 pb-24">
            <div className="space-y-4 mb-6">
              {/* General Validation Error Banner */}
              {Object.keys(validationErrors).length > 0 && (
                <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl px-4 py-3">
                  <p className="text-nano font-bold text-brand-primary text-center">Please fix the errors below before saving</p>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Full Name</label>
                <input type="text" value={editData.RealName}
                  onChange={(e) => setEditData({...editData, RealName: e.target.value})}
                  className={cn("w-full bg-card border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none transition-colors", validationErrors.RealName ? "border-brand-primary" : "border-border-default focus:border-brand-primary")} />
                {validationErrors.RealName && <p className="text-nano font-bold text-brand-primary mt-1">{validationErrors.RealName}</p>}
              </div>

              {/* Photo Gallery Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-muted tracking-wider uppercase block">Manage Gallery</label>
                  <span className="text-xs font-bold text-text-faint">{editData.ProfilePhotos.length}/9</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {editData.ProfilePhotos.map((photo, index) => (
                    <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden group cursor-pointer">
                      <img src={getAssetUrl(photo)} alt="" className="w-full h-full object-cover" />
                      <div onClick={() => handlePhotoEdit(index)}
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center z-10">
                        <Crop size={18} className="text-text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100" />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                        className="absolute top-1 right-1 bg-black/60 w-6 h-6 rounded-full flex items-center justify-center text-text-primary p-1 hover:bg-black z-20">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {editData.ProfilePhotos.length < 9 && (
                    <button onClick={() => setShowPhotoActions(true)}
                      className="aspect-[3/4] rounded-xl border border-dashed border-border-strong bg-card flex items-center justify-center hover:bg-glass transition-colors">
                      <Camera size={20} className="text-text-faint" />
                    </button>
                  )}
                </div>
                {/* Photo action sheet — inline below grid like AuthPage */}
                {showPhotoActions && (
                  <>
                    <div className="fixed inset-0 z-50" onClick={() => setShowPhotoActions(false)} />
                    <div className="relative z-50 bg-elevated backdrop-blur-xl border border-border-default rounded-lg shadow-2xl overflow-hidden">
                      <div className="flex">
                        <button
                          type="button"
                          onClick={handleTakePhoto}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 active:bg-glass-hover transition-all"
                        >
                          <Camera size={12} className="text-brand-accent" />
                          <span className="text-micro font-bold text-text-primary uppercase tracking-wider">Camera</span>
                        </button>
                        <div className="w-px bg-glass-hover" />
                        <button
                          type="button"
                          onClick={handlePickFromGallery}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 active:bg-glass-hover transition-all"
                        >
                          <ImagePlus size={12} className="text-brand-accent" />
                          <span className="text-micro font-bold text-text-primary uppercase tracking-wider">Gallery</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Bio</label>
                <textarea value={editData.Bio}
                  onChange={(e) => setEditData({...editData, Bio: e.target.value})}
                  className={cn("w-full bg-card border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none transition-colors min-h-[100px]", validationErrors.Bio ? "border-brand-primary" : "border-border-default focus:border-brand-primary")} />
                {validationErrors.Bio && <p className="text-nano font-bold text-brand-primary mt-1">{validationErrors.Bio}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Birthday</label>
                <input type="date" value={editData.Birthday}
                  onChange={(e) => setEditData({...editData, Birthday: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Gender</label>
                <select value={editData.Gender}
                  onChange={(e) => setEditData({...editData, Gender: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors appearance-none">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                {/* Show Email Toggle */}
                <div className="flex items-center justify-between bg-card border border-border-default rounded-xl px-4 py-3 mb-4">
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider uppercase block">Show Email on Profile</label>
                    <p className="text-nano text-text-faint mt-0.5">Display your email address publicly</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditData({...editData, ShowEmail: !editData.ShowEmail})}
                    className={cn("w-12 h-7 rounded-full transition-colors duration-200 relative shrink-0", editData.ShowEmail ? "bg-brand-accent" : "bg-glass border border-border-default")}
                  >
                    <div className={cn("w-5 h-5 rounded-full bg-white absolute top-1 transition-transform duration-200", editData.ShowEmail ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Social Links</label>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Instagram</label>
                    <input type="text" value={editData.Instagram}
                      onChange={(e) => setEditData({...editData, Instagram: e.target.value})}
                      className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">X (Twitter)</label>
                    <input type="text" value={editData.Twitter}
                      onChange={(e) => setEditData({...editData, Twitter: e.target.value})}
                      className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">VK</label>
                    <input type="text" value={editData.VK}
                      onChange={(e) => setEditData({...editData, VK: e.target.value})}
                      className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Telegram</label>
                    <input type="text" value={editData.Telegram}
                      onChange={(e) => setEditData({...editData, Telegram: e.target.value})}
                      className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">WhatsApp</label>
                    <input type="tel" value={editData.WhatsApp}
                      onChange={(e) => setEditData({...editData, WhatsApp: e.target.value})}
                      className={cn("w-full bg-card border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-faint focus:outline-none transition-colors", validationErrors.WhatsApp ? "border-brand-primary" : "border-border-default focus:border-brand-primary")}
                      placeholder="+1 (555) 123-4567" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Facebook</label>
                    <input type="text" value={editData.Facebook}
                      onChange={(e) => setEditData({...editData, Facebook: e.target.value})}
                      className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Job Title</label>
                <input type="text" value={editData.JobTitle}
                  onChange={(e) => setEditData({...editData, JobTitle: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Company</label>
                <input type="text" value={editData.Company}
                  onChange={(e) => setEditData({...editData, Company: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">School</label>
                <input type="text" value={editData.School}
                  onChange={(e) => setEditData({...editData, School: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted tracking-wider mb-2 uppercase block">Degree</label>
                <input type="text" value={editData.Degree}
                  onChange={(e) => setEditData({...editData, Degree: e.target.value})}
                  className="w-full bg-card border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors" />
              </div>

              <div className="flex gap-4">
                <button onClick={handleCancelEdit} disabled={saving} className="flex-[0.3] py-4 bg-glass border border-border-default rounded-full text-text-primary font-bold text-base tracking-wide active:scale-95 transition-transform flex items-center justify-center disabled:opacity-30">
                  <X size={20} />
                </button>
                <button onClick={handleSaveClick} disabled={saving} className="flex-1 py-4 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary font-bold text-base tracking-wide shadow-lg shadow-brand-secondary/20 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader size={18} className="animate-spin" /> SAVING...</> : <><Save size={18} /> SAVE CHANGES</>}
                </button>
              </div>

              {/* Delete Account Section */}
              <div className="border-t border-border-default pt-6 mt-8">
                <p className="text-nano font-black text-text-faint tracking-[0.2em] mb-3 uppercase hover:text-red-400 transition-colors duration-150">Danger Zone</p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  DELETE ACCOUNT
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <ProfileDetails
          user={user}
          photos={user.ProfilePhotos || []}
          currentPhotoIndex={currentPhotoIndex}
          onPhotoIndexChange={setCurrentPhotoIndex}
          trustScore={user.TrustScore}
          showPhotoArrows
          actions={
            <div className="flex flex-col items-center w-full pt-4">
              <button onClick={() => navigate('/wallet')} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-text-primary text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2 mb-3 max-w-sm">
                <Wallet size={14} /> WALLET
              </button>
              <button onClick={handleEditClick} className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-secondary/20 active:scale-95 transition-transform flex items-center justify-center gap-2 max-w-sm">
                <Edit size={14} /> EDIT PROFILE
              </button>
              <div className="flex gap-3 mt-2 w-full max-w-sm">
                <button onClick={handleLogout} className="flex-1 py-3 bg-card border border-border-default rounded-xl text-brand-primary text-tiny font-black uppercase tracking-widest hover:bg-glass transition-colors">
                  LOGOUT
                </button>
              </div>
              <div className="mt-4 space-y-2 w-full max-w-sm">
                <button onClick={toggle} className="w-full py-3 bg-card border border-border-default rounded-xl text-tiny font-black uppercase tracking-widest hover:bg-glass transition-colors flex items-center justify-center gap-2">
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
                </button>
                {user.IsAdmin && (
                  <button onClick={() => navigate('/admin')} className="w-full py-3 bg-card border border-border-default rounded-xl text-tiny font-black uppercase tracking-widest hover:bg-glass transition-colors flex items-center justify-center gap-2 text-brand-accent">
                    <BarChart3 size={14} />
                    ADMIN DASHBOARD
                  </button>
                )}
              </div>
            </div>
          }
        />
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="bg-elevated backdrop-blur-xl border border-border-default rounded-2xl shadow-2xl max-w-sm w-full p-6"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <AlertTriangle size={28} className="text-red-400" />
                </div>
                <h2 className="text-lg font-black text-text-primary mb-2">Delete Account?</h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  This will permanently delete your profile, messages, parties, and all associated data. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-3 bg-glass border border-border-default rounded-xl text-text-primary text-xs font-black uppercase tracking-widest hover:bg-glass-hover transition-colors disabled:opacity-30"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-600/30"
                >
                  {deleting ? <><Loader size={16} className="animate-spin" /> DELETING...</> : <><Trash2 size={16} /> DELETE</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Photo Editor Modal */}
      {editingPhotoIndex !== null && editData.ProfilePhotos[editingPhotoIndex] && (
        <PhotoEditor
          isOpen={true}
          imageSrc={getAssetUrl(editData.ProfilePhotos[editingPhotoIndex])}
          onClose={() => setEditingPhotoIndex(null)}
          onSave={handleCropPhoto}
          aspectRatio="9:16"
        />
      )}
    </div>
  );
}
