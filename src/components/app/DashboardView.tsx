import type { CategoryManualOverrides, CategoryWordGroup, Domain, DomainTag, WhoisData } from '../../types';
import DomainList from '../DomainList';

type DashboardViewProps = {
  dateRefreshTick: number;
  domains: Domain[];
  isDomainListLoading: boolean;
  categoryNameOverrides: Record<string, string>;
  categoryManualOverrides: CategoryManualOverrides;
  categoryWordGroups: CategoryWordGroup[];
  whoisDetailsByDomainId: Record<number, WhoisData>;
  autoRepairingDomainIds: Set<number>;
  pendingDomainIds: Set<number>;
  tagUpdatingDomainIds: Set<number>;
  isBulkProcessing: boolean;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onSetTag: (id: number, tag: DomainTag) => void;
  onRecheck: (id: number) => Promise<void>;
  onRemoveDomainCategory: (domainId: number, categoryId: string) => void;
  onCreateWordGroupCategory: (domain: Domain, suggestedWords: string[]) => void;
  onExportRequest: (format: 'json' | 'csv') => void;
  onImportRequest: () => void;
};

const DashboardView = ({
  dateRefreshTick,
  domains,
  isDomainListLoading,
  categoryNameOverrides,
  categoryManualOverrides,
  categoryWordGroups,
  whoisDetailsByDomainId,
  autoRepairingDomainIds,
  pendingDomainIds,
  tagUpdatingDomainIds,
  isBulkProcessing,
  onRemove,
  onShowInfo,
  onToggleTag,
  onSetTag,
  onRecheck,
  onRemoveDomainCategory,
  onCreateWordGroupCategory,
  onExportRequest,
  onImportRequest,
}: DashboardViewProps) => (
  <div className="mx-auto max-w-4xl">
    <div className="-mx-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-900 dark:shadow-black/30 sm:mx-0 sm:rounded-xl sm:p-5 md:rounded-2xl md:p-6 md:shadow-lg">
      <h2 className="mb-3 px-1 text-xl font-bold text-slate-800 dark:text-white sm:mb-4 sm:px-0 sm:text-2xl">Tracked Domains</h2>
      <DomainList
        dateRefreshTick={dateRefreshTick}
        domains={domains}
        isLoadingDomains={isDomainListLoading}
        categoryNameOverrides={categoryNameOverrides}
        categoryManualOverrides={categoryManualOverrides}
        categoryWordGroups={categoryWordGroups}
        whoisDetailsByDomainId={whoisDetailsByDomainId}
        onRemove={onRemove}
        onShowInfo={onShowInfo}
        onToggleTag={onToggleTag}
        onSetTag={onSetTag}
        onRecheck={onRecheck}
        onRemoveDomainCategory={onRemoveDomainCategory}
        onCreateWordGroupCategory={onCreateWordGroupCategory}
        autoRepairingDomainIds={autoRepairingDomainIds}
        pendingDomainIds={pendingDomainIds}
        tagUpdatingDomainIds={tagUpdatingDomainIds}
        onExportRequest={onExportRequest}
        onImportRequest={onImportRequest}
        isProcessing={isBulkProcessing}
      />
    </div>
  </div>
);

export default DashboardView;
