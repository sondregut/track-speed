/**
 * App Store Connect API Client
 *
 * Handles authentication and API requests to App Store Connect
 * https://developer.apple.com/documentation/appstoreconnectapi
 */

import * as jwt from 'jsonwebtoken';
import {
  AppStoreConnectConfig,
  APIResponse,
  APIErrorResponse,
  App,
  Build,
  BetaTester,
  BetaGroup,
  InAppPurchase,
  Subscription,
  SubscriptionGroup,
  PerfPowerMetric,
  DiagnosticSignature,
  CiProduct,
  CiWorkflow,
  CiBuildRun,
  AppStoreVersion,
  AppStoreVersionLocalization,
  AppInfo,
  AppInfoLocalization,
  AgeRatingDeclaration,
  CustomerReview,
  CustomerReviewResponse,
} from './types';

const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

export class AppStoreConnectClient {
  private config: AppStoreConnectConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: AppStoreConnectConfig) {
    this.config = config;
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Generate JWT token for API authentication
   * Tokens are valid for 20 minutes max
   */
  private generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 20 * 60; // 20 minutes

    const payload = {
      iss: this.config.issuerId,
      iat: now,
      exp: expiry,
      aud: 'appstoreconnect-v1',
    };

    const token = jwt.sign(payload, this.config.privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: this.config.keyId,
        typ: 'JWT',
      },
    });

    this.token = token;
    this.tokenExpiry = expiry;

    return token;
  }

  /**
   * Get valid token (generates new one if expired)
   */
  private getToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (!this.token || now >= this.tokenExpiry - 60) {
      return this.generateToken();
    }
    return this.token;
  }

  // ============================================
  // HTTP Methods
  // ============================================

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: object
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const token = this.getToken();

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = (await response.json()) as APIErrorResponse;
      const errorMessage = errorBody.errors?.[0]?.detail || response.statusText;
      throw new Error(`App Store Connect API Error: ${errorMessage}`);
    }

    // Some endpoints return empty response (204)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: object): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async patch<T>(path: string, body: object): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private async delete(path: string): Promise<void> {
    await this.request<void>('DELETE', path);
  }

  // ============================================
  // Apps
  // ============================================

  /**
   * List all apps
   */
  async listApps(): Promise<APIResponse<App[]>> {
    return this.get('/apps');
  }

  /**
   * Get app by bundle ID
   */
  async getAppByBundleId(bundleId: string): Promise<App | null> {
    const response = await this.get<APIResponse<App[]>>(
      `/apps?filter[bundleId]=${bundleId}`
    );
    return response.data[0] || null;
  }

  /**
   * Get app by ID
   */
  async getApp(appId: string): Promise<APIResponse<App>> {
    return this.get(`/apps/${appId}`);
  }

  // ============================================
  // TestFlight - Builds
  // ============================================

  /**
   * List builds for an app
   */
  async listBuilds(
    appId: string,
    options?: { limit?: number; processingState?: string }
  ): Promise<APIResponse<Build[]>> {
    let path = `/builds?filter[app]=${appId}`;
    if (options?.limit) path += `&limit=${options.limit}`;
    if (options?.processingState)
      path += `&filter[processingState]=${options.processingState}`;
    return this.get(path);
  }

  /**
   * Get build by ID
   */
  async getBuild(buildId: string): Promise<APIResponse<Build>> {
    return this.get(`/builds/${buildId}`);
  }

  /**
   * Get latest build for an app
   */
  async getLatestBuild(appId: string): Promise<Build | null> {
    const response = await this.listBuilds(appId, {
      limit: 1,
      processingState: 'VALID',
    });
    return response.data[0] || null;
  }

  // ============================================
  // TestFlight - Beta Groups
  // ============================================

  /**
   * List beta groups for an app
   */
  async listBetaGroups(appId: string): Promise<APIResponse<BetaGroup[]>> {
    return this.get(`/betaGroups?filter[app]=${appId}`);
  }

  /**
   * Create a beta group
   */
  async createBetaGroup(
    appId: string,
    name: string,
    options?: {
      isInternalGroup?: boolean;
      hasAccessToAllBuilds?: boolean;
      publicLinkEnabled?: boolean;
      feedbackEnabled?: boolean;
    }
  ): Promise<APIResponse<BetaGroup>> {
    return this.post('/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: {
          name,
          isInternalGroup: options?.isInternalGroup ?? false,
          hasAccessToAllBuilds: options?.hasAccessToAllBuilds ?? false,
          publicLinkEnabled: options?.publicLinkEnabled ?? false,
          feedbackEnabled: options?.feedbackEnabled ?? true,
        },
        relationships: {
          app: {
            data: { type: 'apps', id: appId },
          },
        },
      },
    });
  }

  /**
   * Add build to beta group
   */
  async addBuildToBetaGroup(
    betaGroupId: string,
    buildId: string
  ): Promise<void> {
    await this.post(`/betaGroups/${betaGroupId}/relationships/builds`, {
      data: [{ type: 'builds', id: buildId }],
    });
  }

  // ============================================
  // TestFlight - Beta Testers
  // ============================================

  /**
   * List beta testers
   */
  async listBetaTesters(options?: {
    email?: string;
    limit?: number;
  }): Promise<APIResponse<BetaTester[]>> {
    let path = '/betaTesters';
    const params: string[] = [];
    if (options?.email) params.push(`filter[email]=${options.email}`);
    if (options?.limit) params.push(`limit=${options.limit}`);
    if (params.length > 0) path += `?${params.join('&')}`;
    return this.get(path);
  }

  /**
   * Invite beta tester to a group
   */
  async inviteBetaTester(
    email: string,
    betaGroupId: string,
    options?: { firstName?: string; lastName?: string }
  ): Promise<APIResponse<BetaTester>> {
    return this.post('/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: {
          email,
          firstName: options?.firstName,
          lastName: options?.lastName,
        },
        relationships: {
          betaGroups: {
            data: [{ type: 'betaGroups', id: betaGroupId }],
          },
        },
      },
    });
  }

  /**
   * Remove beta tester from a group
   */
  async removeBetaTesterFromGroup(
    betaTesterId: string,
    betaGroupId: string
  ): Promise<void> {
    await this.delete(
      `/betaTesters/${betaTesterId}/relationships/betaGroups/${betaGroupId}`
    );
  }

  // ============================================
  // In-App Purchases
  // ============================================

  /**
   * List in-app purchases for an app
   */
  async listInAppPurchases(appId: string): Promise<APIResponse<InAppPurchase[]>> {
    return this.get(`/apps/${appId}/inAppPurchasesV2`);
  }

  /**
   * Get in-app purchase by ID
   */
  async getInAppPurchase(iapId: string): Promise<APIResponse<InAppPurchase>> {
    return this.get(`/inAppPurchasesV2/${iapId}`);
  }

  /**
   * Create in-app purchase
   */
  async createInAppPurchase(
    appId: string,
    productId: string,
    name: string,
    type: 'CONSUMABLE' | 'NON_CONSUMABLE' | 'NON_RENEWING_SUBSCRIPTION'
  ): Promise<APIResponse<InAppPurchase>> {
    return this.post('/inAppPurchasesV2', {
      data: {
        type: 'inAppPurchases',
        attributes: {
          name,
          productId,
          inAppPurchaseType: type,
          familySharable: false,
        },
        relationships: {
          app: {
            data: { type: 'apps', id: appId },
          },
        },
      },
    });
  }

  // ============================================
  // Subscriptions
  // ============================================

  /**
   * List subscription groups for an app
   */
  async listSubscriptionGroups(
    appId: string
  ): Promise<APIResponse<SubscriptionGroup[]>> {
    return this.get(`/apps/${appId}/subscriptionGroups`);
  }

  /**
   * Create subscription group
   */
  async createSubscriptionGroup(
    appId: string,
    referenceName: string
  ): Promise<APIResponse<SubscriptionGroup>> {
    return this.post('/subscriptionGroups', {
      data: {
        type: 'subscriptionGroups',
        attributes: {
          referenceName,
        },
        relationships: {
          app: {
            data: { type: 'apps', id: appId },
          },
        },
      },
    });
  }

  /**
   * List subscriptions in a group
   */
  async listSubscriptions(
    groupId: string
  ): Promise<APIResponse<Subscription[]>> {
    return this.get(`/subscriptionGroups/${groupId}/subscriptions`);
  }

  // ============================================
  // Analytics & Performance
  // ============================================

  /**
   * Get performance metrics for an app
   */
  async getPerfPowerMetrics(
    appId: string,
    metricType?: string
  ): Promise<APIResponse<PerfPowerMetric[]>> {
    let path = `/apps/${appId}/perfPowerMetrics`;
    if (metricType) path += `?filter[metricType]=${metricType}`;
    return this.get(path);
  }

  /**
   * Get diagnostic signatures (crash reports)
   */
  async getDiagnosticSignatures(
    appId: string,
    diagnosticType: 'DISK_WRITES' | 'HANGS'
  ): Promise<APIResponse<DiagnosticSignature[]>> {
    return this.get(
      `/apps/${appId}/diagnosticSignatures?filter[diagnosticType]=${diagnosticType}`
    );
  }

  // ============================================
  // Xcode Cloud / CI
  // ============================================

  /**
   * List CI products
   */
  async listCiProducts(appId: string): Promise<APIResponse<CiProduct[]>> {
    return this.get(`/apps/${appId}/ciProduct`);
  }

  /**
   * List workflows for a CI product
   */
  async listCiWorkflows(productId: string): Promise<APIResponse<CiWorkflow[]>> {
    return this.get(`/ciProducts/${productId}/workflows`);
  }

  /**
   * Start a build run
   */
  async startCiBuildRun(
    workflowId: string,
    gitReference?: { kind: 'BRANCH' | 'TAG'; name: string }
  ): Promise<APIResponse<CiBuildRun>> {
    const body: any = {
      data: {
        type: 'ciBuildRuns',
        relationships: {
          workflow: {
            data: { type: 'ciWorkflows', id: workflowId },
          },
        },
      },
    };

    if (gitReference) {
      body.data.relationships.sourceBranchOrTag = {
        data: {
          type: gitReference.kind === 'BRANCH' ? 'scmGitReferences' : 'scmGitReferences',
        },
      };
    }

    return this.post('/ciBuildRuns', body);
  }

  /**
   * List build runs for a workflow
   */
  async listCiBuildRuns(
    workflowId: string,
    limit?: number
  ): Promise<APIResponse<CiBuildRun[]>> {
    let path = `/ciWorkflows/${workflowId}/buildRuns`;
    if (limit) path += `?limit=${limit}`;
    return this.get(path);
  }

  /**
   * Get build run status
   */
  async getCiBuildRun(buildRunId: string): Promise<APIResponse<CiBuildRun>> {
    return this.get(`/ciBuildRuns/${buildRunId}`);
  }

  /**
   * Cancel a build run
   */
  async cancelCiBuildRun(buildRunId: string): Promise<void> {
    await this.delete(`/ciBuildRuns/${buildRunId}`);
  }

  // ============================================
  // App Store Versions & Metadata
  // ============================================

  /**
   * List App Store versions for an app
   */
  async listAppStoreVersions(
    appId: string,
    options?: { platform?: 'IOS' | 'MAC_OS'; state?: string }
  ): Promise<APIResponse<AppStoreVersion[]>> {
    let path = `/apps/${appId}/appStoreVersions`;
    const params: string[] = [];
    if (options?.platform) params.push(`filter[platform]=${options.platform}`);
    if (options?.state) params.push(`filter[appStoreState]=${options.state}`);
    if (params.length > 0) path += `?${params.join('&')}`;
    return this.get(path);
  }

  /**
   * Get App Store version by ID
   */
  async getAppStoreVersion(versionId: string): Promise<APIResponse<AppStoreVersion>> {
    return this.get(`/appStoreVersions/${versionId}`);
  }

  /**
   * Create a new App Store version
   */
  async createAppStoreVersion(
    appId: string,
    versionString: string,
    platform: 'IOS' | 'MAC_OS' = 'IOS'
  ): Promise<APIResponse<AppStoreVersion>> {
    return this.post('/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: {
          versionString,
          platform,
        },
        relationships: {
          app: {
            data: { type: 'apps', id: appId },
          },
        },
      },
    });
  }

  /**
   * Update App Store version
   */
  async updateAppStoreVersion(
    versionId: string,
    attributes: {
      copyright?: string;
      releaseType?: 'MANUAL' | 'AFTER_APPROVAL' | 'SCHEDULED';
      earliestReleaseDate?: string;
      downloadable?: boolean;
    }
  ): Promise<APIResponse<AppStoreVersion>> {
    return this.patch(`/appStoreVersions/${versionId}`, {
      data: {
        type: 'appStoreVersions',
        id: versionId,
        attributes,
      },
    });
  }

  // ============================================
  // Version Localizations (Description, Keywords, etc.)
  // ============================================

  /**
   * List localizations for a version
   */
  async listVersionLocalizations(
    versionId: string
  ): Promise<APIResponse<AppStoreVersionLocalization[]>> {
    return this.get(`/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  }

  /**
   * Get version localization by ID
   */
  async getVersionLocalization(
    localizationId: string
  ): Promise<APIResponse<AppStoreVersionLocalization>> {
    return this.get(`/appStoreVersionLocalizations/${localizationId}`);
  }

  /**
   * Create version localization
   */
  async createVersionLocalization(
    versionId: string,
    locale: string,
    attributes: {
      description?: string;
      keywords?: string;
      marketingUrl?: string;
      promotionalText?: string;
      supportUrl?: string;
      whatsNew?: string;
    }
  ): Promise<APIResponse<AppStoreVersionLocalization>> {
    return this.post('/appStoreVersionLocalizations', {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale,
          ...attributes,
        },
        relationships: {
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: versionId },
          },
        },
      },
    });
  }

  /**
   * Update version localization
   */
  async updateVersionLocalization(
    localizationId: string,
    attributes: {
      description?: string;
      keywords?: string;
      marketingUrl?: string;
      promotionalText?: string;
      supportUrl?: string;
      whatsNew?: string;
    }
  ): Promise<APIResponse<AppStoreVersionLocalization>> {
    return this.patch(`/appStoreVersionLocalizations/${localizationId}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: localizationId,
        attributes,
      },
    });
  }

  // ============================================
  // App Info (Name, Subtitle, Category)
  // ============================================

  /**
   * List app infos
   */
  async listAppInfos(appId: string): Promise<APIResponse<AppInfo[]>> {
    return this.get(`/apps/${appId}/appInfos`);
  }

  /**
   * Get app info localizations
   */
  async listAppInfoLocalizations(
    appInfoId: string
  ): Promise<APIResponse<AppInfoLocalization[]>> {
    return this.get(`/appInfos/${appInfoId}/appInfoLocalizations`);
  }

  /**
   * Update app info localization (name, subtitle, privacy policy)
   */
  async updateAppInfoLocalization(
    localizationId: string,
    attributes: {
      name?: string;
      subtitle?: string;
      privacyPolicyText?: string;
      privacyPolicyUrl?: string;
      privacyChoicesUrl?: string;
    }
  ): Promise<APIResponse<AppInfoLocalization>> {
    return this.patch(`/appInfoLocalizations/${localizationId}`, {
      data: {
        type: 'appInfoLocalizations',
        id: localizationId,
        attributes,
      },
    });
  }

  /**
   * Update app info category
   */
  async updateAppInfoCategory(
    appInfoId: string,
    primaryCategoryId: string,
    secondaryCategoryId?: string
  ): Promise<APIResponse<AppInfo>> {
    const relationships: Record<string, unknown> = {
      primaryCategory: {
        data: { type: 'appCategories', id: primaryCategoryId },
      },
    };
    if (secondaryCategoryId) {
      relationships.secondaryCategory = {
        data: { type: 'appCategories', id: secondaryCategoryId },
      };
    }
    return this.patch(`/appInfos/${appInfoId}`, {
      data: {
        type: 'appInfos',
        id: appInfoId,
        relationships,
      },
    });
  }

  // ============================================
  // Age Rating Declaration
  // ============================================

  /**
   * Get age rating declaration for a version
   */
  async getAgeRatingDeclaration(
    versionId: string
  ): Promise<APIResponse<AgeRatingDeclaration>> {
    return this.get(`/appStoreVersions/${versionId}/ageRatingDeclaration`);
  }

  /**
   * Update age rating declaration
   */
  async updateAgeRatingDeclaration(
    declarationId: string,
    attributes: Partial<AgeRatingDeclaration['attributes']>
  ): Promise<APIResponse<AgeRatingDeclaration>> {
    return this.patch(`/ageRatingDeclarations/${declarationId}`, {
      data: {
        type: 'ageRatingDeclarations',
        id: declarationId,
        attributes,
      },
    });
  }

  // ============================================
  // Customer Reviews
  // ============================================

  /**
   * List customer reviews for an app
   */
  async listCustomerReviews(
    appId: string,
    options?: { limit?: number; sort?: 'createdDate' | '-createdDate' | 'rating' | '-rating' }
  ): Promise<APIResponse<CustomerReview[]>> {
    let path = `/apps/${appId}/customerReviews`;
    const params: string[] = [];
    if (options?.limit) params.push(`limit=${options.limit}`);
    if (options?.sort) params.push(`sort=${options.sort}`);
    if (params.length > 0) path += `?${params.join('&')}`;
    return this.get(path);
  }

  /**
   * Respond to a customer review
   */
  async respondToReview(
    reviewId: string,
    responseBody: string
  ): Promise<APIResponse<CustomerReviewResponse>> {
    return this.post('/customerReviewResponses', {
      data: {
        type: 'customerReviewResponses',
        attributes: {
          responseBody,
        },
        relationships: {
          review: {
            data: { type: 'customerReviews', id: reviewId },
          },
        },
      },
    });
  }

  // ============================================
  // App Categories
  // ============================================

  /**
   * List all app categories
   */
  async listAppCategories(
    platform: 'IOS' | 'MAC_OS' = 'IOS'
  ): Promise<APIResponse<{ type: string; id: string; attributes: { platforms: string[] } }[]>> {
    return this.get(`/appCategories?filter[platforms]=${platform}`);
  }
}
