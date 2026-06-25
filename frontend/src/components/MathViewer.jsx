import React, { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';
import katex from 'katex';

const MathViewer = ({ htmlContent, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // 1. Tự động render các công thức LaTeX thô (từ file Excel) e.g. $$x^2$$ hoặc \(x^2\)
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });

      // 2. Render các công thức do Quill tạo ra (có class .ql-formula và data-value)
      const quillFormulas = containerRef.current.querySelectorAll('.ql-formula');
      quillFormulas.forEach(el => {
        const formula = el.getAttribute('data-value');
        if (formula) {
          try {
            katex.render(formula, el, {
              throwOnError: false,
              displayMode: false // Quill mặc định chèn inline
            });
          } catch (e) {
            console.error('KaTeX rendering error:', e);
          }
        }
      });
    }
  }, [htmlContent]);

  return (
    <div 
      ref={containerRef} 
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

export default MathViewer;
