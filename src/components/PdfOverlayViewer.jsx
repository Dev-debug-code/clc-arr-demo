import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

const FileType = typeof File !== 'undefined' ? PropTypes.instanceOf(File) : PropTypes.any;
const BlobType = typeof Blob !== 'undefined' ? PropTypes.instanceOf(Blob) : PropTypes.any;
const DEFAULT_SCALE = 1.4;
const MIN_SCALE = 0.55;

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = workerSrc;
}

function isRectWithinViewport(rect, viewport) {
  if (!rect || !viewport) return false;
  const withinHorizontal =
    rect.left >= -viewport.width * 0.2 && rect.left + rect.width <= viewport.width * 1.2;
  const withinVertical =
    rect.top >= -viewport.height * 0.2 && rect.top + rect.height <= viewport.height * 1.2;
  const hasArea = rect.width > 0 && rect.height > 0;
  return hasArea && withinHorizontal && withinVertical;
}

function convertBoxToViewport(box, viewport) {
  const [x1Raw, y1Raw, x2Raw, y2Raw] = box.bbox;
  const viewBox = viewport?.viewBox;
  const pdfHeight = (viewBox && viewBox[3]) || viewport.height / viewport.scale || 0;

  const project = (flipY) => {
    const normaliseY = (value) => (flipY && pdfHeight ? pdfHeight - value : value);
    const [vx1, vy1] = viewport.convertToViewportPoint(x1Raw, normaliseY(y1Raw));
    const [vx2, vy2] = viewport.convertToViewportPoint(x2Raw, normaliseY(y2Raw));
    return {
      left: Math.min(vx1, vx2),
      top: Math.min(vy1, vy2),
      width: Math.abs(vx2 - vx1),
      height: Math.abs(vy2 - vy1)
    };
  };

  const candidates = [project(false)];
  if (pdfHeight) {
    candidates.push(project(true));
  }
  const rect = candidates.find((entry) => isRectWithinViewport(entry, viewport)) ?? candidates[0];

  return {
    ...box,
    rect
  };
}

function centerElementWithin(container, element) {
  if (!container || !element) return;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offsetTop = elementRect.top - containerRect.top;
  const offsetLeft = elementRect.left - containerRect.left;
  const targetTop = Math.max(
    container.scrollTop + offsetTop - container.clientHeight / 2 + elementRect.height / 2,
    0
  );
  const targetLeft = Math.max(
    container.scrollLeft + offsetLeft - container.clientWidth / 2 + elementRect.width / 2,
    0
  );
  container.scrollTo({ top: targetTop, left: targetLeft, behavior: 'smooth' });
}

