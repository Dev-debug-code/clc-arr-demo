import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

const FileType = typeof File !== 'undefined' ? PropTypes.instanceOf(File) : PropTypes.any;
const BlobType = typeof Blob !== 'undefined' ? PropTypes.instanceOf(Blob) : PropTypes.any;
const DEFAULT_SCALE = 1.4;

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = workerSrc;
}

function convertBoxToViewport(box, viewport) {
  const [x1, y1, x2, y2] = box.bbox;
  const [vx1, vy1] = viewport.convertToViewportPoint(x1, y1);
  const [vx2, vy2] = viewport.convertToViewportPoint(x2, y2);

  const left = Math.min(vx1, vx2);
  const top = Math.min(vy1, vy2);
  const width = Math.abs(vx2 - vx1);
  const height = Math.abs(vy2 - vy1);

  return {
    ...box,
    rect: { left, top, width, height }
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
  onRendered
}) {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewportBoxes, setViewportBoxes] = useState([]);
  const [renderError, setRenderError] = useState('');
  const [wrapperWidth, setWrapperWidth] = useState(0);

  useEffect(() => {
    function measure() {
      const wrapper = canvasRef.current?.parentElement;
      if (!wrapper) return;
      setWrapperWidth(wrapper.clientWidth || 0);
    }

    measure();

    const wrapper = canvasRef.current?.parentElement;
    if (wrapper && typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(wrapper);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function renderPage() {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) return;

      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const baseWidth = baseViewport.width;
        const targetWidth =
          wrapperWidth > 0 ? wrapperWidth : baseWidth * DEFAULT_SCALE;
        const derivedScale = targetWidth / baseWidth;
        const scale = Math.min(DEFAULT_SCALE, derivedScale || DEFAULT_SCALE);
        const viewport = page.getViewport({ scale });
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const context = canvasEl.getContext('2d', { alpha: false });
        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (cancelled) return;

        const converted = Array.isArray(boxes)
          ? boxes.map((entry) => convertBoxToViewport(entry, viewport))
          : [];

        setViewportBoxes(converted);
        const nextDimensions = { width: viewport.width, height: viewport.height };
        setDimensions(nextDimensions);
        onRendered?.(nextDimensions);
        setRenderError('');
      } catch (error) {
        if (error?.name === 'RenderingCancelledException') {
          return;
        }
        if (!cancelled) {
          console.error(`Failed to render PDF page ${pageIndex + 1}`, error);
          setRenderError('Unable to display this page.');
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        renderTask.cancel();
      }
    };
  }, [pdfDocRef, pageIndex, boxes, docVersion, wrapperWidth, onRendered]);

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
              return (
                <button
                  key={box.id}
                  type="button"
                  className={`pdf-overlay-box${isActive ? ' is-active' : ''}`}
                  data-box-id={box.id}
                  style={style}
                  data-category={box.category}
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
      title: PropTypes.string
    })
  ),
  showBoxes: PropTypes.bool,
  activeBoxId: PropTypes.string,
  onSelectBox: PropTypes.func,
  docVersion: PropTypes.number.isRequired,
  onRendered: PropTypes.func
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
  const [pageDimensions, setPageDimensions] = useState({});
  const pdfDocRef = useRef(null);
  const docVersionRef = useRef(0);
  const internalScrollRef = useRef(null);
  const scrollContainerRef = scrollRef ?? internalScrollRef;

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
      if (!hasFile && !pdfUrl) {
        return;
      }

      try {
        let params;
        if (hasFile) {
          const buffer = await pdfFile.arrayBuffer();
          if (cancelled) return;
          params = { data: new Uint8Array(buffer) };
        } else {
          params = { url: pdfUrl };
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
  }, [pdfUrl, pdfFile]);

  const boxesByPage = useMemo(() => {
    if (!Array.isArray(boxes)) return new Map();
    const map = new Map();
    boxes.forEach((box) => {
      let pageIndex;
      if (Number.isFinite(box.page)) {
        pageIndex = Math.max(Math.round(box.page - 1), 0);
      } else if (Number.isFinite(box.pageno)) {
        pageIndex = Math.max(Math.round(box.pageno), 0);
      } else {
        pageIndex = 0;
      }
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
    const target = container.querySelector(`button[data-box-id="${activeBoxId}"]`);
    if (!target) {
      return undefined;
    }
    const raf = window.requestAnimationFrame(() => {
      centerElementWithin(container, target);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeBoxId, showBoxes, pageCount, boxesByPage, scrollContainerRef, focusSignal, pageDimensions]);

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
            onRendered={(dims) =>
              setPageDimensions((prev) => {
                if (prev[index]?.width === dims.width && prev[index]?.height === dims.height) {
                  return prev;
                }
                return { ...prev, [index]: dims };
              })
            }
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
