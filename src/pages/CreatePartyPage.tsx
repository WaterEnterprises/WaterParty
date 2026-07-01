import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Shield, Wallet, FileText, MapPin, Calendar, Clock, Hourglass, Check, X, Sparkles, Map as MapIcon, Globe, Loader2, Search, ImagePlus, Crop } from 'lucide-react';
import { gsap } from '../lib/gsap';
import { cn, compressImageForProfile, uploadImage } from '../lib/utils';
import { PhotoEditor } from '../components/PhotoEditor';
import { useStore } from '../lib/Store';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useCamera } from '../hooks/useCamera';
import { isCapacitorNative } from '../lib/capacitor';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  useEffect(() => {
    if (position) {
       map.flyTo(position, 14);
    }
  }, [position, map]);
  return position === null ? null : (
    <Marker position={position} />
  );
}

export function CreatePartyPage() {
  const { sendSocketMessage, coords, refreshLocation, userCurrency } = useStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestLimit, setGuestLimit] = useState(50);
  const [duration, setDuration] = useState(4);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [partyType, setPartyType] = useState('');
  const [customType, setCustomType] = useState('');
  const [partyPhotos, setPartyPhotos] = useState<string[]>([]);
  const [partyDate, setPartyDate] = useState('');
  const [partyTime, setPartyTime] = useState('');
  const [crowdfundTarget, setCrowdfundTarget] = useState(0);
  const currencySymbol = (c: string) => {
    switch (c.toUpperCase()) {
      case "BRL": return "R$";
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      default: return "$";
    }
  };
  const [crowdfundCurrency, setCrowdfundCurrency] = useState(userCurrency);

  // Sync crowdfund currency when store's detected currency becomes available
  useEffect(() => {
    setCrowdfundCurrency(userCurrency);
  }, [userCurrency]);

  const [showWalletInput, setShowWalletInput] = useState(false);
  const [mapPosition, setMapPosition] = useState<L.LatLng | null>(
    coords ? new L.LatLng(coords.lat, coords.lon) : null
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const { pickImage, takePhoto } = useCamera();
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const uploadFilesRef = useRef<Map<string, File>>(new Map());

  const validate = () => {
    const errs: string[] = [];
    if (!title.trim() || title.length < 3) errs.push("Title must be at least 3 chars");
    if (!description.trim() || description.length < 10) errs.push("Description must be at least 10 chars");
    if (!partyDate) errs.push("Date is required");
    if (!partyTime) errs.push("Time is required");
    if (!city.trim()) errs.push("City is required");
    if (!address.trim()) errs.push("Full address is required");
    if (partyPhotos.length === 0) errs.push("At least one photo is required");
    if (!partyType.trim()) errs.push("Party vibe type is required");
    if (partyType === 'OTHER' && !customType.trim()) errs.push("Custom vibe type is required");
    if (duration > 6) errs.push("Max duration is 6 hours");
    if (!mapPosition) errs.push("Please pick a location on the map");
    setErrors(errs);
    return errs.length === 0;
  };

  const handlePublish = async () => {
     if (isSubmitting) return;
     if (!validate()) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
     }
     setIsSubmitting(true);
     setErrors([]);
     const finalPartyType = partyType === 'OTHER' ? customType : partyType;
     const startTime = new Date(`${partyDate}T${partyTime}`).toISOString();
     try {
       // Step 1: Compress all blobs sequentially (with yields) to avoid freezing
       const compressedBlobs: Array<{ blob: Blob; idx: number } | string> = [];
       for (let i = 0; i < partyPhotos.length; i++) {
         const photo = partyPhotos[i];
         if (photo.startsWith('media_')) {
           compressedBlobs.push(photo);
         } else if (photo.startsWith('blob:')) {
           const file = uploadFilesRef.current.get(photo);
           if (file) {
             try {
               const compressedBlob = await compressImageForProfile(file);
               compressedBlobs.push({ blob: compressedBlob, idx: i });
             } catch {
               compressedBlobs.push(photo);
             }
           } else {
             compressedBlobs.push(photo);
           }
         } else {
           compressedBlobs.push(photo);
         }
         // Yield every 2 photos to let the UI stay responsive
         if (i > 0 && i % 2 === 0) {
           await new Promise(r => setTimeout(r, 0));
         }
       }
       // Step 2: Upload all compressed blobs in parallel
       const uploadedPhotos = await Promise.all(
         compressedBlobs.map(async (item) => {
           if (typeof item === 'string') return item;
           return await uploadImage(item.blob, undefined, `party_${Date.now()}_${item.idx}`);
         })
       );
       uploadFilesRef.current.forEach((_file, url) => URL.revokeObjectURL(url));
       uploadFilesRef.current.clear();
       const chatRoomId = `room_${Date.now()}`;

       sendSocketMessage('CREATE_PARTY', {
           Boost: false,
           Title: title,
           Description: description,
           StartTime: startTime,
           DurationHours: Number(duration),
           Address: address,
           City: city,
           MaxCapacity: Number(guestLimit),
           PartyPhotos: uploadedPhotos,
            PartyType: finalPartyType,
            CrowdfundTarget: crowdfundTarget,
            CrowdfundCurrency: crowdfundCurrency,
           GeoLat: mapPosition?.lat || 0,
           GeoLon: mapPosition?.lng || 0,
           ChatRoomID: chatRoomId
       });
       setSuccess(true);
       setTimeout(() => {
          navigate(`/chat/${chatRoomId}`);
       }, 1500);
     } catch (err) {
       setErrors(['Failed to create party. Please try again.']);
       setIsSubmitting(false);
     }
  };

  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data.address) {
        setCity(data.address.city || data.address.town || data.address.village || data.address.municipality || '');
        setAddress(data.display_name);
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
  };

  const fetchCurrentLocation = async () => {
    setIsLocating(true);
    const fallbackToDefault = () => {
      if (coords) {
        setMapPosition(new L.LatLng(coords.lat, coords.lon));
      } else {
        setMapPosition(new L.LatLng(40.7128, -74.0060));
      }
      setIsLocating(false);
    };
    try {
      if (!isCapacitorNative()) {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
              setMapPosition(newPos);
              setIsLocating(false);
            },
            (err) => {
              console.warn("Browser geolocation disabled or blocked:", err);
              fallbackToDefault();
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        } else {
          fallbackToDefault();
        }
      } else {
        try {
          await Geolocation.requestPermissions();
          const pos = await Geolocation.getCurrentPosition();
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setMapPosition(newPos);
          setIsLocating(false);
        } catch (mobileErr) {
          console.warn("Capacitor geolocation failed:", mobileErr);
          fallbackToDefault();
        }
      }
    } catch (e) {
      console.warn("Location permission denied or unavailable:", e);
      fallbackToDefault();
    }
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const newPos = new L.LatLng(parseFloat(item.lat), parseFloat(item.lon));
        setMapPosition(newPos);
        if (item.display_name) {
          setAddress(item.display_name);
          const addr = item.address || {};
          const parsedCity = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
          if (parsedCity) {
            setCity(parsedCity);
          } else {
            const parts = item.display_name.split(',');
            if (parts.length > 0) {
              setCity(parts[0].trim());
            }
          }
        }
      }
    } catch (e) {
      console.error("Geocoding query failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => { fetchCurrentLocation(); }, []);
  useEffect(() => { if (mapPosition) handleReverseGeocode(mapPosition.lat, mapPosition.lng); }, [mapPosition]);

  const addCameraResult = useCallback(async (result: import('../hooks/useCamera').CameraImageResult) => {
    const remainingSlots = 16 - partyPhotos.length;
    if (remainingSlots <= 0) return;
    const file = result.file;
    try {
      const compressedBlob = await compressImageForProfile(file);
      const url = URL.createObjectURL(compressedBlob);
      const compressedFile = new File([compressedBlob], file.name || `party_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(url, compressedFile);
      setPartyPhotos(prev => {
        if (prev.length >= 16) { URL.revokeObjectURL(url); uploadFilesRef.current.delete(url); return prev; }
        return [...prev, url];
      });
    } catch (err) {
      console.error('Image compression failed, falling back:', err);
      const url = URL.createObjectURL(file);
      uploadFilesRef.current.set(url, file);
      setPartyPhotos(prev => {
        if (prev.length >= 16) { URL.revokeObjectURL(url); uploadFilesRef.current.delete(url); return prev; }
        return [...prev, url];
      });
    }
  }, [partyPhotos.length]);

  const handlePickFromGallery = useCallback(async () => {
    setShowPhotoActions(false);
    setIsProcessingPhotos(true);
    try {
      const results = await pickImage({ multiple: true });
      // Small yield so the loading state renders before heavy compression starts
      await new Promise(r => setTimeout(r, 50));
      // Process sequentially (with yields) to maintain upload order in the grid
      for (const result of results) {
        await addCameraResult(result);
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      setIsProcessingPhotos(false);
    }
  }, [pickImage, addCameraResult]);

  const handleTakePhoto = useCallback(async () => {
    const result = await takePhoto();
    if (result) await addCameraResult(result);
    setShowPhotoActions(false);
  }, [takePhoto, addCameraResult]);

  const handleCropPhoto = useCallback((_blob: Blob, croppedUrl: string) => {
    if (editingPhotoIndex === null) return;
    const idx = editingPhotoIndex;
    const oldUrl = partyPhotos[idx];
    if (oldUrl?.startsWith('blob:')) {
      const oldFile = uploadFilesRef.current.get(oldUrl);
      uploadFilesRef.current.delete(oldUrl);
      URL.revokeObjectURL(oldUrl);
      if (oldFile) {
        const newFile = new File([_blob], oldFile.name || `cropped_party_${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadFilesRef.current.set(croppedUrl, newFile);
      }
    } else {
      const newFile = new File([_blob], `cropped_party_${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFilesRef.current.set(croppedUrl, newFile);
    }
    setPartyPhotos(prev => { const u = [...prev]; u[idx] = croppedUrl; return u; });
    setEditingPhotoIndex(null);
  }, [editingPhotoIndex]);

  const removePhoto = (index: number) => {
    setPartyPhotos(prev => {
      const removed = prev[index];
      if (removed?.startsWith('blob:')) { URL.revokeObjectURL(removed); uploadFilesRef.current.delete(removed); }
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="h-full w-full bg-transparent flex flex-col overflow-y-auto py-6 scrollbar-hide pb-28">
      <div className="w-full px-3 flex flex-col">

        {/* TILE HEADER */}
        <div className="mb-4">
          <div className="bg-card border border-border-default rounded-2xl p-4 relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-[40px] -mr-16 -mt-16" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                <Sparkles className="text-text-primary" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-black text-text-primary tracking-widest uppercase mb-0.5">HOST PARTY</h2>
                <p className="text-micro font-bold text-text-faint tracking-[0.15em] uppercase">Set the frequency of the night</p>
              </div>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {errors.map((e, idx) => <p key={idx} className="text-tiny text-red-500 font-bold uppercase tracking-wider mb-0.5">• {e}</p>)}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-brand-accent/10 border border-brand-accent/20 rounded-xl p-4 text-center">
            <div className="w-10 h-10 bg-brand-accent rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-brand-accent/20">
              <Check className="text-overlay" size={20} />
            </div>
            <p className="text-xs font-black text-text-primary tracking-widest uppercase">Party Created!</p>
            <p className="text-micro font-bold text-text-muted uppercase mt-0.5">Redirecting to feed...</p>
          </div>
        )}

        <div className="space-y-4">

          {/* GALLERY AT THE TOP */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-2.5 bg-brand-accent rounded-full" />
                <h3 className="text-nano font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Gallery</h3>
              </div>
              <span className="text-micro font-black text-text-faint tracking-widest">{partyPhotos.length}/16</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {partyPhotos.map((photo, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden group shadow-sm border border-border-default cursor-pointer"
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <div
                    onClick={() => setEditingPhotoIndex(index)}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center"
                  >
                    <Crop size={18} className="text-text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                    className="absolute top-0.5 right-0.5 bg-black/70 backdrop-blur-md w-4 h-4 rounded-full flex items-center justify-center text-text-primary hover:bg-red-500 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </div>
              ))}
              {partyPhotos.length < 16 && (
                <button
                  type="button"
                  disabled={isProcessingPhotos}
                  onClick={() => setShowPhotoActions(true)}
                  className="aspect-square bg-card/90 border border-dashed border-border-default rounded-lg flex items-center justify-center flex-col gap-1 hover:bg-glass hover:border-brand-accent/20 transition-all group disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isProcessingPhotos ? (
                    <>
                      <Loader2 size={14} className="text-brand-accent animate-spin" />
                      <span className="text-2xs font-black text-brand-accent uppercase tracking-widest mt-0.5">Loading...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 bg-glass rounded-md flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Camera size={12} className="text-text-faint group-hover:text-brand-accent transition-colors" />
                      </div>
                      <span className="text-2xs font-black text-text-faint uppercase tracking-widest">Add</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {showPhotoActions && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowPhotoActions(false)} />
                <div className="relative z-50 bg-elevated backdrop-blur-xl border border-border-default rounded-lg shadow-2xl overflow-hidden">
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
          </section>

          {/* DETAILS */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-brand-accent rounded-full" />
              <h3 className="text-tiny font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Core Details</h3>
            </div>
            <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
              <div className="relative">
                <input type="text" placeholder="PARTY TITLE" value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-border-default py-1.5 outline-none text-base font-black text-text-primary placeholder:text-text-faint tracking-tight focus:border-brand-accent transition-colors uppercase" />
              </div>
              <div className="flex gap-3">
                <FileText size={16} className="text-brand-accent shrink-0 mt-0.5" />
                <textarea placeholder="WHAT IS THE VIBE? DESCRIBE THE NIGHT..." value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs text-text-bright placeholder:text-text-faint min-h-[60px] resize-none leading-relaxed" />
              </div>
            </div>
          </section>

          {/* LOGISTICS */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-brand-accent rounded-full" />
              <h3 className="text-tiny font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Logistics</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-card border border-border-default rounded-2xl p-3.5">
                <Calendar size={14} className="text-brand-accent mb-2" />
                <label className="text-micro font-bold text-text-faint uppercase tracking-widest block mb-0.5">Pick Date</label>
                <input type="date" value={partyDate} onChange={e => setPartyDate(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-text-primary w-full uppercase [color-scheme:dark]" />
              </div>
              <div className="bg-card border border-border-default rounded-2xl p-3.5">
                <Clock size={14} className="text-brand-accent mb-2" />
                <label className="text-micro font-bold text-text-faint uppercase tracking-widest block mb-0.5">Door Time</label>
                <input type="time" value={partyTime} onChange={e => setPartyTime(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold text-text-primary w-full [color-scheme:dark]" />
              </div>
            </div>
            <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <Hourglass size={14} className="text-brand-accent" />
                    <span className="text-nano font-black text-text-primary uppercase tracking-widest">Duration: {duration} Hours</span>
                  </div>
                  <span className="text-micro font-bold text-text-faint uppercase">Max 6H</span>
                </div>
                <input type="range" min="1" max="6" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-1 bg-glass rounded-lg appearance-none cursor-pointer accent-brand-accent" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <Globe size={14} className="text-brand-accent" />
                    <span className="text-nano font-black text-text-primary uppercase tracking-widest">Capacity: {guestLimit} People</span>
                  </div>
                  <span className="text-micro font-bold text-text-faint uppercase">Max 300</span>
                </div>
                <input type="range" min="10" max="300" step="10" value={guestLimit} onChange={(e) => setGuestLimit(Number(e.target.value))} className="w-full h-1 bg-glass rounded-lg appearance-none cursor-pointer accent-brand-accent" />
              </div>
            </div>
          </section>

          {/* MAP PICKER */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-brand-accent rounded-full" />
              <h3 className="text-tiny font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Map Picker</h3>
            </div>
            <div className="bg-card border border-border-default rounded-2xl p-3 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-glass rounded-xl px-3 py-2 border border-border-default focus-within:border-brand-accent/40 transition-all">
                  <Search size={14} className="text-text-muted shrink-0" />
                  <input type="text" placeholder="SEARCH DESTINATION..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLocation(); } }}
                    className="w-full bg-transparent border-none outline-none text-xs font-bold text-text-primary placeholder:text-text-faint uppercase" />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="text-text-faint hover:text-text-secondary"><X size={12} /></button>
                  )}
                </div>
                <button type="button" onClick={handleSearchLocation} disabled={isSearching}
                  className="px-3 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-overlay rounded-xl flex items-center justify-center text-tiny font-black tracking-widest uppercase transition-all">
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : "FIND"}
                </button>
                <button type="button" onClick={fetchCurrentLocation} disabled={isLocating} title="Locate Me"
                  className="w-10 bg-glass hover:bg-glass-hover text-brand-accent rounded-xl flex items-center justify-center border border-border-default transition-all">
                  {isLocating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                </button>
              </div>
              <div className="h-[180px] w-full bg-[#f8f9fa] rounded-xl overflow-hidden shadow-inner border border-border-default z-0 relative">
                {mapPosition ? (
                  <MapContainer center={[mapPosition.lat, mapPosition.lng]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                    <LocationMarker position={mapPosition} setPosition={setMapPosition} />
                  </MapContainer>
                ) : (
                  <div className="w-full h-full bg-card/50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="text-brand-accent animate-spin" size={24} />
                    <span className="text-tiny font-black tracking-widest text-text-muted uppercase">Acquiring Frequency...</span>
                  </div>
                )}
              </div>
              <p className="text-micro font-bold text-text-faint uppercase text-center px-4 tracking-wider">Tap on the map or type above to find the exact location</p>
              <div className="space-y-3 pt-3 border-t border-border-default">
                <div className="flex items-center gap-3 bg-glass rounded-xl px-3 py-2 border border-border-default">
                  <MapIcon size={16} className="text-brand-accent shrink-0" />
                  <div className="w-full">
                    <label className="text-micro font-bold text-text-faint uppercase tracking-widest block mb-0.5">City (Visible)</label>
                    <input type="text" placeholder="CITY NAME" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-bold text-text-primary placeholder:text-text-faint uppercase" />
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-glass rounded-xl px-3 py-2 border border-border-default">
                  <Search size={16} className="text-brand-accent/60 shrink-0" />
                  <div className="w-full">
                    <label className="text-micro font-bold text-text-faint uppercase tracking-widest block mb-0.5">Full Address (Private)</label>
                    <input type="text" placeholder="HOUSE NUMBER, STREET, AREA..." value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-medium text-text-secondary placeholder:text-text-faint" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CROWDFUNDING */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-brand-accent rounded-full" />
              <h3 className="text-tiny font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Funding</h3>
            </div>
            <button type="button" onClick={() => setShowWalletInput(!showWalletInput)}
              className="w-full bg-card border border-border-default rounded-2xl p-4 flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", showWalletInput ? "bg-brand-accent text-overlay" : "bg-glass text-text-faint")}>
                  <Wallet size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-text-primary tracking-widest uppercase">CROWDFUND PARTY</p>
                  <p className="text-micro font-bold text-text-faint uppercase">Request contributions from guests</p>
                </div>
              </div>
              <div className={cn("w-5 h-5 rounded-full border border-border-default flex items-center justify-center transition-all", showWalletInput && "bg-brand-accent border-brand-accent")}>
                {showWalletInput && <Check size={10} className="text-overlay" />}
              </div>
            </button>
            {showWalletInput && <CrowdfundInput currencySymbol={currencySymbol} crowdfundCurrency={crowdfundCurrency} crowdfundTarget={crowdfundTarget} setCrowdfundTarget={setCrowdfundTarget} setCrowdfundCurrency={setCrowdfundCurrency} />}
          </section>

          {/* PARTY TYPE */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-brand-accent rounded-full" />
              <h3 className="text-tiny font-black text-text-muted tracking-[0.2em] uppercase hover:text-text-primary transition-colors duration-150">Vibe Architecture</h3>
            </div>
            <div className="bg-card border border-border-default rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {['RAVE', 'HOUSE PARTY', 'ROOFTOP', 'CLUB', 'DINNER', 'OTHER'].map(type => (
                  <button key={type} type="button" onClick={() => setPartyType(type)}
                    className={cn("py-2.5 rounded-xl text-nano font-black tracking-widest border transition-all uppercase",
                      partyType === type ? "bg-brand-accent border-brand-accent text-overlay shadow-lg shadow-brand-accent/20" : "bg-glass border-border-default text-text-faint")}>
                    {type}
                  </button>
                ))}
              </div>
              {partyType === 'OTHER' && (
                <input type="text" placeholder="CUSTOM VIBE TYPE" value={customType} onChange={e => setCustomType(e.target.value)}
                  className="w-full bg-glass border border-border-default rounded-xl px-4 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand-accent uppercase" />
              )}
            </div>
          </section>

          <div className="mt-6 flex justify-center w-full">
            <button onClick={handlePublish} disabled={isSubmitting}
              className={cn("w-full py-4 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary text-text-primary font-black text-xs tracking-[0.2em] shadow-xl transition-all uppercase flex items-center justify-center gap-2",
                isSubmitting ? "opacity-70 cursor-not-allowed" : "shadow-brand-primary/40 active:scale-95 hover:brightness-110")}>
              {isSubmitting ? (
                <><Loader2 className="animate-spin" size={16} /> LAUNCHING...</>
              ) : (
                <><Sparkles size={16} /> LAUNCH PARTY</>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Photo Editor Modal */}
      {editingPhotoIndex !== null && partyPhotos[editingPhotoIndex] && (
        <PhotoEditor isOpen={true} imageSrc={partyPhotos[editingPhotoIndex]} onClose={() => setEditingPhotoIndex(null)} onSave={handleCropPhoto} aspectRatio="9:16" />
      )}
    </div>
  );
}

function CrowdfundInput({ currencySymbol, crowdfundCurrency, crowdfundTarget, setCrowdfundTarget, setCrowdfundCurrency }: {
  currencySymbol: (c: string) => string;
  crowdfundCurrency: string;
  crowdfundTarget: number;
  setCrowdfundTarget: (v: number) => void;
  setCrowdfundCurrency: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(ref.current, { opacity: 0, height: 0, marginTop: 0 }, { opacity: 1, height: "auto", marginTop: 12, duration: 0.35, ease: "power3.inOut" });
    }
  }, []);
  return (
    <div ref={ref} className="overflow-hidden">
      <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-lg font-black text-brand-accent">{currencySymbol(crowdfundCurrency)}</span>
        <input
          type="number"
          placeholder="TARGET AMOUNT (E.G. 500)"
          value={crowdfundTarget || ''}
          onChange={e => setCrowdfundTarget(Number(e.target.value))}
          className="w-full bg-transparent border-none outline-none text-base font-black text-text-primary placeholder:text-brand-accent/20"
        />
        <select
          value={crowdfundCurrency}
          onChange={e => setCrowdfundCurrency(e.target.value)}
          className="bg-brand-accent/10 border border-brand-accent/20 rounded-xl px-3 py-2 text-xs font-black text-text-primary uppercase tracking-wider outline-none [color-scheme:dark]"
        >
          <option value="BRL">🇧🇷 BRL</option>
          <option value="USD">🇺🇸 USD</option>
          <option value="EUR">🇪🇺 EUR</option>
          <option value="GBP">🇬🇧 GBP</option>
        </select>
      </div>
    </div>
  );
}
