import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  fileUrl: string;
  onLoadError?: (error: Error) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, onLoadError }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* PDF 컨트롤 바 */}
      <div style={{ padding: '8px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1}>
          이전
        </button>
        <span>{pageNumber} / {numPages || '-'}</span>
        <button onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))} disabled={pageNumber >= (numPages || 1)}>
          다음
        </button>
        <button onClick={() => setScale(Math.max(0.5, scale - 0.1))}>축소</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(Math.min(2.0, scale + 0.1))}>확대</button>
      </div>

      {/* PDF 뷰어 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', textAlign: 'center' }}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onLoadError}
          loading={<div>PDF 로딩 중...</div>}
          error={<div>PDF를 불러올 수 없습니다.</div>}
        >
          <Page 
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;