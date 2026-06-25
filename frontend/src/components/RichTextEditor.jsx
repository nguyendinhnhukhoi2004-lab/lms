import React, { useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Yêu cầu của Quill Formula Module: window.katex phải tồn tại
window.katex = katex;

const RichTextEditor = ({ value, onChange, placeholder, readOnly = false, minHeight = '100px' }) => {

  const modules = useMemo(() => {
    if (readOnly) return { toolbar: false };
    
    return {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['image'],
        ['clean']
      ],
    };
  }, [readOnly]);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script', 'blockquote', 'code-block',
    'list', 'bullet',
    'image'
  ];

  if (readOnly) {
    return (
      <ReactQuill
        theme="bubble"
        value={value}
        readOnly={true}
        modules={modules}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ minHeight }}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="h-full"
      />
    </div>
  );
};

export default RichTextEditor;
