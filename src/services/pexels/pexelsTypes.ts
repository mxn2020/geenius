// src/services/pexels/pexelsTypes.ts
// Comprehensive type definitions for Pexels API integration

/**
 * Core Pexels API Types (direct from API documentation)
 */

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: PexelsPhotoSrc;
  liked: boolean;
  alt: string;
}

export interface PexelsPhotoSrc {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: PexelsUser;
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
}

export interface PexelsUser {
  id: number;
  name: string;
  url: string;
}

export interface PexelsVideoFile {
  id: number;
  quality: 'hd' | 'sd' | 'hls';
  file_type: string;
  width: number | null;
  height: number | null;
  fps?: number;
  link: string;
}

export interface PexelsVideoPicture {
  id: number;
  picture: string;
  nr: number;
}

export interface PexelsCollection {
  id: string;
  title: string;
  description: string;
  private: boolean;
  media_count: number;
  photos_count: number;
  videos_count: number;
}

/**
 * API Response Types (matching API documentation structure)
 */

export interface PexelsSearchResponse<T> {
  total_results: number;
  page: number;
  per_page: number;
  photos?: T[];
  videos?: T[];
  next_page?: string;
  prev_page?: string;
}

export interface PexelsCollectionMediaResponse {
  id: string;
  media: Array<(PexelsPhoto | PexelsVideo) & { type: 'Photo' | 'Video' }>;
  page: number;
  per_page: number;
  total_results: number;
  next_page?: string;
  prev_page?: string;
}

export interface PexelsCollectionsResponse {
  collections: PexelsCollection[];
  page: number;
  per_page: number;
  total_results: number;
  next_page?: string;
  prev_page?: string;
}

/**
 * API Parameter Types (matching API documentation)
 */

export interface PexelsSearchParams {
  query: string;
  orientation?: PexelsOrientation;
  size?: PexelsPhotoSize;
  color?: PexelsColor;
  locale?: string;
  page?: number;
  per_page?: number;
}

export interface PexelsVideoSearchParams {
  query: string;
  orientation?: PexelsOrientation;
  size?: PexelsVideoSize;
  locale?: string;
  page?: number;
  per_page?: number;
}

export interface PexelsPopularVideosParams {
  min_width?: number;
  min_height?: number;
  min_duration?: number;
  max_duration?: number;
  page?: number;
  per_page?: number;
}

export interface PexelsCuratedParams {
  page?: number;
  per_page?: number;
}

export interface PexelsCollectionParams {
  page?: number;
  per_page?: number;
}

