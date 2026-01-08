/**
 * App Store Connect API Types
 *
 * Type definitions for the App Store Connect REST API
 * https://developer.apple.com/documentation/appstoreconnectapi
 */

// ============================================
// Authentication
// ============================================

export interface AppStoreConnectConfig {
  /** Issuer ID from App Store Connect */
  issuerId: string;
  /** Key ID from the API key */
  keyId: string;
  /** Private key content (P8 file contents) */
  privateKey: string;
}

// ============================================
// Common API Types
// ============================================

export interface APIResponse<T> {
  data: T;
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface APIError {
  id: string;
  status: string;
  code: string;
  title: string;
  detail: string;
}

export interface APIErrorResponse {
  errors: APIError[];
}

// ============================================
// App Types
// ============================================

export interface App {
  type: 'apps';
  id: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
    isOrEverWasMadeForKids: boolean;
    availableInNewTerritories: boolean;
    contentRightsDeclaration: string;
  };
  relationships?: {
    appStoreVersions?: { data: { type: string; id: string }[] };
    preReleaseVersions?: { data: { type: string; id: string }[] };
  };
}

// ============================================
// TestFlight Types
// ============================================

export interface Build {
  type: 'builds';
  id: string;
  attributes: {
    version: string;
    uploadedDate: string;
    expirationDate: string;
    expired: boolean;
    minOsVersion: string;
    iconAssetToken?: {
      templateUrl: string;
      width: number;
      height: number;
    };
    processingState: 'PROCESSING' | 'FAILED' | 'INVALID' | 'VALID';
    buildAudienceType: 'INTERNAL_ONLY' | 'APP_STORE_ELIGIBLE';
    usesNonExemptEncryption?: boolean;
  };
}

export interface BetaTester {
  type: 'betaTesters';
  id: string;
  attributes: {
    firstName?: string;
    lastName?: string;
    email: string;
    inviteType: 'EMAIL' | 'PUBLIC_LINK';
    state: 'NOT_INVITED' | 'INVITED' | 'ACCEPTED' | 'INSTALLED';
  };
}

export interface BetaGroup {
  type: 'betaGroups';
  id: string;
  attributes: {
    name: string;
    isInternalGroup: boolean;
    hasAccessToAllBuilds: boolean;
    publicLinkEnabled: boolean;
    publicLinkId?: string;
    publicLinkLimitEnabled: boolean;
    publicLinkLimit?: number;
    publicLink?: string;
    feedbackEnabled: boolean;
  };
}

export interface PreReleaseVersion {
  type: 'preReleaseVersions';
  id: string;
  attributes: {
    version: string;
    platform: 'IOS' | 'MAC_OS' | 'TV_OS' | 'VISION_OS';
  };
}

// ============================================
// In-App Purchase Types
// ============================================

export type IAPType =
  | 'CONSUMABLE'
  | 'NON_CONSUMABLE'
  | 'NON_RENEWING_SUBSCRIPTION'
  | 'AUTO_RENEWABLE_SUBSCRIPTION';

export type IAPState =
  | 'MISSING_METADATA'
  | 'READY_TO_SUBMIT'
  | 'WAITING_FOR_REVIEW'
  | 'IN_REVIEW'
  | 'DEVELOPER_ACTION_NEEDED'
  | 'PENDING_BINARY_APPROVAL'
  | 'APPROVED'
  | 'DEVELOPER_REMOVED_FROM_SALE'
  | 'REMOVED_FROM_SALE'
  | 'REJECTED';

export interface InAppPurchase {
  type: 'inAppPurchases';
  id: string;
  attributes: {
    name: string;
    productId: string;
    inAppPurchaseType: IAPType;
    state: IAPState;
    reviewNote?: string;
    familySharable: boolean;
    contentHosting: boolean;
  };
}

export interface SubscriptionGroup {
  type: 'subscriptionGroups';
  id: string;
  attributes: {
    referenceName: string;
  };
}

