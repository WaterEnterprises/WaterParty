export interface User {
  ID: string;
  RealName: string;
  Email: string;
  PhoneNumber: string;
  ProfilePhotos: string[];
  Age: number;
  Gender: string;
  Birthday: string;
  Bio: string;
  JobTitle: string;
  Company: string;
  School: string;
  Degree: string;
  Instagram?: string;
  Twitter?: string;
  VK?: string;
  Telegram?: string;
  WhatsApp?: string;
  Facebook?: string;
  TrustScore: number;
  Thumbnail: string;
  HostedCount?: number;
  HostingRating?: number;
  Reach?: number;
  IsAdmin?: boolean;
  ShowEmail?: boolean;
  PreferredCurrency?: string;
  Latitude?: number;
  Longitude?: number;
}

export interface Party {
  ID: string;
  HostID: string;
  HostName?: string;
  HostThumbnail?: string;
  Title: string;
  Description: string;
  PartyPhotos: string[];
  StartTime: string;
  DurationHours: number;
  Status: string;
  Address: string;
  City: string;
  GeoLat: number;
  GeoLon: number;
  MaxCapacity: number;
  CurrentGuestCount: number;
  VibeTags: string[];
  Rules: string[];
  ChatRoomID: string;
  Thumbnail: string;
  CrowdfundTarget?: number;
  CrowdfundCurrent?: number;
  CrowdfundCurrency?: string;
  PartyType?: string;
}

export interface ChatRoom {
  ID: string;
  PartyID: string;
  Title: string;
  ImageUrl: string;
  RecentMessages: any[];
  IsGroup: boolean;
  ParticipantIDs: string[];
}

export interface Message {
  ID: string;
  ChatID: string;
  SenderID: string;
  Content: string;
  ImageUrl?: string;
  VideoUrl?: string;
  /** Timestamp from the normalized messages table */
  CreatedAt: string;
  /** Legacy timestamp from old RecentMessages JSON format (migrated data) */
  Timestamp?: string;
  SenderName?: string;
  SenderThumbnail?: string;
}
