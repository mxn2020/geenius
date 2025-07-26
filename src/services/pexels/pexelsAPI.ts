// src/services/pexels/pexelsAPI.ts
// Direct API implementation following Pexels API documentation exactly
// This file mirrors the official API documentation structure

import {
  PexelsPhoto,
  PexelsVideo,
  PexelsSearchResponse,
  PexelsCollectionMediaResponse,
  PexelsCollectionsResponse,
  PexelsSearchParams,
  PexelsVideoSearchParams,
  PexelsPopularVideosParams,
  PexelsCuratedParams,
  PexelsCollectionParams,
  PexelsCollectionMediaParams,
  PexelsValidationResult,
  PexelsAPIException,
  PEXELS_CONSTANTS
} from './pexelsTypes';

/**
 * PexelsAPI - Direct implementation of Pexels API endpoints
 * 
 * This class provides a 1:1 mapping with the official Pexels API documentation.
 * Each method corresponds directly to an API endpoint with exact parameter matching.
 * 
 * API Documentation Reference: https://www.pexels.com/api/documentation/
 */
export class PexelsAPI {
  private readonly baseUrl = 'https://api.pexels.com/v1';
  private readonly videosBaseUrl = 'https://api.pexels.com/videos';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Pexels API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Private method to make HTTP requests to Pexels API
   * Handles authentication, error responses, and rate limiting headers
   */
  private async makeRequest(endpoint: string, isVideo: boolean = false): Promise<any> {
    const baseUrl = isVideo ? this.videosBaseUrl : this.baseUrl;
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': this.apiKey,
        'User-Agent': 'Pexels-Service-API/1.0',
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      
      throw new PexelsAPIException(
        `Pexels API Error: ${response.status} ${response.statusText}`,
        `HTTP_${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  /**
   * Helper method to build query strings from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const validParams = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    
    return validParams.length > 0 ? `?${validParams.join('&')}` : '';
  }

  // ===================================================================
  // PHOTO ENDPOINTS (API Documentation Section: Photos)
  // ===================================================================

  /**
   * Search for Photos
   * GET https://api.pexels.com/v1/search
   * 
   * This endpoint enables you to search Pexels for any topic that you would like.
   * For example your query could be something broad like Nature, Tigers, People.
   * Or it could be something specific like Group of people working.
   */
  async searchPhotos(params: PexelsSearchParams): Promise<PexelsSearchResponse<PexelsPhoto>> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.PHOTOS_SEARCH}${queryString}`);
  }