export interface Subscription {
  type: 'subscriptions';
  id: string;
  attributes: {
    name: string;
    productId: string;
    familySharable: boolean;
    state: IAPState;
    subscriptionPeriod: 'ONE_WEEK' | 'ONE_MONTH' | 'TWO_MONTHS' | 'THREE_MONTHS' | 'SIX_MONTHS' | 'ONE_YEAR';
    reviewNote?: string;
    groupLevel: number;
  };
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsReportRequest {
  type: 'analyticsReportRequests';
  id: string;
  attributes: {
    accessType: 'ONE_TIME_SNAPSHOT' | 'ONGOING';
    stoppedDueToInactivity: boolean;
  };
}

export interface AnalyticsReport {
  type: 'analyticsReports';
  id: string;
  attributes: {
    category: 'APP_USAGE' | 'APP_STORE_ENGAGEMENT' | 'COMMERCE' | 'FRAMEWORK_USAGE' | 'PERFORMANCE';
    name: string;
  };
}

export interface AnalyticsReportInstance {
  type: 'analyticsReportInstances';
  id: string;
  attributes: {
    granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    processingDate: string;
  };
}

// Performance metrics
export interface PerfPowerMetric {
  type: 'perfPowerMetrics';
  id: string;
  attributes: {
    deviceType: string;
    metricType: 'DISK' | 'HANG' | 'BATTERY' | 'LAUNCH' | 'MEMORY' | 'ANIMATION' | 'TERMINATION';
    platform: 'IOS';
  };
}

export interface DiagnosticSignature {
  type: 'diagnosticSignatures';
  id: string;
  attributes: {
    diagnosticType: 'DISK_WRITES' | 'HANGS';
    signature: string;
    weight: number;
  };
}

// ============================================
// Sales & Finance Types
// ============================================

export interface SalesReport {
  type: 'salesReports';
  attributes: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    reportDate: string;
    reportSubType: 'SUMMARY' | 'DETAILED' | 'OPT_IN';
    reportType: 'SALES' | 'PRE_ORDER' | 'NEWSSTAND' | 'SUBSCRIPTION' | 'SUBSCRIPTION_EVENT' | 'SUBSCRIBER';
    vendorNumber: string;
  };
}

export interface FinanceReport {
  type: 'financeReports';
  attributes: {
    regionCode: string;
    reportDate: string;
    reportType: 'FINANCIAL' | 'FINANCE_DETAIL';
    vendorNumber: string;
  };
}

// ============================================
// CI/CD Types (Xcode Cloud)
// ============================================

export interface CiProduct {
  type: 'ciProducts';
  id: string;
  attributes: {
    name: string;
    createdDate: string;
    productType: 'APP' | 'FRAMEWORK';
  };
}

export interface CiWorkflow {
  type: 'ciWorkflows';
  id: string;
  attributes: {
    name: string;
    description?: string;
    branchStartCondition?: {
      source: {
        branchName: string;
        isAllMatch: boolean;
      };
      filesAndFoldersRule?: object;
      autoCancel: boolean;
    };
    lastModifiedDate: string;
    isEnabled: boolean;
    isLockedForEditing: boolean;
    clean: boolean;
    containerFilePath: string;
  };
}

export interface CiBuildRun {
  type: 'ciBuildRuns';
  id: string;
  attributes: {
    number: number;
    createdDate: string;
    startedDate?: string;
    finishedDate?: string;
    sourceCommit?: {
      commitSha: string;
      message?: string;
      author?: {
        displayName: string;
      };
    };
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED' | 'SKIPPED';
  };
}

export interface CiBuildAction {
  type: 'ciBuildActions';
  id: string;
  attributes: {
    name: string;
    actionType: 'BUILD' | 'ANALYZE' | 'TEST' | 'ARCHIVE';
    startedDate?: string;
    finishedDate?: string;
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED' | 'SKIPPED';
  };
}

// ============================================
// App Store Version & Metadata Types
// ============================================

export type AppStoreVersionState =
  | 'DEVELOPER_REMOVED_FROM_SALE'
  | 'DEVELOPER_REJECTED'
  | 'IN_REVIEW'
  | 'INVALID_BINARY'
  | 'METADATA_REJECTED'
  | 'PENDING_APPLE_RELEASE'
  | 'PENDING_CONTRACT'
  | 'PENDING_DEVELOPER_RELEASE'
  | 'PREPARE_FOR_SUBMISSION'
  | 'PREORDER_READY_FOR_SALE'
  | 'PROCESSING_FOR_APP_STORE'
  | 'READY_FOR_REVIEW'
  | 'READY_FOR_SALE'
  | 'REJECTED'
  | 'REMOVED_FROM_SALE'
  | 'WAITING_FOR_EXPORT_COMPLIANCE'
  | 'WAITING_FOR_REVIEW'
  | 'REPLACED_WITH_NEW_VERSION';

