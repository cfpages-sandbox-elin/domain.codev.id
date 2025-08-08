

import React, { useState } from 'react';
import { DomainTag } from '../types';
import Spinner from './Spinner';

interface DomainFormProps {
  onAddDomain: (domainName: string, tag: DomainTag) => Promise<void>;
}

const DomainForm: React.FC<DomainFormProps> = ({ onAddDomain }) => {
  const [domainName, setDomainName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (tag: DomainTag) => {
    if (!domainName.trim() || !domainName.includes('.')) {
      alert('Please enter a valid domain name.');
      return;
    }
    setIsLoading(true);
    await onAddDomain(domainName.trim(), tag);
    setDomainName('');
    setIsLoading(false);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={domainName}
          onChange={(e) => setDomainName(e.target.value)}
          placeholder="e.g., example.com or expiring-domain.net"
          className="flex-grow px-4 py-3 bg-slate-100 dark:bg-slate-700 border-2 border-transparent focus:border-brand-blue focus:ring-0 rounded-lg transition"
          disabled={isLoading}
        />
        <div className="flex gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => handleSubmit('mine')}
            className="w-full sm:w-auto px-5 py-3 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors flex items-center justify-center disabled:bg-blue-300 dark:disabled:bg-blue-800"
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : 'Track My Domain'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('to-snatch')}
            className="w-full sm:w-auto px-5 py-3 font-semibold text-white bg-brand-green hover:bg-green-600 rounded-lg transition-colors flex items-center justify-center disabled:bg-green-300 dark:disabled:bg-green-800"
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : 'Snatch this Domain'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default DomainForm;