export interface BusinessState {
  schemaVersion: string;
  updatedAt: string;
  business: {
    name: string;
    slug: string;
    stage: string;
    positioning: string;
    targetAudience: string;
  };
  theme: {
    tokensPath: string;
    status: string;
  };
  designBrief?: DesignBrief;
  designRoom: {
    status: string;
    renderPath: string;
    versionLog: Array<{
      id: string;
      createdAt: string;
      summary: string;
      statePaths: string[];
      renderedArtifacts: string[];
    }>;
    baselines: Array<{
      name: string;
      gitRef: string;
      createdAt: string;
    }>;
  };
  surfaces: {
    webFunnels: Surface[];
    landingPages: Surface[];
    marketingAssets: Surface[];
    mobileApp: {
      platforms: string[];
      screens: Surface[];
      flows: Flow[];
    };
    appStore: {
      defaultProductPage: ProductPage;
      customProductPages: CustomProductPage[];
      productPageOptimizationTests: ProductPageOptimizationTest[];
      inAppEvents: InAppEvent[];
    };
  };
  controlPlane: {
    panels: Array<{ id: string; name: string; status: string }>;
    futurePanels: string[];
  };
}

export interface ThemeTokens {
  schemaVersion: string;
  updatedAt: string;
  tokens: {
    color: Record<string, string>;
    font: Record<string, { family: string; weight: string }>;
    radius: Record<string, string>;
    space: Record<string, string>;
    motion: Record<string, string>;
  };
}

export interface DesignBrief {
  source: string;
  productType?: string;
  recommendedStyle?: string;
  paletteMood?: string;
  typographyMood?: string;
  keyEffects?: string[];
  antiPatterns?: string[];
  motionNotes?: string;
  generatedAt?: string;
  notes?: string;
}

export interface Surface {
  id: string;
  name: string;
  status: string;
  purpose: string;
  decisions: string[];
  tokenReferences: string[];
}

export interface Flow {
  id: string;
  name: string;
  status: string;
  steps: string[];
  tokenReferences: string[];
}

export interface ProductPage {
  status: string;
  positioning: string;
  screenshotCount: number;
  appPreviewCount: number;
  promotionalText: string;
  keywords: string[];
}

export interface CustomProductPage extends ProductPage {
  id: string;
  audience: string;
  trafficSource: string;
  measurementPlan: string;
  shareUrl: string;
  deepLink?: string;
}

export interface ProductPageOptimizationTest {
  id: string;
  status: string;
  hypothesis: string;
  trafficAllocationPercent: number;
  durationDays: number;
  treatments: Array<{
    id: string;
    changedAssets: string[];
  }>;
  winnerConfidence: number;
}

export interface InAppEvent {
  id: string;
  referenceName: string;
  status: string;
  purpose: string;
  schedule: {
    startsAt: string;
    endsAt: string;
  };
  deepLink: string;
  requiresIap: boolean;
  mediaStatus: string;
}
