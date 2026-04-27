import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

type LogLine = {
  id: number;
  text: string;
  isInput?: boolean;
  isProgressBar?: boolean;
  progress?: number;
};

const HELP_TEXT = `omx — natural language file converter

  omx convert report.pdf to markdown
  omx compress video.mp4 to 30mb
  omx trim clip.mp4 from 0:30 to 1:45
  omx resize photo.png to 800px

Run omx --help for all commands and flags.`;

const FULL_HELP = `Usage: omx <command> [options]

Commands:
  convert   Convert a document, image, or video to a different format
  compress  Reduce the file size of images or videos
  trim      Trim a video file based on start and end timestamps
  extract   Extract audio from a video file
  resize    Resize an image to specific dimensions
  doctor    Verify dependencies (ffmpeg, sharp, pandoc)
  config    Save a global configuration value

Options:
  --quiet        suppress progress output
  --json         structured JSON output
  -y, --yes      skip confirmations (for CI and scripts)
  --overwrite    allow overwriting existing output files
  --dry-run      show what would happen without doing it
  --no-color     disable ANSI color codes
  --verbose      show detailed operation logs
  --help         display help for command`;

const DOCTOR_OUTPUT = `✅ Node.js  (v20.3.0 or higher required, current is ok)
✅ ffmpeg   (bundled via ffmpeg-static)
✅ sharp    (installed dependency)
ℹ️ pandoc   (used for non-PDF document conversion when available)
ℹ️ --refine requires a Gemini API key.

System is ready for the workflows omx actually supports.`;

const stripExtension = (value: string) => value.replace(/\.[^/.]+$/, '');

