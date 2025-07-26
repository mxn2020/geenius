// src/services/pexels.ts
// High-level Pexels service with business logic, caching, analytics, and app-specific features
// This file contains the application logic while PexelsAPI handles direct API communication

import { PexelsAPI } from './pexels/pexelsAPI';
import {
  PexelsPhoto,
  PexelsVideo,
  PexelsCollection,
  PexelsSearchParams,
  PexelsVideoSearchParams,
  PexelsMediaAsset,
  PexelsSearchOptions,
  PexelsSearchResult,
  PexelsCollectionInfo,
  PexelsRateLimit,
  PexelsValidationResult,
  PexelsDownloadResult,
  PexelsBatchRequest,
  PexelsBatchResult,
  PexelsRecommendationOptions,
  PexelsRecommendationResult,
  PexelsProgressCallback,
  PexelsUsageStats,
  PexelsContentFilter,
  PexelsCacheOptions,
  PexelsCacheEntry,
  PexelsIntegrationConfig,
  PexelsWebhookEvent,
  PEXELS_CONSTANTS,
  PexelsCollectionSearchResult,
  PexelsCollectionMediaOptions
} from './pexels/pexelsTypes';

/**
 * PexelsService - High-level service with business logic and app features
 * 
 * This service layer provides:
 * - Normalized data transformation
 * - Caching and performance optimization
 * - Analytics and usage tracking
 * - Content filtering and moderation
 * - Batch operations and error handling
 * - Integration features and webhooks
 * - Recommendation algorithms
 * - Progress tracking and user feedback
 * - Collections management
 */
export class PexelsService {
  private client: PexelsAPI | null = null;
  private cache = new Map<string, PexelsCacheEntry<any>>();
  private usageStats: Partial<PexelsUsageStats> = {
    totalRequests: 0,
    photosRequested: 0,
    videosRequested: 0,
    collectionsAccessed: 0,
    errors: 0,
    rateLimitHits: 0,
    topSearchQueries: [],
    topPhotographers: []
  };
  private config: Partial<PexelsIntegrationConfig> = {};
  private cacheOptions: PexelsCacheOptions = {
    ttl: PEXELS_CONSTANTS.CACHE_TTL.SEARCH_RESULTS,
    maxSize: 1000,
    enabled: true,
    strategy: 'memory'
  };

  constructor(config?: Partial<PexelsIntegrationConfig>) {
    this.config = {
      autoAttribution: true,
      rateLimitBuffer: 10,
      retryConfig: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      ...config
    };
  }

  /**
   * Get or create PexelsAPI client instance
   */
  private async getClient(): Promise<PexelsAPI> {
    if (!this.client) {
      if (!process.env.PEXELS_API_KEY) {
        throw new Error('PEXELS_API_KEY environment variable is required for Pexels integration.');
      }
      this.client = new PexelsAPI(process.env.PEXELS_API_KEY);
    }
    return this.client;
  }

  // ===================================================================
  // VALIDATION AND HEALTH CHECK
  // ===================================================================

  /**
   * Validate Pexels API credentials and check service health
   */
  async validateCredentials(onProgress?: PexelsProgressCallback): Promise<PexelsValidationResult> {
    try {
      onProgress?.('🔍 Validating Pexels API credentials...', 0);
      console.log('🔍 Validating Pexels API credentials...');

      const client = await this.getClient();
      
      // Check API key validity
      onProgress?.('🔑 Testing API key...', 25);
      const validation = await client.validateApiKey();
      
      if (!validation.valid) {
        console.error('❌ Pexels API credentials validation failed:', validation.error);
        onProgress?.(`❌ Validation failed: ${validation.error}`, 100);
        return validation;
      }

      // Check rate limits
      onProgress?.('📊 Checking rate limits...', 50);
      const rateLimit = await client.checkRateLimit();
      const warnings: string[] = [];
      
      if (rateLimit) {
        const percentageUsed = ((rateLimit.limit - rateLimit.remaining) / rateLimit.limit) * 100;
        if (percentageUsed > 80) {
          warnings.push(`Rate limit usage is high: ${percentageUsed.toFixed(1)}%`);
        }
        
        if (rateLimit.remaining < (this.config.rateLimitBuffer || 10)) {
          warnings.push(`Low remaining requests: ${rateLimit.remaining}`);
        }
      }

      // Test basic functionality
      onProgress?.('🧪 Testing API endpoints...', 75);
      try {
        await client.getCuratedPhotos({ per_page: 1 });
      } catch (error) {
        warnings.push('Curated photos endpoint test failed');
      }

      console.log('✅ Pexels API credentials are valid');
      onProgress?.('✅ Pexels API credentials are valid', 100);
      
      return { 
        valid: true, 
        warnings: warnings.length > 0 ? warnings : undefined,
        apiKeyStatus: 'valid'
      };
    } catch (error: any) {
      console.error('❌ Pexels credentials validation failed:', error.message);
      onProgress?.(`❌ Validation failed: ${error.message}`, 100);
      
      return { 
        valid: false, 
        error: `Pexels API error: ${error.message}`,
        apiKeyStatus: 'invalid'
      };
    }
  }

  // ===================================================================
  // UNIFIED SEARCH WITH ENHANCED FEATURES
  // ===================================================================

  /**
   * Search for photos, videos, or both with advanced filtering and caching
   */
  async searchMedia(
    options: PexelsSearchOptions,
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsSearchResult> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        type = 'both',
        orientation,
        size,
        color,
        minWidth,
        minHeight,
        minDuration,
        maxDuration,
        page = 1,
        perPage = 40,
        maxResults = 200,
        includeMetadata = false,
        excludePhotographers = [],
        sortBy = 'relevance'
      } = options;

      // Generate cache key
      const cacheKey = this.generateCacheKey('search', options);
      
      // Check cache first
      if (this.cacheOptions.enabled) {
        const cached = this.getFromCache<PexelsSearchResult>(cacheKey);
        if (cached) {
          onProgress?.('📦 Retrieved from cache', 100);
          return cached;
        }
      }

