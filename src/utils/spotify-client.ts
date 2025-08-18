import axios, { type AxiosResponse } from "axios";
import type {
  SpotifyConfig,
  SpotifyTokenResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyRecentlyPlayedResponse,
  ReadmeTrackInfo,
} from "../types/spotify.js";

export class SpotifyClient {
  private config: SpotifyConfig;

  constructor(config: SpotifyConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response: AxiosResponse<SpotifyTokenResponse> = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      return response.data.access_token;
    } catch (error) {
      console.error("Error getting access token:", error);
      throw new Error("Failed to get Spotify access token");
    }
  }

  private async getCurrentlyPlaying(
    accessToken: string,
  ): Promise<ReadmeTrackInfo | null> {
    try {
      const response: AxiosResponse<SpotifyCurrentlyPlayingResponse> =
        await axios.get(
          "https://api.spotify.com/v1/me/player/currently-playing",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

      if (response.status === 204 || !response.data?.item) {
        return null;
      }

      const track = response.data.item;
      return {
        name: track.name,
        artist: track.artists[0]?.name ?? "Unknown Artist",
        album: track.album.name,
        image: track.album.images[0]?.url,
        isPlaying: response.data.is_playing,
        uri: track.uri,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 204) {
        return null;
      }
      throw error;
    }
  }

  private async getRecentlyPlayed(
    accessToken: string,
  ): Promise<ReadmeTrackInfo | null> {
    try {
      const response: AxiosResponse<SpotifyRecentlyPlayedResponse> =
        await axios.get(
          "https://api.spotify.com/v1/me/player/recently-played?limit=1",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

      const recentTrack = response.data.items[0]?.track;
      if (!recentTrack) {
        return null;
      }

      return {
        name: recentTrack.name,
        artist: recentTrack.artists[0]?.name ?? "Unknown Artist",
        album: recentTrack.album.name,
        image: recentTrack.album.images[0]?.url,
        isPlaying: false,
        uri: recentTrack.uri,
      };
    } catch (error) {
      console.error("Error getting recently played:", error);
      return null;
    }
  }

  public async getTrackInfo(): Promise<ReadmeTrackInfo | null> {
    try {
      const accessToken = await this.getAccessToken();

      // Try to get currently playing first
      const currentTrack = await this.getCurrentlyPlaying(accessToken);
      if (currentTrack) {
        return currentTrack;
      }

      // If nothing is currently playing, get recently played
      const recentTrack = await this.getRecentlyPlayed(accessToken);
      return recentTrack;
    } catch (error) {
      console.error("Error getting track info:", error);
      return null;
    }
  }

  public generateAuthUrl(): string {
    const scope = "user-read-currently-playing user-read-recently-played";
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      scope,
      redirect_uri: this.config.redirectUri,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  public async exchangeCodeForTokens(
    code: string,
  ): Promise<SpotifyTokenResponse> {
    const response: AxiosResponse<SpotifyTokenResponse> = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    return response.data;
  }
}