export interface AppStoreVersion {
  type: 'appStoreVersions';
  id: string;
  attributes: {
    platform: 'IOS' | 'MAC_OS' | 'TV_OS' | 'VISION_OS';
    versionString: string;
    appStoreState: AppStoreVersionState;
    copyright?: string;
    releaseType: 'MANUAL' | 'AFTER_APPROVAL' | 'SCHEDULED';
    earliestReleaseDate?: string;
    downloadable: boolean;
    createdDate: string;
  };
  relationships?: {
    appStoreVersionLocalizations?: { data: { type: string; id: string }[] };
    build?: { data: { type: string; id: string } };
  };
}

export interface AppStoreVersionLocalization {
  type: 'appStoreVersionLocalizations';
  id: string;
  attributes: {
    locale: string;
    description?: string;
    keywords?: string;
    marketingUrl?: string;
    promotionalText?: string;
    supportUrl?: string;
    whatsNew?: string;
  };
}

export interface AppInfo {
  type: 'appInfos';
  id: string;
  attributes: {
    appStoreState: AppStoreVersionState;
    appStoreAgeRating: string;
    brazilAgeRating: string;
    kidsAgeBand?: string;
  };
  relationships?: {
    appInfoLocalizations?: { data: { type: string; id: string }[] };
    primaryCategory?: { data: { type: string; id: string } };
    secondaryCategory?: { data: { type: string; id: string } };
  };
}

export interface AppInfoLocalization {
  type: 'appInfoLocalizations';
  id: string;
  attributes: {
    locale: string;
    name?: string;
    subtitle?: string;
    privacyPolicyText?: string;
    privacyPolicyUrl?: string;
    privacyChoicesUrl?: string;
  };
}

export interface AppCategory {
  type: 'appCategories';
  id: string;
  attributes: {
    platforms: ('IOS' | 'MAC_OS' | 'TV_OS' | 'VISION_OS')[];
  };
}

export interface AppScreenshotSet {
  type: 'appScreenshotSets';
  id: string;
  attributes: {
    screenshotDisplayType: string;
  };
}

export interface AppScreenshot {
  type: 'appScreenshots';
  id: string;
  attributes: {
    fileSize: number;
    fileName: string;
    sourceFileChecksum?: string;
    imageAsset?: {
      templateUrl: string;
      width: number;
      height: number;
    };
    assetToken?: string;
    assetType?: string;
    uploadOperations?: {
      method: string;
      url: string;
      length: number;
      offset: number;
      requestHeaders: { name: string; value: string }[];
    }[];
    assetDeliveryState?: {
      state: 'AWAITING_UPLOAD' | 'UPLOAD_COMPLETE' | 'COMPLETE' | 'FAILED';
      errors?: APIError[];
    };
  };
}

export interface AppPreviewSet {
  type: 'appPreviewSets';
  id: string;
  attributes: {
    previewType: string;
  };
}

export interface AgeRatingDeclaration {
  type: 'ageRatingDeclarations';
  id: string;
  attributes: {
    alcoholTobaccoOrDrugUseOrReferences?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    contests?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    gambling: boolean;
    gamblingSimulated?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    horrorOrFearThemes?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    matureOrSuggestiveThemes?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    medicalOrTreatmentInformation?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    profanityOrCrudeHumor?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    sexualContentGraphicAndNudity?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    sexualContentOrNudity?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    violenceCartoonOrFantasy?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    violenceRealistic?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    violenceRealisticProlongedGraphicOrSadistic?: 'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE';
    kidsAgeBand?: 'FIVE_AND_UNDER' | 'SIX_TO_EIGHT' | 'NINE_TO_ELEVEN';
    unrestrictedWebAccess: boolean;
    seventeenPlus: boolean;
  };
}

// ============================================
// Customer Reviews Types
// ============================================

export interface CustomerReview {
  type: 'customerReviews';
  id: string;
  attributes: {
    rating: number;
    title?: string;
    body?: string;
    reviewerNickname?: string;
    createdDate: string;
    territory: string;
  };
}

export interface CustomerReviewResponse {
  type: 'customerReviewResponses';
  id: string;
  attributes: {
    responseBody: string;
    lastModifiedDate: string;
    state: 'PENDING_PUBLISH' | 'PUBLISHED';
  };
}
