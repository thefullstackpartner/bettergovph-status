import { FC, useEffect, useState } from 'react';
import {
  Button,
  Container,
  Notice,
  Pagination,
  SectionHeader,
} from '../../components/ui';
import { IncidentCard } from '../../components/status';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getIncidents } from '../../lib/api';
import type { Incident } from '../../types';

const IncidentsPage: FC = () => {
  useDocumentTitle('Incidents | BetterGovPH Status');
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getIncidents(filter, page)
      .then(res => {
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load incidents'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <Container narrow className="py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          label="Incident History"
          meta={`${total} total`}
          className="mb-0"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'solid' : 'ghost'}
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
          >
            All Incidents
          </Button>
          <Button
            size="sm"
            variant={filter === 'open' ? 'solid' : 'ghost'}
            onClick={() => {
              setFilter('open');
              setPage(1);
            }}
          >
            Ongoing Only
          </Button>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 text-sm text-ed-ink-3">
          Loading incidents...
        </div>
      ) : items.length === 0 ? (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 text-center text-sm text-ed-ink-3">
          No incidents found.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(inc => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Container>
  );
};

export default IncidentsPage;