export interface PexelsCollectionMediaParams {
  type?: 'photos' | 'videos';
  sort?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

/**
 * Enum Types (from API documentation)
 */

export type PexelsOrientation = 'landscape' | 'portrait' | 'square';
export type PexelsPhotoSize = 'large' | 'medium' | 'small';
export type PexelsVideoSize = 'large' | 'medium' | 'small';
export type PexelsColor = 
  | 'red' | 'orange' | 'yellow' | 'green' | 'turquoise' 
  | 'blue' | 'violet' | 'pink' | 'brown' | 'black' | 'gray' | 'white' 
  | string; // Allows hex color codes

export type PexelsMediaType = 'photo' | 'video';
export type PexelsQuality = 'hd' | 'sd' | 'hls';

/**
 * Service Layer Types (for application business logic)
 */

// Normalized media asset representation for app use
export interface PexelsMediaAsset {
  id: number;
  type: PexelsMediaType;
  url: string;
  downloadUrl: string;
  thumbnailUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  avgColor?: string;
  duration?: number;
  fileSize?: string;
  quality?: string;
  tags?: string[];
  createdAt?: Date;
  metadata?: Record<string, any>;
  similarityScore?: number; // For recommendation algorithms
}

// Enhanced search options for service layer
export interface PexelsSearchOptions {
  query: string;
  type?: 'photos' | 'videos' | 'both';
  orientation?: PexelsOrientation;
  size?: PexelsPhotoSize | PexelsVideoSize;
  color?: PexelsColor;
  minWidth?: number;
  minHeight?: number;
  minDuration?: number;
  maxDuration?: number;
  page?: number;
  perPage?: number;
  maxResults?: number;
  includeMetadata?: boolean;
  excludePhotographers?: string[];
  sortBy?: 'relevance' | 'popularity' | 'newest' | 'random' | 'size' | 'duration';
}

// Rich search result with pagination and metadata
export interface PexelsSearchResult {
  assets: PexelsMediaAsset[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  searchQuery: string;
  searchType: string;
  executionTime: number;
  rateLimitRemaining?: number;
  suggestions?: string[];
}

// Collection information (normalized for app use)
export interface PexelsCollectionInfo {
  id: string;
  title: string;
  description: string;
  mediaCount: number;
  photosCount: number;
  videosCount: number;
  isPrivate: boolean;
  coverImage?: string;
  tags?: string[];
  curator?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Collection search result type
export interface PexelsCollectionSearchResult {
  collections: PexelsCollectionInfo[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  searchType: string;
  executionTime: number;
}

// Collection media options
export interface PexelsCollectionMediaOptions {
  type?: 'photos' | 'videos';
  sort?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
  maxResults?: number;
  includeMetadata?: boolean;
  contentFilter?: PexelsContentFilter;
}

// Rate limit and API health information
export interface PexelsRateLimit {
  limit: number;
  remaining: number;
  resetTimestamp: number;
  resetDate: Date;
  percentageUsed: number;
  estimatedTimeToReset: string;
}

// Validation and error handling
export interface PexelsValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  apiKeyStatus?: 'valid' | 'invalid' | 'expired' | 'rate_limited';
}

// Download and asset management
export interface PexelsDownloadResult {
  success: boolean;
  url?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  attribution?: string;
  error?: string;
  metadata?: {
    downloadedAt: Date;
    originalAsset: PexelsMediaAsset;
    processingTime: number;
  };
}

// Batch operations
export interface PexelsBatchRequest {
  photoIds?: number[];
  videoIds?: number[];
  maxConcurrent?: number;
  retryOnFailure?: boolean;
}

export interface PexelsBatchResult {
  successful: PexelsMediaAsset[];
  failed: Array<{ id: number; error: string }>;
  totalRequested: number;
  successCount: number;
  failureCount: number;
  executionTime: number;
}

// Recommendation and AI features
export interface PexelsRecommendationOptions {
  count?: number;
  similarColor?: boolean;
  similarSize?: boolean;
  sameType?: boolean;
  similarPhotographer?: boolean;
  diversityFactor?: number; // 0-1, higher = more diverse results
  excludeIds?: number[];
}

export interface PexelsRecommendationResult {
  recommendations: PexelsMediaAsset[];
  basedOn: PexelsMediaAsset;
  algorithm: string;
  confidence: number;
  explanation?: string[];
}

// Analytics and usage tracking
export interface PexelsUsageStats {
  totalRequests: number;
  photosRequested: number;
  videosRequested: number;
  collectionsAccessed: number;
  averageResponseTime: number;
  rateLimitHits: number;
  errors: number;
  topSearchQueries: string[];
  topPhotographers: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

// Content filtering and moderation
export interface PexelsContentFilter {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  aspectRatioRange?: { min: number; max: number };
  excludeColors?: PexelsColor[];
  allowedPhotographers?: string[];
  blockedPhotographers?: string[];
  excludePhotographers?: string[]; // Added this missing property
  contentRating?: 'safe' | 'moderate' | 'restricted';
  keywords?: {
    required?: string[];
    excluded?: string[];
  };
}

// Caching and performance
export interface PexelsCacheOptions {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size
  enabled: boolean;
  strategy: 'memory' | 'disk' | 'hybrid';
  compression?: boolean;
}

export interface PexelsCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
  accessCount: number;
  size: number;
}

// Integration and webhook types
export interface PexelsWebhookEvent {
  type: 'download' | 'view' | 'like' | 'search' | 'rate_limit' | 'error' | 'collection_access';
  assetId?: number;
  assetType?: PexelsMediaType;
  collectionId?: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
  source: string;
}

export interface PexelsIntegrationConfig {
  autoAttribution: boolean;
  downloadPath?: string;
  watermark?: boolean;
  autoResize?: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    format?: 'jpg' | 'png' | 'webp';
  };
  allowedDomains?: string[];
  rateLimitBuffer?: number; // Keep N requests in reserve
  retryConfig?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  webhookUrls?: string[];
  cacheConfig?: PexelsCacheOptions;
}

// Component and UI types
export interface PexelsGalleryProps {
  assets: PexelsMediaAsset[];
  onAssetSelect?: (asset: PexelsMediaAsset) => void;
  onAssetDownload?: (asset: PexelsMediaAsset) => void;
  onAssetPreview?: (asset: PexelsMediaAsset) => void;
  layout?: 'grid' | 'masonry' | 'list' | 'carousel';
  columns?: number;
  gap?: number;
  showMetadata?: boolean;
  showDownloadButton?: boolean;
  showPhotographer?: boolean;
  showLikeButton?: boolean;
  enableLazyLoading?: boolean;
  enableInfiniteScroll?: boolean;
  customRenderer?: (asset: PexelsMediaAsset) => React.ReactNode;
}

export interface PexelsSearchBoxProps {
  onSearch: (options: PexelsSearchOptions) => void;
  initialQuery?: string;
  showAdvancedFilters?: boolean;
  showSuggestions?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  recentSearches?: string[];
  popularSearches?: string[];
}

export interface PexelsAssetCardProps {
  asset: PexelsMediaAsset;
  onSelect?: (asset: PexelsMediaAsset) => void;
  onDownload?: (asset: PexelsMediaAsset) => void;
  onLike?: (asset: PexelsMediaAsset) => void;
  showMetadata?: boolean;
  showDownloadButton?: boolean;
  showLikeButton?: boolean;
  size?: 'small' | 'medium' | 'large';
  aspectRatio?: 'original' | 'square' | '16:9' | '4:3';
  lazy?: boolean;
}

export interface PexelsCollectionCardProps {
  collection: PexelsCollectionInfo;
  onSelect?: (collection: PexelsCollectionInfo) => void;
  onView?: (collection: PexelsCollectionInfo) => void;
  showMetadata?: boolean;
  size?: 'small' | 'medium' | 'large';
  showMediaCount?: boolean;
}

export interface PexelsCollectionGalleryProps {
  collections: PexelsCollectionInfo[];
  onCollectionSelect?: (collection: PexelsCollectionInfo) => void;
  layout?: 'grid' | 'list';
  columns?: number;
  showMetadata?: boolean;
  enableLazyLoading?: boolean;
}

// Utility and helper types
export type PexelsProgressCallback = (message: string, progress?: number) => void;
export type PexelsAssetId = number;
export type PexelsCollectionId = string;
export type PexelsPhotographerId = number;

// Error handling
export interface PexelsError {
  code: string;
  message: string;
  status?: number;
  details?: any;
  timestamp: Date;
  requestId?: string;
}

export class PexelsAPIException extends Error implements PexelsError {
  code: string;
  status?: number;
  details?: any;
  timestamp: Date;
  requestId?: string;