  /**
   * Curated Photos
   * GET https://api.pexels.com/v1/curated
   * 
   * This endpoint enables you to receive real-time photos curated by the Pexels team.
   * We add at least one new photo per hour to our curated list so that you always 
   * get a changing selection of trending photos.
   */
  async getCuratedPhotos(params: PexelsCuratedParams = {}): Promise<PexelsSearchResponse<PexelsPhoto>> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.PHOTOS_CURATED}${queryString}`);
  }

  /**
   * Get a Photo
   * GET https://api.pexels.com/v1/photos/:id
   * 
   * Retrieve a specific Photo from its id.
   */
  async getPhoto(id: number): Promise<PexelsPhoto> {
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.PHOTOS_GET}/${id}`);
  }

  // ===================================================================
  // VIDEO ENDPOINTS (API Documentation Section: Videos)
  // ===================================================================

  /**
   * Search for Videos
   * GET https://api.pexels.com/videos/search
   * 
   * This endpoint enables you to search Pexels for any topic that you would like.
   * For example your query could be something broad like Nature, Tigers, People.
   * Or it could be something specific like Group of people working.
   */
  async searchVideos(params: PexelsVideoSearchParams): Promise<PexelsSearchResponse<PexelsVideo>> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.VIDEOS_SEARCH}${queryString}`, true);
  }

  /**
   * Popular Videos
   * GET https://api.pexels.com/videos/popular
   * 
   * This endpoint enables you to receive the current popular Pexels videos.
   */
  async getPopularVideos(params: PexelsPopularVideosParams = {}): Promise<PexelsSearchResponse<PexelsVideo>> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.VIDEOS_POPULAR}${queryString}`, true);
  }

  /**
   * Get a Video
   * GET https://api.pexels.com/videos/videos/:id
   * 
   * Retrieve a specific Video from its id.
   */
  async getVideo(id: number): Promise<PexelsVideo> {
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.VIDEOS_GET}/${id}`, true);
  }

  // ===================================================================
  // COLLECTION ENDPOINTS (API Documentation Section: Collections)
  // ===================================================================

  /**
   * Featured Collections
   * GET https://api.pexels.com/v1/collections/featured
   * 
   * This endpoint returns all featured collections on Pexels.
   */
  async getFeaturedCollections(params: PexelsCollectionParams = {}): Promise<PexelsCollectionsResponse> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.COLLECTIONS_FEATURED}${queryString}`);
  }

  /**
   * My Collections
   * GET https://api.pexels.com/v1/collections
   * 
   * This endpoint returns all of your collections.
   * Note: Requires authentication with a valid API key that has collection access.
   */
  async getMyCollections(params: PexelsCollectionParams = {}): Promise<PexelsCollectionsResponse> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.COLLECTIONS_MINE}${queryString}`);
  }

  /**
   * Collection Media
   * GET https://api.pexels.com/v1/collections/:id
   * 
   * This endpoint returns all the media (photos and videos) within a single collection.
   * You can filter to only receive photos or videos using the type parameter.
   */
  async getCollectionMedia(
    collectionId: string, 
    params: PexelsCollectionMediaParams = {}
  ): Promise<PexelsCollectionMediaResponse> {
    const queryString = this.buildQueryString(params);
    return this.makeRequest(`${PEXELS_CONSTANTS.ENDPOINTS.COLLECTION_MEDIA}/${collectionId}${queryString}`);
  }

  // ===================================================================
  // UTILITY METHODS (Not in API docs but useful for applications)
  // ===================================================================

  /**
   * Check API Rate Limits
   * 
   * Makes a minimal request to check current rate limit status from response headers.
   * Returns rate limit information if available in response headers.
   */
  async checkRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: number;
  } | null> {
    try {
      // Make a minimal request to check headers
      const response = await fetch(`${this.baseUrl}/curated?per_page=1`, {
        headers: {
          'Authorization': this.apiKey,
          'User-Agent': 'Pexels-Service-API/1.0',
        },
      });

      const limit = response.headers.get('X-Ratelimit-Limit');
      const remaining = response.headers.get('X-Ratelimit-Remaining');
      const reset = response.headers.get('X-Ratelimit-Reset');

      if (limit && remaining && reset) {
        return {
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: parseInt(reset)
        };
      }

      return null;
    } catch (error) {
      console.warn('Failed to check rate limit:', error);
      return null;
    }
  }

  /**
   * Validate API Key
   * 
   * Tests the API key by making a simple request to the curated photos endpoint.
   * Returns validation result with error details if the key is invalid.
   */
  async validateApiKey(): Promise<PexelsValidationResult> {
    try {
      await this.makeRequest('/curated?per_page=1');
      return { 
        valid: true,
        apiKeyStatus: 'valid'
      };
    } catch (error) {
      if (error instanceof PexelsAPIException) {
        if (error.status === 401) {
          return { 
            valid: false, 
            error: 'Invalid Pexels API key',
            apiKeyStatus: 'invalid'
          };
        } else if (error.status === 429) {
          return { 
            valid: false, 
            error: 'API rate limit exceeded',
            apiKeyStatus: 'rate_limited'
          };
        } else {
          return { 
            valid: false, 
            error: `API error: ${error.status} ${error.message}`,
            apiKeyStatus: 'invalid'
          };
        }
      }
      return { 
        valid: false, 
        error: `Network error: ${error}`,
        apiKeyStatus: 'invalid'
      };
    }
  }

  // ===================================================================
  // BATCH OPERATIONS (Helper methods for multiple requests)
  // ===================================================================

  /**
   * Get Multiple Photos by IDs
   * 
   * Fetches multiple photos in parallel. Useful for getting specific photos
   * when you have a list of photo IDs.
   */
  async getPhotoBatch(ids: number[]): Promise<PexelsPhoto[]> {
    const photos = await Promise.allSettled(
      ids.map(id => this.getPhoto(id))
    );

    return photos
      .filter((result): result is PromiseFulfilledResult<PexelsPhoto> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  /**
   * Get Multiple Videos by IDs
   * 
   * Fetches multiple videos in parallel. Useful for getting specific videos
   * when you have a list of video IDs.
   */
  async getVideoBatch(ids: number[]): Promise<PexelsVideo[]> {
    const videos = await Promise.allSettled(
      ids.map(id => this.getVideo(id))
    );

    return videos
      .filter((result): result is PromiseFulfilledResult<PexelsVideo> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  // ===================================================================
  // ADVANCED SEARCH METHODS (Pagination helpers)
  // ===================================================================

  /**
   * Search Photos with Automatic Pagination
   * 
   * Automatically fetches multiple pages of photo search results up to maxResults.
   * Useful when you need more than the API's per-page limit (80).
   */
  async searchPhotosAll(
    params: PexelsSearchParams, 
    maxResults: number = 200
  ): Promise<PexelsPhoto[]> {
    const allPhotos: PexelsPhoto[] = [];
    let currentPage = params.page || 1;
    const perPage = Math.min(params.per_page || PEXELS_CONSTANTS.MAX_PER_PAGE, PEXELS_CONSTANTS.MAX_PER_PAGE);

    while (allPhotos.length < maxResults) {
      const response = await this.searchPhotos({
        ...params,
        page: currentPage,
        per_page: perPage
      });

      if (!response.photos || response.photos.length === 0) {
        break; // No more photos
      }

      allPhotos.push(...response.photos);

      // Check if we've reached the total available or our max
      if (allPhotos.length >= maxResults || 
          allPhotos.length >= response.total_results ||
          !response.next_page) {
        break;
      }

      currentPage++;
    }

    return allPhotos.slice(0, maxResults);
  }

  /**
   * Search Videos with Automatic Pagination
   * 
   * Automatically fetches multiple pages of video search results up to maxResults.
   * Useful when you need more than the API's per-page limit (80).
   */
  async searchVideosAll(
    params: PexelsVideoSearchParams, 
    maxResults: number = 200
  ): Promise<PexelsVideo[]> {
    const allVideos: PexelsVideo[] = [];
    let currentPage = params.page || 1;
    const perPage = Math.min(params.per_page || PEXELS_CONSTANTS.MAX_PER_PAGE, PEXELS_CONSTANTS.MAX_PER_PAGE);

    while (allVideos.length < maxResults) {
      const response = await this.searchVideos({
        ...params,
        page: currentPage,
        per_page: perPage
      });

      if (!response.videos || response.videos.length === 0) {
        break; // No more videos
      }

      allVideos.push(...response.videos);

      // Check if we've reached the total available or our max
      if (allVideos.length >= maxResults || 
          allVideos.length >= response.total_results ||
          !response.next_page) {
        break;
      }

      currentPage++;
    }

    return allVideos.slice(0, maxResults);
  }

  // ===================================================================
  // API INFORMATION METHODS
  // ===================================================================

  /**
   * Get API Base URLs
   * 
   * Returns the current API base URLs being used.
   */
  getApiInfo(): { baseUrl: string; videosBaseUrl: string; version: string } {
    return {
      baseUrl: this.baseUrl,
      videosBaseUrl: this.videosBaseUrl,
      version: PEXELS_CONSTANTS.API_VERSION
    };
  }

  /**
   * Get Supported Parameters
   * 
   * Returns information about supported API parameters for validation.
   */
  getSupportedParameters() {
    return {
      orientations: PEXELS_CONSTANTS.SUPPORTED_ORIENTATIONS,
      photoSizes: PEXELS_CONSTANTS.SUPPORTED_PHOTO_SIZES,
      videoSizes: PEXELS_CONSTANTS.SUPPORTED_VIDEO_SIZES,
      colors: PEXELS_CONSTANTS.SUPPORTED_COLORS,
      qualities: PEXELS_CONSTANTS.SUPPORTED_QUALITIES,
      maxPerPage: PEXELS_CONSTANTS.MAX_PER_PAGE,
      defaultPerPage: PEXELS_CONSTANTS.DEFAULT_PER_PAGE
    };
  }
}