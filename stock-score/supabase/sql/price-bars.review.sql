-- Revisión previa a la aplicación. La tabla aún no existe en el proyecto remoto.
-- Al activar esta fase, generar una migración Supabase con este DDL y probarla primero.
create table ops.price_bars (
  company_id uuid not null references public.companies(id) on delete cascade,
  session_date date not null,
  open numeric(30,10) not null check (open > 0),
  high numeric(30,10) not null check (high > 0),
  low numeric(30,10) not null check (low > 0),
  close numeric(30,10) not null check (close > 0),
  volume bigint not null check (volume >= 0),
  feed text not null check (feed = 'iex'),
  adjustment text not null check (adjustment = 'split'),
  fetched_at timestamptz not null default now(),
  primary key (company_id, session_date),
  constraint price_bar_range check (low <= open and open <= high and low <= close and close <= high)
);

-- El esquema ops es privado; el role de base de datos del pipeline lo consulta directamente.
alter table ops.price_bars enable row level security;
revoke all on ops.price_bars from public, anon, authenticated;
comment on table ops.price_bars is 'Sesiones diarias de Alpaca IEX ajustadas por splits; caché incremental privada de hasta seis años.';