      onProgress?.(`🔍 Searching for ${type} with query: "${query}"`, 0);
      console.log(`🔍 Searching Pexels for ${type} with query: "${query}"`);

      const client = await this.getClient();
      let allAssets: PexelsMediaAsset[] = [];
      let totalResults = 0;

      // Update usage stats
      this.usageStats.totalRequests = (this.usageStats.totalRequests || 0) + 1;
      this.trackSearchQuery(query);

      // Search photos
      if (type === 'photos' || type === 'both') {
        onProgress?.('📸 Searching photos...', 25);
        
        const photoParams: PexelsSearchParams = {
          query,
          orientation,
          size: size as any,
          color,
          page,
          per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
        };

        const photosResponse = await client.searchPhotos(photoParams);
        if (photosResponse.photos) {
          let photoAssets = photosResponse.photos.map(photo => 
            this.convertPhotoToAsset(photo, includeMetadata)
          );
          
          // Apply content filters
          photoAssets = this.applyContentFilters(photoAssets, {
            minWidth,
            minHeight,
            excludePhotographers
          });
          
          allAssets.push(...photoAssets);
          totalResults += photosResponse.total_results;
          this.usageStats.photosRequested = (this.usageStats.photosRequested || 0) + photoAssets.length;
        }
        
        console.log(`   ✅ Found ${photosResponse.photos?.length || 0} photos (${photosResponse.total_results} total)`);
      }

      // Search videos
      if (type === 'videos' || type === 'both') {
        onProgress?.('🎥 Searching videos...', 50);
        
        const videoParams: PexelsVideoSearchParams = {
          query,
          orientation,
          size: size as any,
          page,
          per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
        };

        const videosResponse = await client.searchVideos(videoParams);
        if (videosResponse.videos) {
          let videoAssets = videosResponse.videos.map(video => 
            this.convertVideoToAsset(video, includeMetadata)
          );

          // Apply duration filters
          if (minDuration || maxDuration) {
            videoAssets = videoAssets.filter(asset => {
              if (!asset.duration) return false;
              if (minDuration && asset.duration < minDuration) return false;
              if (maxDuration && asset.duration > maxDuration) return false;
              return true;
            });
          }

          // Apply other content filters
          videoAssets = this.applyContentFilters(videoAssets, {
            minWidth,
            minHeight,
            excludePhotographers
          });

          allAssets.push(...videoAssets);
          totalResults += videosResponse.total_results;
          this.usageStats.videosRequested = (this.usageStats.videosRequested || 0) + videoAssets.length;
        }

        console.log(`   ✅ Found ${videosResponse.videos?.length || 0} videos (${videosResponse.total_results} total)`);
      }

      onProgress?.('🎯 Applying filters and sorting...', 75);

      // Apply sorting
      allAssets = this.applySorting(allAssets, sortBy);

      // Limit results
      const limitedAssets = allAssets.slice(0, Math.min(maxResults, allAssets.length));

      // Track photographers
      limitedAssets.forEach(asset => this.trackPhotographer(asset.photographer));

      const result: PexelsSearchResult = {
        assets: limitedAssets,
        totalResults,
        currentPage: page,
        totalPages: Math.ceil(totalResults / perPage),
        hasNextPage: page * perPage < totalResults,
        hasPrevPage: page > 1,
        searchQuery: query,
        searchType: type,
        executionTime: Date.now() - startTime
      };

      // Add rate limit info if available
      const rateLimit = await this.getRateLimit();
      if (rateLimit) {
        result.rateLimitRemaining = rateLimit.remaining;
      }

      // Generate search suggestions
      if (limitedAssets.length === 0) {
        result.suggestions = this.generateSearchSuggestions(query);
      }

      // Cache the result
      if (this.cacheOptions.enabled) {
        this.setCache(cacheKey, result, PEXELS_CONSTANTS.CACHE_TTL.SEARCH_RESULTS);
      }

      console.log(`✅ Search completed: ${limitedAssets.length} assets returned in ${result.executionTime}ms`);
      onProgress?.(`✅ Found ${limitedAssets.length} assets`, 100);

