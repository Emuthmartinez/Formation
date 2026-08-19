import { workflows as buildRelease } from "./build-release.js";
import { workflows as growthRevenue } from "./growth-revenue.js";
import { workflows as maintenance } from "./maintenance.js";
import { workflows as operatingSystem } from "./operating-system.js";
import { workflows as operationsTrust } from "./operations-trust.js";
import { workflows as productExperience } from "./product-experience.js";

/** All 80 catalog workflows, including the typed ONB-00 through ONB-22 onboarding expansion. */
export const workflows = [...operatingSystem, ...operationsTrust, ...productExperience, ...buildRelease, ...growthRevenue, ...maintenance];
