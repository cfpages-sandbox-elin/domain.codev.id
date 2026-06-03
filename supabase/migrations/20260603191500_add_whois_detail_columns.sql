alter table public.domains
  add column if not exists domain_statuses text[];

alter table public.domains
  add column if not exists name_servers text[];

comment on column public.domains.domain_statuses is
  'Registry/EPP status values returned by the latest WHOIS provider check, for example autoRenewPeriod or clientTransferProhibited.';

comment on column public.domains.name_servers is
  'Name servers returned by the latest WHOIS provider check.';
