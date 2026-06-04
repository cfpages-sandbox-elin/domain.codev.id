alter type public.domain_tag_type add value if not exists 'others';

comment on type public.domain_tag_type is
  'Domain intent labels: mine, to-snatch, or others for client/third-party owned domains being monitored.';