function PdfPage({
  pdfDocRef,
  pageIndex,
  boxes,
  showBoxes,
  activeBoxId,
  onSelectBox,
  docVersion,
  availableWidth,
  onBoxesRendered
}) {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewportBoxes, setViewportBoxes] = useState([]);
  const [renderError, setRenderError] = useState('');
  const [renderRetryToken, setRenderRetryToken] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    retryCountRef.current = 0;
    setRenderError('');
    return () => {
      if (retryTimeoutRef.current && typeof window !== 'undefined') {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [docVersion, pageIndex]);

  useEffect(() => {
    let cancelled = false;

    const scheduleRetry = () => {
      if (typeof window === 'undefined') return;
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        setRenderRetryToken((prev) => prev + 1);
      }, 220);
    };

    async function renderPage() {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) return;

      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        if (cancelled || pdfDoc !== pdfDocRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        let scale = DEFAULT_SCALE;

        if (Number.isFinite(availableWidth) && availableWidth > 0) {
          const desiredWidth = baseViewport.width * DEFAULT_SCALE;
          if (desiredWidth > availableWidth) {
            const fitScale = availableWidth / baseViewport.width;
            scale = Math.max(Math.min(DEFAULT_SCALE, fitScale), MIN_SCALE);
          }
        }

        const viewport = page.getViewport({ scale, rotation: page.rotate || 0 });
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const context = canvasEl.getContext('2d', { alpha: false });
        if (!context) {
          setRenderError('Unable to display this page.');
          return;
        }
        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvasEl.width, canvasEl.height);

        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled || pdfDoc !== pdfDocRef.current) return;

        const converted = Array.isArray(boxes)
          ? boxes.map((entry) => convertBoxToViewport(entry, viewport))
          : [];

        setViewportBoxes(converted);
        setDimensions({ width: viewport.width, height: viewport.height });
        setRenderError('');
        if (typeof onBoxesRendered === 'function') {
          onBoxesRendered(pageIndex);
        }
      } catch (error) {
        if (!cancelled) {
          if (error?.name === 'RenderingCancelledException') {
            return;
          }
          console.error(`Failed to render PDF page ${pageIndex + 1}`, error);
          if (retryCountRef.current < 2) {
            retryCountRef.current += 1;
            scheduleRetry();
          } else {
            setRenderError('Unable to display this page.');
          }
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current && typeof window !== 'undefined') {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [pdfDocRef, pageIndex, boxes, docVersion, availableWidth, onBoxesRendered, renderRetryToken]);

  const handleBoxClick = (boxId) => {
    if (typeof onSelectBox === 'function') {
      onSelectBox(boxId);
    }
  };

  return (
    <div className="pdf-overlay-page" role="group" aria-label={`Page ${pageIndex + 1}`}>
      <div
        className="pdf-overlay-canvas-wrapper"
        style={{ width: dimensions.width || undefined, height: dimensions.height || undefined }}
      >
        <canvas
          ref={canvasRef}
          className="pdf-overlay-canvas"
          aria-label={`PDF page ${pageIndex + 1}`}
        />
        {showBoxes
          ? viewportBoxes.map((box) => {
              const { rect } = box;
              const style = {
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`
              };
              const isActive = activeBoxId === box.id;
              const severity = (box.severity || '').toLowerCase();
              const classes = ['pdf-overlay-box'];
              if (isActive) classes.push('is-active');
              if (severity) classes.push(`severity-${severity}`);
              return (
                <button
                  key={box.id}
                  type="button"
                  className={classes.join(' ')}
                  data-box-id={box.id}
                  style={style}
                  data-category={box.category}
                  data-severity={severity || undefined}
                  onClick={() => handleBoxClick(box.id)}
                  title={box.details || box.title || `Bounding box ${box.id}`}
                >
                  <span className="visually-hidden">
                    {box.title ?? box.details ?? box.id}. Click to view description.
                  </span>
                </button>
              );
            })
          : null}
      </div>
      {renderError ? <div className="text-danger small mt-2">{renderError}</div> : null}
    </div>
  );
}

PdfPage.propTypes = {
  pdfDocRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  pageIndex: PropTypes.number.isRequired,
  boxes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      bbox: PropTypes.arrayOf(PropTypes.number).isRequired,
      category: PropTypes.string,
      details: PropTypes.string,
      title: PropTypes.string,
      severity: PropTypes.string
    })
  ),
  showBoxes: PropTypes.bool,
  activeBoxId: PropTypes.string,
  onSelectBox: PropTypes.func,
  docVersion: PropTypes.number.isRequired,
  availableWidth: PropTypes.number,
  onBoxesRendered: PropTypes.func
};

export default function PdfOverlayViewer({
  pdfUrl,
  pdfFile,
  boxes,
  showBoxes,
  activeBoxId,
  onSelectBox,
  scrollRef,
  focusSignal = 0
}) {
  const [pageCount, setPageCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [viewerWidth, setViewerWidth] = useState(null);
  const [boxesReadySignal, setBoxesReadySignal] = useState(0);
  const pdfDocRef = useRef(null);
  const docVersionRef = useRef(0);
  const internalScrollRef = useRef(null);
  const scrollContainerRef = scrollRef ?? internalScrollRef;

  const resolvedPdfUrl = useMemo(() => {
    if (!pdfUrl) return null;
    if (typeof window === 'undefined') return pdfUrl;
    try {
      return new URL(pdfUrl, window.location.href).toString();
    } catch {
      return pdfUrl;
    }
  }, [pdfUrl]);

  const handleBoxesRendered = useCallback(() => {
    setBoxesReadySignal((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    async function loadDocument() {
      setLoadError('');
      setPageCount(0);
      const existingDoc = pdfDocRef.current;
      if (existingDoc) {
        existingDoc.cleanup();
        existingDoc.destroy();
        pdfDocRef.current = null;
      }

      const hasFile = pdfFile instanceof Blob;
      if (!hasFile && !resolvedPdfUrl) {
        return;
      }

      try {
        let params;
        if (hasFile) {
          const buffer = await pdfFile.arrayBuffer();
          if (cancelled) return;
          params = { data: new Uint8Array(buffer) };
        } else {
          params = { url: resolvedPdfUrl };
        }

        loadingTask = getDocument(params);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy()?.catch(() => {});
          return;
        }
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        docVersionRef.current += 1;
      } catch (error) {
        console.error('Unable to load PDF document', error);
        if (!cancelled) {
          setLoadError('Unable to load PDF preview.');
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy()?.catch(() => {});
      }
      const doc = pdfDocRef.current;
      if (doc) {
        doc.cleanup();
        doc.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [resolvedPdfUrl, pdfFile]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;

    const measureWidth = () => {
      const rawWidth = container.clientWidth;
      if (typeof window === 'undefined') {
        setViewerWidth(rawWidth || null);
        return;
      }
      const styles = window.getComputedStyle(container);
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const innerWidth = Math.max(rawWidth - paddingLeft - paddingRight, 0);
      setViewerWidth((prev) => {
        const next = innerWidth || rawWidth || null;
        if (prev !== null && next !== null && Math.abs(prev - next) < 0.5) {
          return prev;
        }
        return next;
      });
    };

    measureWidth();

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const observer = new ResizeObserver(() => measureWidth());
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      const handleResize = () => measureWidth();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    return undefined;
  }, [scrollContainerRef]);

  const boxesByPage = useMemo(() => {
    if (!Array.isArray(boxes)) return new Map();
    const map = new Map();
    boxes.forEach((box) => {
      const rawPage = Number.isFinite(box.pageno)
        ? box.pageno
        : Number.isFinite(box.page)
          ? box.page - 1
          : 0;
      const pageIndex = Math.max(Math.round(rawPage), 0);
      if (!map.has(pageIndex)) {
        map.set(pageIndex, []);
      }
      map.get(pageIndex).push(box);
    });
    return map;
  }, [boxes]);

  useEffect(() => {
    if (!showBoxes || !activeBoxId) {
      return undefined;
    }
    const container = scrollContainerRef.current;
    if (!container || typeof window === 'undefined') {
      return undefined;
    }

    let raf = null;
    let retryTimeout = null;
    let attempts = 0;

    const locateAndCenter = () => {
      const target = container.querySelector(`button[data-box-id="${activeBoxId}"]`);
      if (!target && attempts < 8) {
        attempts += 1;
        retryTimeout = window.setTimeout(locateAndCenter, 80);
        return;
      }
      if (!target) {
        return;
      }
      raf = window.requestAnimationFrame(() => {
        centerElementWithin(container, target);
      });
    };

    locateAndCenter();

    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [
    activeBoxId,
    showBoxes,
    pageCount,
    boxesByPage,
    scrollContainerRef,
    focusSignal,
    viewerWidth,
    boxesReadySignal
  ]);

  if (loadError) {
    return <div className="alert alert-danger">{loadError}</div>;
  }

  if (!pdfUrl && !pdfFile) {
    return <div className="text-muted">Upload the reference PDF to begin.</div>;
  }

  return (
    <div className="pdf-overlay-viewer" ref={scrollContainerRef}>
      {pageCount === 0 ? (
        <div className="text-muted py-5 text-center">Loading PDF…</div>
      ) : (
        Array.from({ length: pageCount }, (_, index) => (
          <PdfPage
            key={`page-${index}`}
            pdfDocRef={pdfDocRef}
            pageIndex={index}
            boxes={boxesByPage.get(index) || []}
            showBoxes={showBoxes}
            activeBoxId={activeBoxId}
            onSelectBox={onSelectBox}
            docVersion={docVersionRef.current}
            availableWidth={viewerWidth}
            onBoxesRendered={handleBoxesRendered}
          />
        ))
      )}
    </div>
  );
}

PdfOverlayViewer.propTypes = {
  pdfUrl: PropTypes.string,
  pdfFile: PropTypes.oneOfType([FileType, BlobType]),
  boxes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      bbox: PropTypes.arrayOf(PropTypes.number).isRequired,
      category: PropTypes.string,
      details: PropTypes.string,
      title: PropTypes.string
    })
  ),
  showBoxes: PropTypes.bool,
  activeBoxId: PropTypes.string,
  onSelectBox: PropTypes.func,
  scrollRef: PropTypes.shape({ current: PropTypes.any }),
  focusSignal: PropTypes.number
};