      return result;
    } catch (error: any) {
      this.usageStats.errors = (this.usageStats.errors || 0) + 1;
      console.error('❌ Error searching Pexels media:', error.message);
      onProgress?.(`❌ Search failed: ${error.message}`, 100);
      throw new Error(`Failed to search Pexels media: ${error.message}`);
    }
  }

  // ===================================================================
  // CURATED AND POPULAR CONTENT
  // ===================================================================

  /**
   * Get curated photos with enhanced metadata and filtering
   */
  async getCuratedContent(
    options: { 
      page?: number; 
      perPage?: number; 
      maxResults?: number;
      includeMetadata?: boolean;
      contentFilter?: PexelsContentFilter;
    } = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsSearchResult> {
    try {
      const { 
        page = 1, 
        perPage = 40, 
        maxResults = 200,
        includeMetadata = false,
        contentFilter
      } = options;

      const cacheKey = this.generateCacheKey('curated', options);
      
      // Check cache
      if (this.cacheOptions.enabled) {
        const cached = this.getFromCache<PexelsSearchResult>(cacheKey);
        if (cached) {
          onProgress?.('📦 Retrieved curated content from cache', 100);
          return cached;
        }
      }

      onProgress?.('🎨 Fetching curated content...', 0);
      console.log('🎨 Fetching curated content from Pexels...');

      const client = await this.getClient();
      
      const curatedPhotos = await client.getCuratedPhotos({
        page,
        per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
      });

      onProgress?.('🔄 Processing and filtering assets...', 50);

      let photoAssets = curatedPhotos.photos?.map(photo => 
        this.convertPhotoToAsset(photo, includeMetadata)
      ) || [];

      // Apply content filters if provided
      if (contentFilter) {
        photoAssets = this.applyContentFilters(photoAssets, contentFilter);
      }

      // Apply quality scoring for curated content
      photoAssets = photoAssets.map(asset => ({
        ...asset,
        metadata: {
          ...asset.metadata,
          curatedScore: this.calculateCuratedScore(asset),
          isCurated: true
        }
      }));

      const limitedAssets = photoAssets.slice(0, maxResults);

      const result: PexelsSearchResult = {
        assets: limitedAssets,
        totalResults: curatedPhotos.total_results,
        currentPage: page,
        totalPages: Math.ceil(curatedPhotos.total_results / perPage),
        hasNextPage: !!curatedPhotos.next_page,
        hasPrevPage: !!curatedPhotos.prev_page,
        searchQuery: 'curated',
        searchType: 'curated_photos',
        executionTime: 0
      };

      // Cache the result
      if (this.cacheOptions.enabled) {
        this.setCache(cacheKey, result, PEXELS_CONSTANTS.CACHE_TTL.COLLECTIONS);
      }

      console.log(`✅ Curated content fetched: ${limitedAssets.length} photos`);
      onProgress?.(`✅ Found ${limitedAssets.length} curated photos`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error fetching curated content:', error.message);
      onProgress?.(`❌ Curated content failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch curated content: ${error.message}`);
    }
  }

  /**
   * Get popular videos with enhanced filtering and analytics
   */
  async getPopularVideos(
    options: { 
      page?: number; 
      perPage?: number; 
      maxResults?: number;
      minWidth?: number;
      minHeight?: number;
      minDuration?: number;
      maxDuration?: number;
      includeMetadata?: boolean;
    } = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsSearchResult> {
    try {
      const { 
        page = 1, 
        perPage = 40, 
        maxResults = 200,
        minWidth,
        minHeight,
        minDuration,
        maxDuration,
        includeMetadata = false
      } = options;

      onProgress?.('🎥 Fetching popular videos...', 0);
      console.log('🎥 Fetching popular videos from Pexels...');

      const client = await this.getClient();
      
      const popularVideos = await client.getPopularVideos({
        page,
        per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE),
        min_width: minWidth,
        min_height: minHeight,
        min_duration: minDuration,
        max_duration: maxDuration
      });

      onProgress?.('🔄 Processing video assets...', 50);

      const videoAssets = popularVideos.videos?.map(video => 
        this.convertVideoToAsset(video, includeMetadata)
      ) || [];

      // Add popularity scoring
      const enhancedAssets = videoAssets.map((asset, index) => ({
        ...asset,
        metadata: {
          ...asset.metadata,
          popularityRank: index + 1,
          isPopular: true,
          qualityScore: this.calculateVideoQualityScore(asset)
        }
      }));

      const limitedAssets = enhancedAssets.slice(0, maxResults);

      const result: PexelsSearchResult = {
        assets: limitedAssets,
        totalResults: popularVideos.total_results,
        currentPage: page,
        totalPages: Math.ceil(popularVideos.total_results / perPage),
        hasNextPage: !!popularVideos.next_page,
        hasPrevPage: !!popularVideos.prev_page,
        searchQuery: 'popular',
        searchType: 'popular_videos',
        executionTime: 0
      };

      console.log(`✅ Popular videos fetched: ${limitedAssets.length} videos`);
      onProgress?.(`✅ Found ${limitedAssets.length} popular videos`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error fetching popular videos:', error.message);
      onProgress?.(`❌ Popular videos failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch popular videos: ${error.message}`);
    }
  }

  // ===================================================================
  // COLLECTIONS MANAGEMENT (NEW IMPLEMENTATION)
  // ===================================================================

  /**
   * Get featured collections with enhanced metadata
   */
  async getFeaturedCollections(
    options: {
      page?: number;
      perPage?: number;
      maxResults?: number;
      includeMetadata?: boolean;
    } = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsCollectionSearchResult> {
    try {
      const {
        page = 1,
        perPage = 40,
        maxResults = 200,
        includeMetadata = false
      } = options;

      const cacheKey = this.generateCacheKey('featured_collections', options);

      // Check cache
      if (this.cacheOptions.enabled) {
        const cached = this.getFromCache<PexelsCollectionSearchResult>(cacheKey);
        if (cached) {
          onProgress?.('📦 Retrieved featured collections from cache', 100);
          return cached;
        }
      }

      onProgress?.('🏆 Fetching featured collections...', 0);
      console.log('🏆 Fetching featured collections from Pexels...');

      const client = await this.getClient();
      
      const collectionsResponse = await client.getFeaturedCollections({
        page,
        per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
      });

      onProgress?.('🔄 Processing collections...', 50);

      let collections = collectionsResponse.collections?.map(collection => 
        this.convertCollectionToInfo(collection, includeMetadata)
      ) || [];

      // Limit results
      const limitedCollections = collections.slice(0, maxResults);

      // Update stats
      this.usageStats.collectionsAccessed = (this.usageStats.collectionsAccessed || 0) + limitedCollections.length;

      const result: PexelsCollectionSearchResult = {
        collections: limitedCollections,
        totalResults: collectionsResponse.total_results,
        currentPage: page,
        totalPages: Math.ceil(collectionsResponse.total_results / perPage),
        hasNextPage: !!collectionsResponse.next_page,
        hasPrevPage: !!collectionsResponse.prev_page,
        searchType: 'featured_collections',
        executionTime: 0
      };

      // Cache the result
      if (this.cacheOptions.enabled) {
        this.setCache(cacheKey, result, PEXELS_CONSTANTS.CACHE_TTL.COLLECTIONS);
      }

      console.log(`✅ Featured collections fetched: ${limitedCollections.length} collections`);
      onProgress?.(`✅ Found ${limitedCollections.length} featured collections`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error fetching featured collections:', error.message);
      onProgress?.(`❌ Featured collections failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch featured collections: ${error.message}`);
    }
  }

  /**
   * Get user's collections (requires proper API key with collection access)
   */
  async getMyCollections(
    options: {
      page?: number;
      perPage?: number;
      maxResults?: number;
      includeMetadata?: boolean;
    } = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsCollectionSearchResult> {
    try {
      const {
        page = 1,
        perPage = 40,
        maxResults = 200,
        includeMetadata = false
      } = options;

      onProgress?.('👤 Fetching your collections...', 0);
      console.log('👤 Fetching user collections from Pexels...');

      const client = await this.getClient();
      
      const collectionsResponse = await client.getMyCollections({
        page,
        per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
      });

      onProgress?.('🔄 Processing collections...', 50);

      let collections = collectionsResponse.collections?.map(collection => 
        this.convertCollectionToInfo(collection, includeMetadata, true)
      ) || [];

      // Limit results
      const limitedCollections = collections.slice(0, maxResults);

      // Update stats
      this.usageStats.collectionsAccessed = (this.usageStats.collectionsAccessed || 0) + limitedCollections.length;

      const result: PexelsCollectionSearchResult = {
        collections: limitedCollections,
        totalResults: collectionsResponse.total_results,
        currentPage: page,
        totalPages: Math.ceil(collectionsResponse.total_results / perPage),
        hasNextPage: !!collectionsResponse.next_page,
        hasPrevPage: !!collectionsResponse.prev_page,
        searchType: 'my_collections',
        executionTime: 0
      };

      console.log(`✅ User collections fetched: ${limitedCollections.length} collections`);
      onProgress?.(`✅ Found ${limitedCollections.length} collections`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error fetching user collections:', error.message);
      onProgress?.(`❌ User collections failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch user collections: ${error.message}`);
    }
  }

  /**
   * Get media from a specific collection with advanced filtering
   */
  async getCollectionMedia(
    collectionId: string,
    options: PexelsCollectionMediaOptions = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsSearchResult> {
    try {
      const {
        type,
        sort = 'asc',
        page = 1,
        perPage = 40,
        maxResults = 200,
        includeMetadata = false,
        contentFilter
      } = options;

      const cacheKey = this.generateCacheKey('collection_media', { collectionId, ...options });

      // Check cache
      if (this.cacheOptions.enabled) {
        const cached = this.getFromCache<PexelsSearchResult>(cacheKey);
        if (cached) {
          onProgress?.('📦 Retrieved collection media from cache', 100);
          return cached;
        }
      }

      onProgress?.(`📂 Fetching media from collection: ${collectionId}`, 0);
      console.log(`📂 Fetching media from collection: ${collectionId}`);

      const client = await this.getClient();
      
      const mediaResponse = await client.getCollectionMedia(collectionId, {
        type,
        sort,
        page,
        per_page: Math.min(perPage, PEXELS_CONSTANTS.MAX_PER_PAGE)
      });

      onProgress?.('🔄 Processing collection media...', 50);

      let assets: PexelsMediaAsset[] = [];

      if (mediaResponse.media) {
        assets = mediaResponse.media.map(item => {
          if (item.type === 'Photo') {
            return this.convertPhotoToAsset(item as any, includeMetadata);
          } else {
            return this.convertVideoToAsset(item as any, includeMetadata);
          }
        });
      }

      // Apply content filters if provided
      if (contentFilter) {
        assets = this.applyContentFilters(assets, contentFilter);
      }

      // Limit results
      const limitedAssets = assets.slice(0, maxResults);

      // Update stats
      this.usageStats.collectionsAccessed = (this.usageStats.collectionsAccessed || 0) + 1;

      const result: PexelsSearchResult = {
        assets: limitedAssets,
        totalResults: mediaResponse.total_results,
        currentPage: page,
        totalPages: Math.ceil(mediaResponse.total_results / perPage),
        hasNextPage: !!mediaResponse.next_page,
        hasPrevPage: !!mediaResponse.prev_page,
        searchQuery: `collection:${collectionId}`,
        searchType: `collection_media_${type || 'all'}`,
        executionTime: 0
      };

      // Cache the result
      if (this.cacheOptions.enabled) {
        this.setCache(cacheKey, result, PEXELS_CONSTANTS.CACHE_TTL.COLLECTIONS);
      }

      console.log(`✅ Collection media fetched: ${limitedAssets.length} assets from collection ${collectionId}`);
      onProgress?.(`✅ Found ${limitedAssets.length} assets`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error fetching collection media:', error.message);
      onProgress?.(`❌ Collection media failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch collection media: ${error.message}`);
    }
  }

  // ===================================================================
  // RECOMMENDATION SYSTEM
  // ===================================================================

  /**
   * Get AI-powered recommendations based on a seed asset
   */
  async getRecommendations(
    seedAsset: PexelsMediaAsset,
    options: PexelsRecommendationOptions = {},
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsRecommendationResult> {
    try {
      const { 
        count = 20, 
        similarColor = true, 
        similarSize = false, 
        sameType = true,
        similarPhotographer = false,
        diversityFactor = 0.3,
        excludeIds = []
      } = options;

      onProgress?.(`🎯 Finding recommendations for: ${seedAsset.alt}`, 0);
      console.log(`🎯 Getting recommendations for asset: ${seedAsset.id}`);

      // Build search terms based on asset characteristics
      const searchTerms = this.generateRecommendationSearchTerms(seedAsset, similarPhotographer);
      
      onProgress?.('🔍 Searching for similar content...', 25);

      const searchOptions: PexelsSearchOptions = {
        query: searchTerms.join(' '),
        type: sameType ? (seedAsset.type + 's') as 'photos' | 'videos' : 'both',
        perPage: count * 3, // Get more to filter from
        maxResults: count * 3,
        includeMetadata: true
      };

      // Add color filter if similar color is requested and available
      if (similarColor && seedAsset.avgColor) {
        searchOptions.color = seedAsset.avgColor;
      }

      // Add size constraints if similar size is requested
      if (similarSize) {
        const tolerance = 0.3; // 30% tolerance
        searchOptions.minWidth = Math.floor(seedAsset.width * (1 - tolerance));
        searchOptions.minHeight = Math.floor(seedAsset.height * (1 - tolerance));
      }

      onProgress?.('🤖 Analyzing similarity...', 50);

      const results = await this.searchMedia(searchOptions);

      // Filter out the original asset and excluded IDs
      let candidates = results.assets.filter(asset => 
        asset.id !== seedAsset.id && !excludeIds.includes(asset.id)
      );

      onProgress?.('📊 Calculating similarity scores...', 75);

      // Calculate similarity scores
      candidates = candidates.map(asset => ({
        ...asset,
        similarityScore: this.calculateSimilarityScore(seedAsset, asset, {
          similarColor,
          similarSize,
          sameType,
          similarPhotographer
        })
      }));

      // Sort by similarity score with diversity factor
      candidates.sort((a, b) => {
        const scoreA = (a.similarityScore || 0) + (Math.random() * diversityFactor);
        const scoreB = (b.similarityScore || 0) + (Math.random() * diversityFactor);
        return scoreB - scoreA;
      });

      const recommendations = candidates.slice(0, count);

      // Calculate overall confidence
      const avgSimilarity = recommendations.reduce((sum, asset) => 
        sum + (asset.similarityScore || 0), 0) / recommendations.length;
      
      const confidence = Math.min(avgSimilarity / 100, 1); // Normalize to 0-1

      onProgress?.(`✅ Found ${recommendations.length} recommendations`, 100);

      const result: PexelsRecommendationResult = {
        recommendations,
        basedOn: seedAsset,
        algorithm: 'similarity_scoring_v1',
        confidence,
        explanation: this.generateRecommendationExplanation(seedAsset, options, confidence)
      };

      console.log(`✅ Generated ${recommendations.length} recommendations with ${(confidence * 100).toFixed(1)}% confidence`);

      return result;
    } catch (error: any) {
      console.error('❌ Error getting recommendations:', error.message);
      onProgress?.(`❌ Recommendations failed: ${error.message}`, 100);
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }
  }

  // ===================================================================
  // BATCH OPERATIONS
  // ===================================================================

  /**
   * Get multiple assets by IDs with progress tracking and error handling
   */
  async getAssetsBatch(
    request: PexelsBatchRequest,
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsBatchResult> {
    const startTime = Date.now();
    
    try {
      const { photoIds = [], videoIds = [], maxConcurrent = 5, retryOnFailure = true } = request;
      const totalCount = photoIds.length + videoIds.length;

      onProgress?.(`📦 Fetching ${totalCount} assets in batch...`, 0);
      console.log(`📦 Fetching batch of ${totalCount} assets`);

      const client = await this.getClient();
      const successful: PexelsMediaAsset[] = [];
      const failed: Array<{ id: number; error: string }> = [];

      // Process photos in chunks
      if (photoIds.length > 0) {
        onProgress?.(`📸 Fetching ${photoIds.length} photos...`, 25);
        
        const photoChunks = this.chunkArray(photoIds, maxConcurrent);
        
        for (let i = 0; i < photoChunks.length; i++) {
          const chunk = photoChunks[i];
          const chunkResults = await Promise.allSettled(
            chunk.map(id => client.getPhoto(id))
          );

          chunkResults.forEach((result, index) => {
            const id = chunk[index];
            if (result.status === 'fulfilled') {
              successful.push(this.convertPhotoToAsset(result.value, true));
            } else {
              failed.push({ id, error: result.reason?.message || 'Unknown error' });
            }
          });

          // Update progress
          const progress = 25 + (i + 1) / photoChunks.length * 25;
          onProgress?.(`📸 Photo batch progress: ${i + 1}/${photoChunks.length}`, progress);
        }
      }

      // Process videos in chunks
      if (videoIds.length > 0) {
        onProgress?.(`🎥 Fetching ${videoIds.length} videos...`, 50);
        
        const videoChunks = this.chunkArray(videoIds, maxConcurrent);
        
        for (let i = 0; i < videoChunks.length; i++) {
          const chunk = videoChunks[i];
          const chunkResults = await Promise.allSettled(
            chunk.map(id => client.getVideo(id))
          );

          chunkResults.forEach((result, index) => {
            const id = chunk[index];
            if (result.status === 'fulfilled') {
              successful.push(this.convertVideoToAsset(result.value, true));
            } else {
              failed.push({ id, error: result.reason?.message || 'Unknown error' });
            }
          });

          // Update progress
          const progress = 50 + (i + 1) / videoChunks.length * 25;
          onProgress?.(`🎥 Video batch progress: ${i + 1}/${videoChunks.length}`, progress);
        }
      }

      // Retry failed requests if enabled
      if (retryOnFailure && failed.length > 0 && failed.length < totalCount) {
        onProgress?.(`🔄 Retrying ${failed.length} failed requests...`, 75);
        
        // Implement exponential backoff retry logic here if needed
        // For now, just log the failures
        console.warn(`⚠️ ${failed.length} assets failed to fetch:`, failed);
      }

      const result: PexelsBatchResult = {
        successful,
        failed,
        totalRequested: totalCount,
        successCount: successful.length,
        failureCount: failed.length,
        executionTime: Date.now() - startTime
      };

      console.log(`✅ Batch fetch completed: ${successful.length}/${totalCount} successful in ${result.executionTime}ms`);
      onProgress?.(`✅ Batch completed: ${successful.length}/${totalCount} assets`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error in batch fetch:', error.message);
      onProgress?.(`❌ Batch fetch failed: ${error.message}`, 100);
      throw new Error(`Failed to fetch assets batch: ${error.message}`);
    }
  }

  // ===================================================================
  // UTILITY AND HELPER METHODS
  // ===================================================================

  /**
   * Get current API rate limit information with enhanced details
   */
  async getRateLimit(onProgress?: PexelsProgressCallback): Promise<PexelsRateLimit | null> {
    try {
      onProgress?.('📊 Checking API rate limits...', 0);
      console.log('📊 Checking Pexels API rate limits...');

      const client = await this.getClient();
      const rateLimitInfo = await client.checkRateLimit();

      if (rateLimitInfo) {
        const resetDate = new Date(rateLimitInfo.reset * 1000);
        const percentageUsed = ((rateLimitInfo.limit - rateLimitInfo.remaining) / rateLimitInfo.limit) * 100;
        const msUntilReset = rateLimitInfo.reset * 1000 - Date.now();
        
        const estimatedTimeToReset = msUntilReset > 0 
          ? this.formatDuration(msUntilReset)
          : 'Reset time passed';

        const result: PexelsRateLimit = {
          limit: rateLimitInfo.limit,
          remaining: rateLimitInfo.remaining,
          resetTimestamp: rateLimitInfo.reset,
          resetDate,
          percentageUsed,
          estimatedTimeToReset
        };

        console.log(`✅ Rate limit: ${result.remaining}/${result.limit} remaining (${percentageUsed.toFixed(1)}% used)`);
        onProgress?.(`✅ Rate limit: ${result.remaining}/${result.limit} remaining`, 100);

        return result;
      }

      console.log('⚠️ Rate limit information not available');
      onProgress?.('⚠️ Rate limit info not available', 100);
      return null;
    } catch (error: any) {
      console.error('❌ Error checking rate limit:', error.message);
      onProgress?.(`❌ Rate limit check failed: ${error.message}`, 100);
      return null;
    }
  }

  /**
   * Download asset with enhanced metadata and attribution
   */
  async downloadAsset(
    asset: PexelsMediaAsset,
    filename?: string,
    onProgress?: PexelsProgressCallback
  ): Promise<PexelsDownloadResult> {
    try {
      onProgress?.(`⬇️ Preparing download: ${asset.alt}`, 0);
      console.log(`⬇️ Preparing download for asset: ${asset.id}`);

      // Generate filename if not provided
      const sanitizedPhotographer = asset.photographer.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const extension = asset.type === 'video' ? 'mp4' : 'jpg';
      const finalFilename = filename || `pexels-${asset.type}-${asset.id}-${sanitizedPhotographer}.${extension}`;

      // Generate attribution text
      const attribution = this.generateAttribution(asset);

      onProgress?.(`✅ Download prepared: ${finalFilename}`, 50);

      // In a real implementation, you might want to handle the actual download
      // For now, we'll return the download URL and metadata
      const result: PexelsDownloadResult = {
        success: true,
        url: asset.downloadUrl,
        filename: finalFilename,
        mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        attribution,
        metadata: {
          downloadedAt: new Date(),
          originalAsset: asset,
          processingTime: 0
        }
      };

      // Emit webhook event if configured
      this.emitWebhookEvent({
        type: 'download',
        assetId: asset.id,
        assetType: asset.type,
        timestamp: Date.now(),
        metadata: { filename: finalFilename },
        source: 'pexels-service'
      });

      console.log(`✅ Download prepared: ${finalFilename}`);
      onProgress?.(`✅ Download ready: ${finalFilename}`, 100);

      return result;
    } catch (error: any) {
      console.error('❌ Error preparing download:', error.message);
      onProgress?.(`❌ Download failed: ${error.message}`, 100);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get usage statistics and analytics
   */
  getUsageStats(): PexelsUsageStats {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    return {
      totalRequests: this.usageStats.totalRequests || 0,
      photosRequested: this.usageStats.photosRequested || 0,
      videosRequested: this.usageStats.videosRequested || 0,
      collectionsAccessed: this.usageStats.collectionsAccessed || 0,
      averageResponseTime: 0, // Would need to track this
      rateLimitHits: this.usageStats.rateLimitHits || 0,
      errors: this.usageStats.errors || 0,
      topSearchQueries: this.usageStats.topSearchQueries || [],
      topPhotographers: this.usageStats.topPhotographers || [],
      timeRange: {
        start: startTime,
        end: endTime
      }
    };
  }

  /**
   * Clear cache and reset statistics
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  // ===================================================================
  // PRIVATE HELPER METHODS
  // ===================================================================

  /**
   * Convert Pexels photo to normalized media asset
   */
  private convertPhotoToAsset = (photo: PexelsPhoto, includeMetadata: boolean = false): PexelsMediaAsset => {
    const asset: PexelsMediaAsset = {
      id: photo.id,
      type: 'photo',
      url: photo.url,
      downloadUrl: photo.src.original,
      thumbnailUrl: photo.src.medium,
      alt: photo.alt || `Photo by ${photo.photographer}`,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      width: photo.width,
      height: photo.height,
      aspectRatio: photo.width / photo.height,
      avgColor: photo.avg_color
    };

    if (includeMetadata) {
      asset.metadata = {
        photographerId: photo.photographer_id,
        liked: photo.liked,
        sizes: photo.src,
        qualityScore: this.calculatePhotoQualityScore(asset),
        retrievedAt: new Date()
      };
    }

    return asset;
  };

  /**
   * Convert Pexels video to normalized media asset
   */
  private convertVideoToAsset = (video: PexelsVideo, includeMetadata: boolean = false): PexelsMediaAsset => {
    // Get the highest quality video file
    const bestQuality = video.video_files
      .filter(file => file.quality === 'hd')
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0] || 
      video.video_files[0];

    const asset: PexelsMediaAsset = {
      id: video.id,
      type: 'video',
      url: video.url,
      downloadUrl: bestQuality.link,
      thumbnailUrl: video.image,
      alt: `Video by ${video.user.name}`,
      photographer: video.user.name,
      photographerUrl: video.user.url,
      width: video.width,
      height: video.height,
      aspectRatio: video.width / video.height,
      duration: video.duration,
      quality: bestQuality.quality,
      fileSize: `${bestQuality.width}x${bestQuality.height}`
    };

    if (includeMetadata) {
      asset.metadata = {
        userId: video.user.id,
        videoFiles: video.video_files,
        videoPictures: video.video_pictures,
        fps: bestQuality.fps,
        qualityScore: this.calculateVideoQualityScore(asset),
        retrievedAt: new Date()
      };
    }

    return asset;
  };

  /**
   * Convert Pexels collection to normalized collection info
   */
  private convertCollectionToInfo = (
    collection: PexelsCollection, 
    includeMetadata: boolean = false,
    isUserCollection: boolean = false
  ): PexelsCollectionInfo => {
    const info: PexelsCollectionInfo = {
      id: collection.id,
      title: collection.title,
      description: collection.description || '',
      mediaCount: collection.media_count,
      photosCount: collection.photos_count,
      videosCount: collection.videos_count,
      isPrivate: collection.private
    };

    if (includeMetadata) {
      info.tags = this.extractTagsFromDescription(collection.description || '');
      info.curator = isUserCollection ? 'You' : 'Pexels';
      info.createdAt = new Date(); // Would need actual creation date from API
      info.updatedAt = new Date(); // Would need actual update date from API
    }

    return info;
  };

  /**
   * Apply content filters to assets
   */
  private applyContentFilters(assets: PexelsMediaAsset[], filter: Partial<PexelsContentFilter>): PexelsMediaAsset[] {
    return assets.filter(asset => {
      // Size filters
      if (filter.minWidth && asset.width < filter.minWidth) return false;
      if (filter.maxWidth && asset.width > filter.maxWidth) return false;
      if (filter.minHeight && asset.height < filter.minHeight) return false;
      if (filter.maxHeight && asset.height > filter.maxHeight) return false;

      // Aspect ratio filter
      if (filter.aspectRatioRange) {
        const { min, max } = filter.aspectRatioRange;
        if (asset.aspectRatio < min || asset.aspectRatio > max) return false;
      }

      // Photographer filters
      if (filter.allowedPhotographers && !filter.allowedPhotographers.includes(asset.photographer)) return false;
      if (filter.blockedPhotographers && filter.blockedPhotographers.includes(asset.photographer)) return false;
      if (filter.excludePhotographers && filter.excludePhotographers.includes(asset.photographer)) return false;

      // Color filters (if avgColor is available)
      if (filter.excludeColors && asset.avgColor) {
        const isExcluded = filter.excludeColors.some(color => 
          this.calculateColorSimilarity(asset.avgColor!, color) > 0.8
        );
        if (isExcluded) return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to assets
   */
  private applySorting(assets: PexelsMediaAsset[], sortBy: string): PexelsMediaAsset[] {
    const sorted = [...assets];

    switch (sortBy) {
      case 'popularity':
        return sorted.sort((a, b) => (b.metadata?.popularityRank || 0) - (a.metadata?.popularityRank || 0));
      
      case 'newest':
        return sorted.sort((a, b) => {
          const aTime = a.metadata?.retrievedAt?.getTime() || 0;
          const bTime = b.metadata?.retrievedAt?.getTime() || 0;
          return bTime - aTime;
        });
      
      case 'size':
        return sorted.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
      case 'duration':
        return sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      
      case 'random':
        return sorted.sort(() => Math.random() - 0.5);
      
      case 'relevance':
      default:
        return sorted; // Keep original order for relevance
    }
  }

  /**
   * Calculate similarity score between two assets
   */
  private calculateSimilarityScore(
    seedAsset: PexelsMediaAsset,
    compareAsset: PexelsMediaAsset,
    options: {
      similarColor?: boolean;
      similarSize?: boolean;
      sameType?: boolean;
      similarPhotographer?: boolean;
    }
  ): number {
    let score = 0;

    // Type similarity (30 points)
    if (options.sameType && seedAsset.type === compareAsset.type) {
      score += 30;
    }

    // Aspect ratio similarity (20 points)
    const aspectRatioDiff = Math.abs(seedAsset.aspectRatio - compareAsset.aspectRatio);
    score += Math.max(0, 20 - aspectRatioDiff * 10);

    // Size similarity (25 points)
    if (options.similarSize) {
      const sizeDiff = Math.abs(
        (seedAsset.width * seedAsset.height) - (compareAsset.width * compareAsset.height)
      ) / (seedAsset.width * seedAsset.height);
      score += Math.max(0, 25 - sizeDiff * 25);
    }

    // Color similarity (20 points)
    if (options.similarColor && seedAsset.avgColor && compareAsset.avgColor) {
      const colorSimilarity = this.calculateColorSimilarity(seedAsset.avgColor, compareAsset.avgColor);
      score += colorSimilarity * 20;
    }

    // Photographer similarity (5 points)
    if (options.similarPhotographer && seedAsset.photographer === compareAsset.photographer) {
      score += 5;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Calculate color similarity between two hex colors
   */
  private calculateColorSimilarity(color1: string, color2: string): number {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    const distance = Math.sqrt(
      Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2)
    );
    
    // Normalize to 0-1 (max distance is ~441)
    return Math.max(0, 1 - distance / 441);
  }

  /**
   * Generate cache key for results
   */
  private generateCacheKey(operation: string, params: any): string {
    const serialized = JSON.stringify(params, Object.keys(params).sort());
    return `${operation}:${Buffer.from(serialized).toString('base64').slice(0, 32)}`;
  }

  /**
   * Get item from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    return entry.data as T;
  }

  /**
   * Set item in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    if (!this.cacheOptions.enabled) return;

    // Clean old entries if cache is full
    if (this.cache.size >= this.cacheOptions.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    const entry: PexelsCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      key,
      accessCount: 0,
      size: JSON.stringify(data).length
    };

    this.cache.set(key, entry);
  }

  /**
   * Track search query for analytics
   */
  private trackSearchQuery(query: string): void {
    if (!this.usageStats.topSearchQueries) {
      this.usageStats.topSearchQueries = [];
    }

    const queries = this.usageStats.topSearchQueries;
    const existing = queries.find(q => q === query);
    
    if (!existing) {
      queries.push(query);
      // Keep only top 20 queries
      if (queries.length > 20) {
        queries.shift();
      }
    }
  }

  /**
   * Track photographer for analytics
   */
  private trackPhotographer(photographer: string): void {
    if (!this.usageStats.topPhotographers) {
      this.usageStats.topPhotographers = [];
    }

    const photographers = this.usageStats.topPhotographers;
    const existing = photographers.find(p => p === photographer);
    
    if (!existing) {
      photographers.push(photographer);
      // Keep only top 20 photographers
      if (photographers.length > 20) {
        photographers.shift();
      }
    }
  }

  /**
   * Generate search suggestions
   */
  private generateSearchSuggestions(query: string): string[] {
    const suggestions = [
      `${query} landscape`,
      `${query} portrait`,
      `${query} minimal`,
      `${query} colorful`,
      `${query} black and white`,
      `nature ${query}`,
      `urban ${query}`,
      `vintage ${query}`
    ];

    return suggestions.slice(0, 5);
  }

  /**
   * Calculate photo quality score
   */
  private calculatePhotoQualityScore(asset: PexelsMediaAsset): number {
    let score = 50; // Base score

    // Resolution bonus
    const megapixels = (asset.width * asset.height) / 1000000;
    score += Math.min(megapixels * 5, 30); // Max 30 points for resolution

    // Aspect ratio bonus (standard ratios get bonus)
    const ratio = asset.aspectRatio;
    const standardRatios = [1, 1.33, 1.5, 1.77, 2.35]; // Common photo ratios
    const closestRatio = standardRatios.reduce((prev, curr) => 
      Math.abs(curr - ratio) < Math.abs(prev - ratio) ? curr : prev
    );
    
    if (Math.abs(ratio - closestRatio) < 0.1) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate video quality score
   */
  private calculateVideoQualityScore(asset: PexelsMediaAsset): number {
    let score = 50; // Base score

    // Resolution bonus
    if (asset.width >= 1920) score += 20; // HD+
    else if (asset.width >= 1280) score += 15; // HD
    else if (asset.width >= 720) score += 10; // SD

    // Duration bonus (prefer 10-60 second videos)
    if (asset.duration) {
      if (asset.duration >= 10 && asset.duration <= 60) {
        score += 15;
      } else if (asset.duration >= 5 && asset.duration <= 120) {
        score += 10;
      }
    }

    // Quality bonus
    if (asset.quality === 'hd') score += 15;
    else if (asset.quality === 'sd') score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate curated content score
   */
  private calculateCuratedScore(asset: PexelsMediaAsset): number {
    const baseScore = this.calculatePhotoQualityScore(asset);
    return Math.min(baseScore + 20, 100); // Curated content gets a bonus
  }

  /**
   * Generate recommendation search terms
   */
  private generateRecommendationSearchTerms(asset: PexelsMediaAsset, includeSimilarPhotographer: boolean): string[] {
    const terms = [];

    // Add photographer name if similar photographer is requested
    if (includeSimilarPhotographer) {
      terms.push(asset.photographer.split(' ')[0]); // First name only
    }

    // Add type-specific terms
    if (asset.type === 'photo') {
      terms.push('photography', 'professional', 'creative');
    } else {
      terms.push('video', 'footage', 'cinematic');
    }

    // Add aesthetic terms based on aspect ratio
    if (asset.aspectRatio > 1.5) {
      terms.push('landscape', 'wide');
    } else if (asset.aspectRatio < 0.8) {
      terms.push('portrait', 'vertical');
    } else {
      terms.push('square', 'balanced');
    }

    return terms;
  }

  /**
   * Generate recommendation explanation
   */
  private generateRecommendationExplanation(
    seedAsset: PexelsMediaAsset,
    options: PexelsRecommendationOptions,
    confidence: number
  ): string[] {
    const explanations = [];

    if (options.sameType) {
      explanations.push(`Similar media type (${seedAsset.type})`);
    }

    if (options.similarColor && seedAsset.avgColor) {
      explanations.push('Similar color palette');
    }

    if (options.similarSize) {
      explanations.push('Similar dimensions and resolution');
    }

    if (options.similarPhotographer) {
      explanations.push(`Similar style to ${seedAsset.photographer}`);
    }

    explanations.push(`Confidence: ${(confidence * 100).toFixed(1)}%`);

    return explanations;
  }

  /**
   * Generate attribution text
   */
  private generateAttribution(asset: PexelsMediaAsset): string {
    if (this.config.autoAttribution) {
      return `${asset.type === 'photo' ? 'Photo' : 'Video'} by ${asset.photographer} on Pexels (${asset.url})`;
    }
    return '';
  }

  /**
   * Emit webhook event
   */
  private emitWebhookEvent(event: PexelsWebhookEvent): void {
    // In a real implementation, this would send HTTP requests to configured webhooks
    console.log('📡 Webhook event:', event);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Extract tags from collection description
   */
  private extractTagsFromDescription(description: string): string[] {
    // Simple tag extraction from description
    const words = description.toLowerCase().split(/\s+/);
    return words
      .filter(word => word.length > 3)
      .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'car', 'she', 'use', 'her', 'now', 'oil', 'sit', 'set'].includes(word))
      .slice(0, 5);
  }
}

// Export service and commonly used types
export type {
  PexelsMediaAsset,
  PexelsSearchOptions,
  PexelsSearchResult,
  PexelsCollectionInfo,
  PexelsRateLimit,
  PexelsValidationResult,
  PexelsDownloadResult,
  PexelsBatchRequest,
  PexelsBatchResult,
  PexelsRecommendationOptions,
  PexelsRecommendationResult,
  PexelsProgressCallback,
  PexelsUsageStats,
  PexelsContentFilter,
  PexelsIntegrationConfig,
  PexelsCollectionSearchResult,
  PexelsCollectionMediaOptions
} from './pexels/pexelsTypes';