export function Terminal() {
  const [lines, setLines] = useState<LogLine[]>([
    { id: 1, text: HELP_TEXT },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  const addLine = (text: string, options: Partial<LogLine> = {}) => {
    setLines(prev => [...prev, { id: Date.now() + Math.random(), text, ...options }]);
  };

  const updateProgressBar = (progressId: number, progress: number, text: string) => {
     setLines(prev => prev.map(line => 
       line.id === progressId ? { ...line, progress, text } : line
     ));
  };
  
  const simulateProgress = async (initialText: string, finalMessage: string) => {
    const progressId = Date.now() + Math.random();
    
    // Add the initial progress bar line
    setLines(prev => [...prev, { id: progressId, text: `${initialText} 0%`, isProgressBar: true, progress: 0 }]);
    
    // Simulate steps
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const percentage = i * 10;
      updateProgressBar(progressId, percentage, `${initialText} ${percentage}% · ~${10 - i}s remaining`);
    }
    
    addLine(finalMessage);
    setIsProcessing(false);
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    
    const cmd = inputValue.trim();
    if (!cmd) return;
    
    addLine(`$ ${cmd}`, { isInput: true });
    setInputValue('');
    
    if (!cmd.startsWith('omx')) {
      addLine(`bash: ${cmd.split(' ')[0]}: command not found`);
      return;
    }

    const args = cmd.split(' ').slice(1);
    
    if (args.length === 0) {
      addLine(HELP_TEXT);
      return;
    }
    
    const commandType = args[0];
    
    setIsProcessing(true);
    
    switch (commandType) {
      case '--help':
      case '-h':
        addLine(FULL_HELP);
        setIsProcessing(false);
        break;
      case 'doctor':
        addLine(DOCTOR_OUTPUT);
        setIsProcessing(false);
        break;
      case 'convert': {
        if (cmd.includes('scanned-report.pdf')) {
          if (cmd.includes('--refine')) {
             addLine('Refining text extraction with AI Vision OCR (cost: ~$0.04)...');
             await new Promise(r => setTimeout(r, 1500));
             addLine('Vision OCR complete. Layout reconstructed.');
             await simulateProgress('Converting scanned-report.pdf...', 'Output saved to: scanned-report_conv.md');
          } else {
             addLine('✗ This PDF appears to be scanned or image-based.');
             addLine('  Local text extraction cannot recover layout or images.');
             addLine('');
             addLine('  Fix: Run with --refine to use AI Vision OCR, or export to txt.');
             addLine('  $ omx convert scanned-report.pdf to markdown --refine', { isInput: true });
          }
          setIsProcessing(false);
          break;
        }

        if (cmd.includes('two-column.pdf')) {
           addLine('⚠️ Warning: This PDF appears to use a two-column layout.');
           addLine('  Layouts may be disrupted during Pandoc conversion.');
           addLine('  Consider using --refine to let AI reconstruct the document structure.');
           await simulateProgress('Converting two-column.pdf...', 'Output saved to: two-column_conv.md');
           break;
        }

        if (cmd.includes('report.pdf') && cmd.includes('markdown')) {
          if (cmd.includes('--refine')) {
             addLine('Refining markdown structure with AI (cost: ~$0.01)...');
             await new Promise(r => setTimeout(r, 1500));
             addLine('Refinement complete. Table layouts restored.');
          } else {
             addLine('Warning: PDF text extraction preserves words, but not page layout.');
          }
          await simulateProgress('Converting report.pdf...', 'Output saved to: report_conv.md');
        } else {
          addLine('Output saved to: file_conv.ext');
          setIsProcessing(false);
        }
        break;
      }
      case 'compress': {
        if (cmd.includes('--dry-run')) {
          const inputFile = cmd.split(/\s+/)[2] || 'file';
          const ext = inputFile.includes('.') ? (inputFile.split('.').pop() || 'mp4') : 'mp4';
          addLine(`Dry Run mode.
Would execute: ffmpeg -n -i ${inputFile} -c:v libx264 -preset fast -crf 28 ${stripExtension(inputFile)}_compress.${ext}`);
          setIsProcessing(false);
        } else if (cmd.includes('video.mp4')) {
          await simulateProgress('Compressing video.mp4...', 'Output saved to: video_compress.mp4');
        } else {
          addLine('Output saved to: file_conv.ext');
          setIsProcessing(false);
        }
        break;
      }
      case 'extract': {
        if (cmd.includes('audio from video.mp4')) {
          await simulateProgress('Extracting audio from video.mp4...', 'Output saved to: video_extract.mp3');
        } else {
          const inputFile = cmd.split(/\s+/).at(-1) || 'video.mp4';
          addLine(`Output saved to: ${stripExtension(inputFile)}_extract.mp3`);
          setIsProcessing(false);
        }
        break;
      }
      case 'resize': {
        if (cmd.includes('photo.png') && cmd.includes('800px')) {
          await simulateProgress('Resizing photo.png...', 'Output saved to: photo_resize.png');
        } else {
          const inputFile = cmd.split(/\s+/)[2] || 'photo.png';
          addLine(`Output saved to: ${stripExtension(inputFile)}_resize.${inputFile.includes('.') ? (inputFile.split('.').pop() || 'png') : 'png'}`);
          setIsProcessing(false);
        }
        break;
      }
      default:
        addLine(`✗ Unknown command or formatting: "${commandType}"`);
        addLine('  Run `omx --help` for available commands.');
        setIsProcessing(false);
    }
  };

  const renderProgressBar = (progress: number = 0) => {
    const width = 20;
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-sm overflow-hidden bg-[#E8E4E1] border border-black/10 shadow-lg relative">
      <div className="absolute top-4 right-4 flex space-x-1.5 z-10 opacity-30">
        <div className="w-2 h-2 rounded-full bg-black"></div>
        <div className="w-2 h-2 rounded-full bg-black"></div>
        <div className="w-2 h-2 rounded-full bg-black"></div>
      </div>
      <div className="flex items-center px-4 py-3 border-b border-black/5 bg-[#E8E4E1]">
        <div className="mx-auto text-[10px] font-bold uppercase tracking-widest text-black/40">bash — omx</div>
      </div>
      
      <div className="p-6 h-[280px] md:h-[400px] overflow-y-auto font-mono text-[13px] leading-[1.6]" onClick={() => document.getElementById('term-input')?.focus()}>
        {lines.map((line) => (
          <div 
            key={line.id} 
            className={`mb-2 whitespace-pre-wrap ${line.isInput ? 'text-[#FF6321] font-bold' : 'text-[#1A1A1A] font-medium opacity-80'}`}
          >
            {line.isProgressBar && (
              <span className="text-black/40 mr-2 font-bold">{renderProgressBar(line.progress || 0)}</span>
            )}
            {line.text}
          </div>
        ))}
        
        <form onSubmit={handleCommand} className="flex gap-2 mt-2">
          <span className="text-black/40 font-bold">$</span>
          <input
            id="term-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isProcessing}
            className="flex-1 bg-transparent outline-none text-[#FF6321] font-bold font-mono"
            autoComplete="off"
            spellCheck="false"
          />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
