import type { CategoryManualOverrides, CategoryWordGroup, Domain, DomainTag, WhoisData } from '../../types';
import DomainList from '../DomainList';

type DashboardViewProps = {
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
  <div className="max-w-4xl mx-auto">
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg dark:shadow-black/40">
      <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Tracked Domains</h2>
      <DomainList
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