  constructor(message: string, code: string, status?: number, details?: any) {
    super(message);
    this.name = 'PexelsAPIException';
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date();
  }
}

export class PexelsValidationException extends Error implements PexelsError {
  code: string;
  timestamp: Date;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'PexelsValidationException';
    this.code = code;
    this.timestamp = new Date();
  }
}

export class PexelsRateLimitException extends Error implements PexelsError {
  code: string;
  resetTime: number;
  timestamp: Date;

  constructor(message: string, resetTime: number) {
    super(message);
    this.name = 'PexelsRateLimitException';
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.resetTime = resetTime;
    this.timestamp = new Date();
  }
}

// Type guards and utility functions
export const isPexelsPhoto = (asset: PexelsPhoto | PexelsVideo): asset is PexelsPhoto => {
  return 'src' in asset && 'avg_color' in asset;
};

export const isPexelsVideo = (asset: PexelsPhoto | PexelsVideo): asset is PexelsVideo => {
  return 'video_files' in asset && 'duration' in asset;
};

export const isPhotoAsset = (asset: PexelsMediaAsset): boolean => {
  return asset.type === 'photo';
};

export const isVideoAsset = (asset: PexelsMediaAsset): boolean => {
  return asset.type === 'video';
};

export const isCollectionPrivate = (collection: PexelsCollectionInfo): boolean => {
  return collection.isPrivate;
};

export const hasCollectionMedia = (collection: PexelsCollectionInfo): boolean => {
  return collection.mediaCount > 0;
};

// Constants from API documentation
export const PEXELS_CONSTANTS = {
  API_VERSION: 'v1',
  MAX_PER_PAGE: 80,
  DEFAULT_PER_PAGE: 15,
  MAX_SEARCH_RESULTS: 10000,
  RATE_LIMIT_DEFAULT: {
    HOURLY: 200,
    MONTHLY: 20000
  },
  SUPPORTED_ORIENTATIONS: ['landscape', 'portrait', 'square'] as const,
  SUPPORTED_PHOTO_SIZES: ['large', 'medium', 'small'] as const,
  SUPPORTED_VIDEO_SIZES: ['large', 'medium', 'small'] as const,
  SUPPORTED_COLORS: [
    'red', 'orange', 'yellow', 'green', 'turquoise', 
    'blue', 'violet', 'pink', 'brown', 'black', 'gray', 'white'
  ] as const,
  SUPPORTED_QUALITIES: ['hd', 'sd', 'hls'] as const,
  CACHE_TTL: {
    SEARCH_RESULTS: 5 * 60 * 1000, // 5 minutes
    ASSET_DETAILS: 30 * 60 * 1000, // 30 minutes
    COLLECTIONS: 60 * 60 * 1000, // 1 hour
    RATE_LIMIT: 60 * 1000 // 1 minute
  },
  ENDPOINTS: {
    PHOTOS_SEARCH: '/search',
    PHOTOS_CURATED: '/curated',
    PHOTOS_GET: '/photos',
    VIDEOS_SEARCH: '/search',
    VIDEOS_POPULAR: '/popular',
    VIDEOS_GET: '/videos',
    COLLECTIONS_FEATURED: '/collections/featured',
    COLLECTIONS_MINE: '/collections',
    COLLECTION_MEDIA: '/collections'
  },
  COLLECTION_TYPES: {
    FEATURED: 'featured',
    USER: 'user',
    PRIVATE: 'private'
  }
} as const;

// Advanced search and filtering types
export interface PexelsAdvancedSearchOptions extends PexelsSearchOptions {
  collections?: {
    include?: string[];
    exclude?: string[];
    featuredOnly?: boolean;
  };
  photographer?: {
    include?: string[];
    exclude?: string[];
    verified?: boolean;
  };
  quality?: {
    minScore?: number;
    requireHD?: boolean;
    requireCurated?: boolean;
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

// Analytics and reporting types
export interface PexelsAnalyticsReport {
  period: {
    start: Date;
    end: Date;
  };
  usage: PexelsUsageStats;
  performance: {
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
  };
  topContent: {
    searchQueries: Array<{ query: string; count: number }>;
    photographers: Array<{ name: string; downloads: number }>;
    collections: Array<{ id: string; title: string; views: number }>;
  };
  recommendations: {
    accuracy: number;
    clickThroughRate: number;
    conversionRate: number;
  };
}

// Export utility types
export type PexelsServiceConfig = PexelsIntegrationConfig;
export type PexelsAssetWithScore = PexelsMediaAsset & { score?: number };
export type PexelsCollectionWithAssets = PexelsCollectionInfo & { assets?: PexelsMediaAsset[] };

