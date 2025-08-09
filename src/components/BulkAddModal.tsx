import React, { useState, useRef } from 'react';
import { Domain, DomainTag } from '../types';
import Modal from './Modal';
import Spinner from './Spinner';

type BulkDomain = { domainName: string; tag?: DomainTag };

interface BulkAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBulkAdd: (domains: BulkDomain[], defaultTag: DomainTag) => Promise<void>;
    isLoading: boolean;
    addLog: (message: string) => void;
}

const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, onBulkAdd, isLoading, addLog }) => {
    const [textValue, setTextValue] = useState('');
    const [defaultTag, setDefaultTag] = useState<DomainTag>('mine');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePasteSubmit = () => {
        if (isLoading) return;
        const domains = textValue.split(/[\s,]+/).map(d => d.trim().toLowerCase()).filter(Boolean);
        if (domains.length === 0) {
            alert('Please enter at least one domain name.');
            return;
        }
        const bulkDomains: BulkDomain[] = domains.map(domainName => ({ domainName }));
        onBulkAdd(bulkDomains, defaultTag);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading || !event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        addLog(`ℹ️ File selected: ${file.name}`);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                let bulkDomains: BulkDomain[] = [];
                if (file.type === 'application/json') {
                    addLog('➡️ Parsing JSON file...');
                    const data: Partial<Domain>[] = JSON.parse(content);
                    if (!Array.isArray(data)) throw new Error('JSON is not an array.');
                    
                    bulkDomains = data.map(item => {
                        if (!item.domain_name) return null;
                        const tag = (item.tag === 'mine' || item.tag === 'to-snatch') ? item.tag : undefined;
                        return { domainName: item.domain_name, tag };
                    }).filter(item => item !== null);
                    addLog(`✅ Parsed ${bulkDomains.length} domains from JSON.`);

                } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    addLog('➡️ Parsing CSV file...');
                    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                    if (lines.length < 2) throw new Error('CSV must have a header and at least one data row.');
                    
                    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                    const domainIndex = header.indexOf('domain_name');
                    const tagIndex = header.indexOf('tag');

                    if (domainIndex === -1) throw new Error("CSV must have a 'domain_name' column.");
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        const domain = values[domainIndex]?.trim().replace(/"/g, '');
                        if (domain) {
                            const tagValue = tagIndex !== -1 ? values[tagIndex]?.trim().replace(/"/g, '') as DomainTag : undefined;
                            const tag = (tagValue === 'mine' || tagValue === 'to-snatch') ? tagValue : undefined;
                            bulkDomains.push({ domainName: domain, tag });
                        }
                    }
                    addLog(`✅ Parsed ${bulkDomains.length} domains from CSV.`);

                } else {
                    throw new Error(`Unsupported file type: ${file.type}. Please use JSON or CSV.`);
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
        <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} title="Import or Add Bulk Domains">
            <div className="flex flex-col gap-6">
                <div>
                    <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Option 1: Paste a List</h4>
                    <textarea
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        placeholder="example.com, anotherexample.net\nfinaldomain.org"
                        className="w-full h-32 p-3 bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-brand-blue focus:ring-0 rounded-lg transition"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Option 2: Upload a File</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Upload a `.json` or `.csv` file. CSV files must have a `domain_name` column header. An optional `tag` column can be included.</p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json,.csv,application/json,text/csv"
                        disabled={isLoading}
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
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Select a default tag for pasted domains or for imported domains that don't have a tag specified.</p>
                     <fieldset className="flex gap-4">
                        <legend className="sr-only">Default tag selection</legend>
                        <div>
                            <input type="radio" id="tag-mine" name="default-tag" value="mine" checked={defaultTag === 'mine'} onChange={() => setDefaultTag('mine')} disabled={isLoading} className="sr-only peer" />
                            <label htmlFor="tag-mine" className="block w-full px-5 py-3 text-center rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer peer-checked:border-brand-blue peer-checked:ring-2 peer-checked:ring-brand-blue transition-all">
                                Track My Domains
                            </label>
                        </div>
                        <div>
                            <input type="radio" id="tag-snatch" name="default-tag" value="to-snatch" checked={defaultTag === 'to-snatch'} onChange={() => setDefaultTag('to-snatch')} disabled={isLoading} className="sr-only peer" />
                            <label htmlFor="tag-snatch" className="block w-full px-5 py-3 text-center rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer peer-checked:border-brand-green peer-checked:ring-2 peer-checked:ring-brand-green transition-all">
                                Snatch these Domains
                            </label>
                        </div>
                    </fieldset>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-600">
                    <button
                        onClick={handlePasteSubmit}
                        disabled={isLoading || !textValue.trim()}
                        className="px-6 py-3 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors flex items-center justify-center disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <><Spinner /> Processing...</> : 'Add from Pasted List'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkAddModal;