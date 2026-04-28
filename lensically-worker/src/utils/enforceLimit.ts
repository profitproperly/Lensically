import {
  DAILY_USAGE_LIMITS,
  getDailyUsage,
  incrementDailyUsage,
  type UsageCounterColumn,
  type UsageEnv,
} from "./usage";
import { sanitizeForLog } from "../../auth/logSanitizer.js";

export type UsageFeature =
  | "me"
  | "insights"
  | "publish"
  | "keyword_search"
  | "profile_discovery";

export type LimitUser = {
  id: string;
  is_admin?: boolean;
};

type EnforceLimitSuccess = {
  allowed: true;
  feature: UsageFeature;
  remaining: number;
  limit: number;
  used: number;
};

type EnforceLimitAdminBypass = {
  allowed: true;
  feature: UsageFeature;
  adminBypass: true;
};

type EnforceLimitError = {
  allowed: false;
  feature: UsageFeature | "unknown";
  error: "missing_user_id" | "unknown_feature" | "daily_limit_reached" | "usage_query_failed";
  limit?: number;
  used?: number;
};

export type EnforceLimitResult =
  | EnforceLimitSuccess
  | EnforceLimitAdminBypass
  | EnforceLimitError;

const FEATURE_TO_COLUMN: Record<UsageFeature, UsageCounterColumn> = {
  me: "me_calls",
  insights: "insights_calls",
  publish: "publish_calls",
  keyword_search: "keyword_calls",
  profile_discovery: "profile_calls",
};

function isUsageFeature(value: string): value is UsageFeature {
  return value in FEATURE_TO_COLUMN;
}

function normalizeUserId(user: LimitUser): string | null {
  const normalized = user.id?.trim();
  return normalized ? normalized : null;
}

function isAdminUser(user: LimitUser): boolean {
  return user.is_admin === true;
}

export async function enforceLimit(
  env: UsageEnv,
  user: LimitUser,
  feature: UsageFeature | string,
): Promise<EnforceLimitResult> {
  if (!isUsageFeature(feature)) {
    return {
      allowed: false,
      feature: "unknown",
      error: "unknown_feature",
    };
  }

  if (isAdminUser(user)) {
    return {
      allowed: true,
      feature,
      adminBypass: true,
    };
  }

  const normalizedUserId = normalizeUserId(user);
  if (!normalizedUserId) {
    return {
      allowed: false,
      feature,
      error: "missing_user_id",
    };
  }

  const column = FEATURE_TO_COLUMN[feature];
  const limit = DAILY_USAGE_LIMITS[column];

  try {
    const usage = await getDailyUsage(env, normalizedUserId, column);
    const currentUsage = Number(usage.usage_count ?? 0);

    if (currentUsage >= limit) {
      console.log("limit_exceeded", sanitizeForLog({
        userId: normalizedUserId,
        feature,
        limit,
        used: currentUsage,
      }));
      return {
        allowed: false,
        feature,
        error: "daily_limit_reached",
        limit,
        used: currentUsage,
      };
    }

    const updatedUsage = await incrementDailyUsage(env, normalizedUserId, column);
    const newUsage = Number(updatedUsage.usage_count ?? currentUsage + 1);

    return {
      allowed: true,
      feature,
      remaining: Math.max(0, limit - newUsage),
      limit,
      used: newUsage,
    };
  } catch {
    return {
      allowed: false,
      feature,
      error: "usage_query_failed",
    };
  }
}
