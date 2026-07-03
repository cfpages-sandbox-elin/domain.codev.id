import React from 'react';
import { DomainTag } from '../../types';
import { HomeIcon, TargetIcon, UsersIcon } from '../icons';
import Tooltip from '../Tooltip';

interface TagChoiceProps {
  id: string;
  name: string;
  tag: DomainTag;
  checked: boolean;
  disabled: boolean;
  shortcut: string;
  onChange: () => void;
}

export const getTagIcon = (tag: DomainTag) => {
  if (tag === 'mine') return HomeIcon;
  if (tag === 'others') return UsersIcon;
  return TargetIcon;
};

export const getTagIconClass = (tag: DomainTag) => {
  if (tag === 'mine') return 'text-indigo-500';
  if (tag === 'others') return 'text-violet-500';
  return 'text-teal-500';
};

const TagChoice: React.FC<TagChoiceProps> = ({ id, name, tag, checked, disabled, shortcut, onChange }) => {
  const isMine = tag === 'mine';
  const isOthers = tag === 'others';
  const Icon = getTagIcon(tag);
  const label = isMine ? 'Mine' : isOthers ? 'Others' : 'To Snatch';
  const meaning = isMine
    ? 'A domain you own and need to renew.'
    : isOthers
      ? 'A client or third-party owned domain you monitor.'
      : 'A target domain you want to watch and acquire.';

  return (
    <Tooltip className="w-full" content={`${meaning} Keyboard shortcut: ${shortcut}.`} placement="top">
    <div className="w-full">
      <input type="radio" id={id} name={name} value={tag} checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
      <label
        htmlFor={id}
        className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all peer-disabled:cursor-not-allowed peer-disabled:opacity-60 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
          isMine
            ? 'border-slate-300 text-indigo-700 peer-checked:border-brand-blue peer-checked:ring-2 peer-checked:ring-brand-blue dark:border-slate-600 dark:text-indigo-200'
            : isOthers
              ? 'border-slate-300 text-violet-700 peer-checked:border-violet-500 peer-checked:ring-2 peer-checked:ring-violet-500 dark:border-slate-600 dark:text-violet-200'
              : 'border-slate-300 text-teal-700 peer-checked:border-brand-green peer-checked:ring-2 peer-checked:ring-brand-green dark:border-slate-600 dark:text-teal-200'
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </label>
    </div>
    </Tooltip>
  );
};

export default TagChoice;
