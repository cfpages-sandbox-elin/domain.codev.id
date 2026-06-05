// Shared WHOIS orchestration for Supabase Edge Functions.
export type {
  WhoisData,
  WhoisProviderAttempt,
  WhoisProviderConfig,
  WhoisProviderCredentials,
  WhoisProviderId,
  WhoisProviderRuntimeState,
  WhoisProviderStatus,
  WhoisQuota,
  WhoisRuntimeOptions,
} from './whois-types.ts';

import { providerHandlers } from './whois-adapters.ts';
import { hasQuotaData } from './whois-normalize.ts';
import { providerById, WHOIS_PROVIDER_REGISTRY } from './whois-registry.ts';
import {
  claimPersistentProviderAttempt,
  getRuntimeSkipReason,
  getRuntimeState,
  loadPersistentTelemetry,
  loadUserProviderCredentials,
  markProviderFailure,
  markProviderFinished,
  markProviderStart,
  persistPersistentTelemetry,
  updateRuntimeQuota,
} from './whois-runtime.ts';
import type {
  WhoisData,
  WhoisProviderAttempt,
  WhoisProviderId,
  WhoisProviderStatus,
  WhoisRuntimeOptions,
} from './whois-types.ts';

const getProviderExecutionOrder = () => {
  return providerHandlers
    .slice()
    .sort(([providerIdA], [providerIdB]) => {
      const providerA = providerById(providerIdA);
      const providerB = providerById(providerIdB);
      const stateA = getRuntimeState(providerIdA);
      const stateB = getRuntimeState(providerIdB);

      if (stateA.inFlight !== stateB.inFlight) return stateA.inFlight - stateB.inFlight;
      return providerA.priority - providerB.priority;
    });
};

export const getWhoisProviderStatuses = async (telemetryClient?: any, userId?: string): Promise<WhoisProviderStatus[]> => {
  await loadPersistentTelemetry(telemetryClient);
  const credentials = await loadUserProviderCredentials(telemetryClient, userId);

  return WHOIS_PROVIDER_REGISTRY
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((provider) => {
      const configured = provider.isConfigured(credentials);
      const runtime = getRuntimeState(provider.id);
      const skipReason = getRuntimeSkipReason(provider);
      const status = !provider.implemented
        ? 'not-implemented'
        : !provider.enabled
          ? 'disabled'
          : configured
            ? 'active'
            : 'missing-key';

      return {
        id: provider.id,
        label: provider.label,
        implemented: provider.implemented,
        configured,
        enabled: provider.enabled,
        priority: provider.priority,
        envKeys: provider.envKeys,
        freeTierLabel: provider.freeTierLabel,
        supportsQuotaHeaders: provider.supportsQuotaHeaders,
        status,
        notes: skipReason ? `${skipReason} ${provider.notes}` : provider.notes,
        quota: runtime.quota,
      };
    });
};

const withProviderMetadata = (
  providerId: WhoisProviderId,
  data: WhoisData,
  attempts: WhoisProviderAttempt[],
): WhoisData => {
  const provider = providerById(providerId);
  const quota = hasQuotaData(data.quota) ? data.quota : undefined;
  return {
    ...data,
    provider: provider.id,
    providerLabel: provider.label,
    providerAttempts: attempts,
    quota,
  };
};

const getUnusableWhoisReason = (data: WhoisData): string | null => {
  if (data.status === 'unknown') {
    return 'Provider returned unknown status.';
  }

  if ((data.status === 'registered' || data.status === 'expired') && !data.expirationDate) {
    return 'Provider confirmed the domain is registered but did not return an expiry date.';
  }

  return null;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const getWhoisData = async (domainName: string, options: WhoisRuntimeOptions = {}): Promise<WhoisData> => {
  const attempts: WhoisProviderAttempt[] = [];
  await loadPersistentTelemetry(options.telemetryClient);
  const credentials = await loadUserProviderCredentials(options.telemetryClient, options.userId);

  for (const [providerId, handler] of getProviderExecutionOrder()) {
    const provider = providerById(providerId);

    if (!provider.enabled || !provider.implemented || !provider.isConfigured(credentials)) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: !provider.implemented
          ? 'Provider is not implemented.'
          : !provider.enabled
            ? 'Provider is disabled.'
            : 'Provider is missing required environment configuration.',
      });
      continue;
    }

    const runtimeSkipReason = getRuntimeSkipReason(provider);
    if (runtimeSkipReason) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: runtimeSkipReason,
      });
      continue;
    }

    const persistentClaim = await claimPersistentProviderAttempt(provider, options.telemetryClient);
    if (persistentClaim.skipReason) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: persistentClaim.skipReason,
      });
      continue;
    }

    markProviderStart(provider, !persistentClaim.claimed);
    try {
      const data = await handler(domainName, credentials);
      updateRuntimeQuota(provider.id, data.quota);
      await persistPersistentTelemetry(provider.id, options.telemetryClient);
      const unusableReason = getUnusableWhoisReason(data);
      if (unusableReason) {
        attempts.push({
          provider: provider.id,
          providerLabel: provider.label,
          status: 'failed',
          errorMessage: unusableReason,
          quota: hasQuotaData(data.quota) ? data.quota : undefined,
        });
        console.warn(`${provider.label} returned incomplete WHOIS data for ${domainName}: ${unusableReason}`);
        continue;
      }

      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'success',
        quota: hasQuotaData(data.quota) ? data.quota : undefined,
      });
      return withProviderMetadata(provider.id, data, attempts);
    } catch (error) {
      const message = getErrorMessage(error);
      markProviderFailure(provider.id, message);
      await persistPersistentTelemetry(provider.id, options.telemetryClient);
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'failed',
        errorMessage: message,
      });
      console.error(`${provider.label} failed for ${domainName}: ${message}`);
    } finally {
      markProviderFinished(provider.id);
    }
  }

  console.error(`All WHOIS providers failed for ${domainName}.`);
  return {
    status: 'unknown',
    expirationDate: null,
    registeredDate: null,
    registrar: 'Error',
    providerAttempts: attempts,
  };
};
