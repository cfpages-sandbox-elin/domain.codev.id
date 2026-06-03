import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Domain, DomainTag } from '../types';
import Modal from './Modal';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import { ArrowUpOnSquareIcon, HomeIcon, TargetIcon } from './icons';

type BulkDomain = { domainName: string; tag?: DomainTag };
type ActiveTab = 'single' | 'bulk';

interface BulkAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: ActiveTab;
    onAddDomain: (domainName: string, tag: DomainTag) => unknown;
    onBulkAdd: (domains: BulkDomain[], defaultTag: DomainTag) => Promise<void>;
    isLoading: boolean;
    addLog: (message: string) => void;
}

const splitBulkInput = (value: string) => value
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean);

const normalizeDomainInput = (value: string): string | null => {
    let normalized = value.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//, '').replace(/^www\./, '');
    normalized = normalized.split(/[/?#]/)[0];
    normalized = normalized.replace(/\.$/, '');
    return normalized || null;
};

const isValidDomainName = (value: string) => {
    if (value.length < 3 || value.length > 253) return false;
    if (value.includes('@') || value.includes('*') || value.includes('_')) return false;
    if (!value.includes('.')) return false;
    const labels = value.split('.');
    if (labels.length < 2) return false;
    return labels.every(label => (
        label.length > 0
        && label.length <= 63
        && /^[a-z0-9-]+$/.test(label)
        && !label.startsWith('-')
        && !label.endsWith('-')
    ));
};

const parseBulkDomains = (values: string[]) => {
    const seen = new Set<string>();
    const domains: BulkDomain[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];

    for (const rawValue of values) {
        const domainName = normalizeDomainInput(rawValue);
        if (!domainName || !isValidDomainName(domainName)) {
            invalid.push(rawValue);
            continue;
        }

        if (seen.has(domainName)) {
            duplicates.push(domainName);
            continue;
        }

        seen.add(domainName);
        domains.push({ domainName });
    }

    return { domains, invalid, duplicates };
};

const TagChoice: React.FC<{
    id: string;
    name: string;
    tag: DomainTag;
    checked: boolean;
    disabled: boolean;
    onChange: () => void;
}> = ({ id, name, tag, checked, disabled, onChange }) => {
    const isMine = tag === 'mine';
    const Icon = isMine ? HomeIcon : TargetIcon;
    return (
        <div>
            <input type="radio" id={id} name={name} value={tag} checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
            <label
                htmlFor={id}
                className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
                    isMine
                        ? 'border-slate-300 text-indigo-700 peer-checked:border-brand-blue peer-checked:ring-2 peer-checked:ring-brand-blue dark:border-slate-600 dark:text-indigo-200'
                        : 'border-slate-300 text-teal-700 peer-checked:border-brand-green peer-checked:ring-2 peer-checked:ring-brand-green dark:border-slate-600 dark:text-teal-200'
                }`}
            >
                <Icon className="h-4 w-4" />
                {isMine ? 'Mine' : 'To Snatch'}
            </label>
        </div>
    );
};

const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, initialTab = 'single', onAddDomain, onBulkAdd, isLoading, addLog }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
    const [singleDomain, setSingleDomain] = useState('');
    const [singleTag, setSingleTag] = useState<DomainTag>('mine');
    const [textValue, setTextValue] = useState('');
    const [defaultTag, setDefaultTag] = useState<DomainTag>('mine');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const singleInputRef = useRef<HTMLInputElement>(null);
    const bulkInputRef = useRef<HTMLTextAreaElement>(null);
    const isBusy = isLoading;

    useEffect(() => {
        if (!isOpen) return;
        setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => {
            if (activeTab === 'single') {
                singleInputRef.current?.focus();
            } else {
                bulkInputRef.current?.focus();
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [isOpen, activeTab]);

    const parsedPaste = useMemo(() => parseBulkDomains(splitBulkInput(textValue)), [textValue]);

    const switchTab = (nextTab?: ActiveTab) => {
        setActiveTab(current => nextTab || (current === 'single' ? 'bulk' : 'single'));
    };

    const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        switchTab(event.shiftKey ? (activeTab === 'single' ? 'bulk' : 'single') : undefined);
    };

    const handleSingleSubmit = async (tag: DomainTag) => {
        const normalizedDomain = normalizeDomainInput(singleDomain);
        if (!normalizedDomain || !isValidDomainName(normalizedDomain)) {
            alert('Please enter one valid domain name, for example example.com.');
            return;
        }

        const result = onAddDomain(normalizedDomain, tag);
        if (result) {
            setSingleDomain('');
        }
    };

    const handleSingleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSingleSubmit(event.shiftKey ? 'to-snatch' : 'mine');
        }
    };

    const handlePasteSubmit = () => {
        if (isBusy) return;
        if (parsedPaste.domains.length === 0) {
            alert(parsedPaste.invalid.length > 0 ? 'No valid domain names found in the pasted list.' : 'Please enter at least one domain name.');
            return;
        }

        if (parsedPaste.invalid.length > 0 || parsedPaste.duplicates.length > 0) {
            addLog(`⚠️ Bulk input skipped ${parsedPaste.invalid.length} invalid and ${parsedPaste.duplicates.length} duplicate entr${parsedPaste.duplicates.length === 1 ? 'y' : 'ies'}.`);
        }

        onBulkAdd(parsedPaste.domains, defaultTag);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isBusy || !event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        addLog(`ℹ️ File selected: ${file.name}`);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                let bulkDomains: BulkDomain[] = [];
                if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    addLog('➡️ Parsing JSON file...');
                    const data: Partial<Domain>[] = JSON.parse(content);
                    if (!Array.isArray(data)) throw new Error('JSON is not an array.');
                    
                    const parsed = parseBulkDomains(data.map(item => item.domain_name || ''));
                    bulkDomains = parsed.domains.map(item => {
                        const source = data.find(row => normalizeDomainInput(row.domain_name || '') === item.domainName);
                        if (!source) return item;
                        const tag = (source.tag === 'mine' || source.tag === 'to-snatch') ? source.tag : undefined;
                        return { ...item, tag };
                    });
                    if (parsed.invalid.length > 0 || parsed.duplicates.length > 0) {
                        addLog(`⚠️ JSON import skipped ${parsed.invalid.length} invalid and ${parsed.duplicates.length} duplicate entr${parsed.duplicates.length === 1 ? 'y' : 'ies'}.`);
                    }
                    addLog(`✅ Parsed ${bulkDomains.length} domains from JSON.`);

                } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    addLog('➡️ Parsing CSV file...');
                    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                    if (lines.length < 2) throw new Error('CSV must have a header and at least one data row.');
                    
                    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                    const domainIndex = header.indexOf('domain_name');
                    const tagIndex = header.indexOf('tag');

                    if (domainIndex === -1) throw new Error("CSV must have a 'domain_name' column.");
                    
                    const rawDomains: string[] = [];
                    const tagByDomain = new Map<string, DomainTag>();
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        const domain = values[domainIndex]?.trim().replace(/"/g, '');
                        if (domain) {
                            const tagValue = tagIndex !== -1 ? values[tagIndex]?.trim().replace(/"/g, '') as DomainTag : undefined;
                            const tag = (tagValue === 'mine' || tagValue === 'to-snatch') ? tagValue : undefined;
                            rawDomains.push(domain);
                            const normalized = normalizeDomainInput(domain);
                            if (normalized && tag) tagByDomain.set(normalized, tag);
                        }
                    }
                    const parsed = parseBulkDomains(rawDomains);
                    bulkDomains = parsed.domains.map(item => ({ ...item, tag: tagByDomain.get(item.domainName) }));
                    if (parsed.invalid.length > 0 || parsed.duplicates.length > 0) {
                        addLog(`⚠️ CSV import skipped ${parsed.invalid.length} invalid and ${parsed.duplicates.length} duplicate entr${parsed.duplicates.length === 1 ? 'y' : 'ies'}.`);
                    }
                    addLog(`✅ Parsed ${bulkDomains.length} domains from CSV.`);

                } else {
                    throw new Error(`Unsupported file type: ${file.type}. Please use JSON or CSV.`);
                }
                
                if (bulkDomains.length === 0) {
                    throw new Error('No valid domain names found in the file.');
                }

                onBulkAdd(bulkDomains, defaultTag);

            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                addLog(`❌ Error parsing file: ${message}`);
                alert(`Error parsing file: ${message}`);
            }
        };
        reader.readAsText(file);
        
        // Reset file input to allow uploading the same file again
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Modal isOpen={isOpen} onClose={isBusy ? () => {} : onClose} title="Add Domains">
            <div className="flex flex-col gap-5" onKeyDown={handleModalKeyDown}>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900" role="tablist" aria-label="Domain add mode">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'single'}
                        onClick={() => switchTab('single')}
                        className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeTab === 'single' ? 'bg-white text-brand-blue shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                    >
                        <HomeIcon className="h-4 w-4" />
                        New Domain
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'bulk'}
                        onClick={() => switchTab('bulk')}
                        className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeTab === 'bulk' ? 'bg-white text-brand-blue shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                    >
                        <ArrowUpOnSquareIcon className="h-4 w-4" />
                        Bulk Add
                    </button>
                </div>

                {activeTab === 'single' ? (
                    <div className="flex flex-col gap-4" role="tabpanel">
                        <Tooltip content="Enter = save as Mine. Shift + Enter = save as To Snatch. Available domains are always saved as To Snatch.">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="single-domain-input">
                                Domain name
                            </label>
                        </Tooltip>
                        <input
                            id="single-domain-input"
                            ref={singleInputRef}
                            type="text"
                            value={singleDomain}
                            onChange={(event) => setSingleDomain(event.target.value)}
                            onKeyDown={handleSingleKeyDown}
                            placeholder="example.com"
                            className="w-full rounded-lg border-2 border-transparent bg-slate-100 px-4 py-3 transition focus:border-brand-blue focus:ring-0 dark:bg-slate-700"
                            disabled={isBusy}
                        />

                        <fieldset className="grid gap-2 sm:grid-cols-2">
                            <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Save as</legend>
                            <TagChoice id="single-tag-mine" name="single-tag" tag="mine" checked={singleTag === 'mine'} disabled={isBusy} onChange={() => setSingleTag('mine')} />
                            <TagChoice id="single-tag-snatch" name="single-tag" tag="to-snatch" checked={singleTag === 'to-snatch'} disabled={isBusy} onChange={() => setSingleTag('to-snatch')} />
                        </fieldset>

                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-600">
                            <Tooltip content="Runs WHOIS first, then saves only if the result is usable. Enter saves as Mine; Shift + Enter saves as To Snatch.">
                                <button
                                    type="button"
                                    onClick={() => handleSingleSubmit(singleTag)}
                                    disabled={isBusy || !singleDomain.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
                                >
                                    Check and Save
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6" role="tabpanel">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Paste a List</h4>
                    <textarea
                        ref={bulkInputRef}
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        placeholder="example.com, anotherexample.net\nfinaldomain.org"
                        className="w-full h-32 p-3 bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-brand-blue focus:ring-0 rounded-lg transition"
                        disabled={isBusy}
                    />
                    {textValue.trim() && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {parsedPaste.domains.length} valid, {parsedPaste.invalid.length} invalid, {parsedPaste.duplicates.length} duplicate.
                        </p>
                    )}
                </div>

                <div>
                    <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Upload a File</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Upload a `.json` or `.csv` file. CSV files must have a `domain_name` column header. An optional `tag` column can be included.</p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json,.csv,application/json,text/csv"
                        disabled={isBusy}
                        className="block w-full text-sm text-slate-500
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-full file:border-0
                                   file:text-sm file:font-semibold
                                   file:bg-blue-50 file:text-brand-blue
                                   dark:file:bg-blue-900/50 dark:file:text-blue-300
                                   hover:file:bg-blue-100 dark:hover:file:bg-blue-900"
                    />
                </div>

                <div>
                    <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Default Tag</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Imported available domains are always saved as To Snatch. This default is used when WHOIS says the domain is registered.</p>
                     <fieldset className="grid gap-2 sm:grid-cols-2">
                        <legend className="sr-only">Default tag selection</legend>
                        <TagChoice id="tag-mine" name="default-tag" tag="mine" checked={defaultTag === 'mine'} disabled={isBusy} onChange={() => setDefaultTag('mine')} />
                        <TagChoice id="tag-snatch" name="default-tag" tag="to-snatch" checked={defaultTag === 'to-snatch'} disabled={isBusy} onChange={() => setDefaultTag('to-snatch')} />
                    </fieldset>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-600">
                    <Tooltip content="Each valid domain runs WHOIS before saving. Invalid lines and duplicates are skipped.">
                    <button
                        onClick={handlePasteSubmit}
                        disabled={isBusy || !textValue.trim()}
                        className="px-6 py-3 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors flex items-center justify-center disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <><Spinner /> Processing...</> : 'Check and Add Valid Domains'}
                    </button>
                    </Tooltip>
                </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkAddModal;
