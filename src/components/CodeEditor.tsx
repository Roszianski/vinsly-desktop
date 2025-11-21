import React, { useState, useEffect, useRef } from 'react';

interface CodeEditorProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ id, value, onChange, rows = 20, placeholder }) => {
  const [lineCount, setLineCount] = useState(1);
  const lineCounterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(lines > 0 ? lines : 1);
  }, [value]);

  const handleScroll = () => {
    if (lineCounterRef.current && textareaRef.current) {
      lineCounterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineNumbers = [];
  for (let i = 1; i <= lineCount; i++) {
    lineNumbers.push(<div key={i}>{i}</div>);
  }

  return (
    <div className="relative bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border focus-within:ring-2 focus-within:ring-v-accent transition duration-150 ease-in-out rounded-md overflow-hidden">
      <div
        ref={lineCounterRef}
        className="absolute top-0 left-0 h-full select-none text-right p-2 pr-3 text-v-light-text-secondary dark:text-v-text-secondary font-mono text-sm bg-v-light-hover dark:bg-v-light-dark overflow-hidden border-r border-v-light-border dark:border-v-border"
        aria-hidden="true"
        style={{ width: '4rem' }}
      >
        {lineNumbers}
      </div>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-transparent text-v-light-text-primary dark:text-v-text-primary p-2 font-mono text-sm outline-none resize-y custom-scrollbar placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 placeholder:italic"
        style={{ paddingLeft: '4.5rem' }}
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
};