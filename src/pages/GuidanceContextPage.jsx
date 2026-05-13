import { useMemo } from 'react';

export function buildPdfUrl(pdf, page) {
  if (!pdf) return '';
  const pageValue = String(page || '1').trim() || '1';
  const separator = pdf.includes('#') ? '&' : '#';
  return `${pdf}${separator}page=${encodeURIComponent(pageValue)}&zoom=page-width`;
}

export function GuidanceContextLayout({
  guidance,
  onBack = null,
  backLabel = 'Back',
  embedded = false
}) {
  const viewerUrl = useMemo(() => buildPdfUrl(guidance.pdf, guidance.page), [guidance.page, guidance.pdf]);

  return (
    <main className={`guidance-page${embedded ? ' guidance-page--embedded' : ''}`}>
      <section className="guidance-page__hero">
        {onBack ? (
          <button type="button" className="btn btn-sm secondary guidance-page__back" onClick={onBack}>
            ← {backLabel}
          </button>
        ) : null}
        <span className="guidance-page__eyebrow">Requirement guidance</span>
        <h1>{guidance.title}</h1>
        <p className="guidance-page__reference">{guidance.reference}</p>
        <p className="guidance-page__detail">{guidance.detail}</p>
      </section>

      <section className="guidance-page__layout">
        <aside className="guidance-page__panel guidance-page__panel--meta">
          <div className="guidance-page__panel-body">
            <h2>Guidance details</h2>
            <div className="guidance-page__meta-list">
              <div className="guidance-page__meta-card">
                <span>Linked document</span>
                <strong>{guidance.documentLabel || 'No linked requirement PDF bundled in this demo build.'}</strong>
              </div>
              <div className="guidance-page__meta-card">
                <span>Linked page</span>
                <strong>{guidance.page ? `Page ${guidance.page}` : '—'}</strong>
              </div>
            </div>
            {viewerUrl ? (
              <p className="guidance-page__actions">
                <a className="btn btn-secondary" href={viewerUrl} target="_blank" rel="noopener noreferrer">
                  Open linked document
                </a>
              </p>
            ) : null}
          </div>
        </aside>

        <section className="guidance-page__panel guidance-page__panel--viewer">
          {viewerUrl ? (
            <iframe className="guidance-page__viewer" title="Guidance document preview" src={viewerUrl} />
          ) : (
            <div className="guidance-page__empty">
              No linked requirement PDF is bundled for this reference in the current demo build. The reference
              and requirement context are shown on the left instead.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default function GuidanceContextPage() {
  const guidance = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        title: 'Requirement context',
        reference: 'Reference unavailable.',
        detail: 'No further requirement context is bundled for this finding.',
        documentLabel: '',
        page: '',
        pdf: ''
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      title: params.get('title') || 'Requirement context',
      reference: params.get('reference') || 'Reference unavailable.',
      detail: params.get('detail') || 'No further requirement context is bundled for this finding.',
      documentLabel: params.get('documentLabel') || '',
      page: params.get('page') || '',
      pdf: params.get('pdf') || ''
    };
  }, []);

  return <GuidanceContextLayout guidance={guidance} />;
}
