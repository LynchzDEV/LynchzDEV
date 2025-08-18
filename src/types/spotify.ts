export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  uri: string;
}

export interface SpotifyCurrentlyPlayingResponse {
  item: SpotifyTrack;
  is_playing: boolean;
  progress_ms: number;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
}

export interface SpotifyRecentlyPlayedResponse {
  items: Array<{
    track: SpotifyTrack;
    played_at: string;
  }>;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// Our simplified response type for README
export interface ReadmeTrackInfo {
  name: string;
  artist: string;
  album: string;
  image?: string;
  isPlaying: boolean;
  uri?: string;
}

// Environment variables type
export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
}
