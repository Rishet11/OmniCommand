import { useState } from 'react';
import { Terminal } from './components/Terminal';
import { Terminal as TerminalIcon, Cpu, Shield, Zap, FileJson, FileText, Share2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install -g omx-cmd');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="font-sans antialiased bg-[#F4F1ED] text-[#1A1A1A] min-h-screen selection:bg-[#FF6321] selection:text-white relative flex flex-col pt-10">
      
      {/* Side Rail */}
      <div className="hidden lg:flex fixed top-0 right-0 w-16 xl:w-24 h-full border-l border-black/10 items-center justify-center pointer-events-none z-0">
        <p className="transform rotate-90 whitespace-nowrap text-[10px] tracking-[0.3em] font-bold text-black/40 uppercase">OmniCommand &middot; CLI, MCP, Demo</p>
      </div>

      <div className="max-w-[1200px] mx-auto w-full px-6 lg:px-12 flex-grow flex flex-col relative z-10">
        {/* Header */}
        <header className="border-b-[3px] border-black pb-6 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-baseline gap-6 mb-4">
              <span className="text-[12px] font-mono font-bold uppercase tracking-widest text-[#FF6321]">Status: Local-First</span>
              <span className="text-[12px] font-mono font-bold uppercase tracking-widest underline underline-offset-4">Scope: Real Workflows</span>
            </div>
            <div className="flex items-center gap-2 font-serif italic text-4xl md:text-5xl tracking-tight">
              <TerminalIcon className="w-8 h-8 text-[#FF6321]" />
              omx
            </div>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.2em] text-black/60">
            <a href="#features" className="hover:text-[#FF6321] transition-colors">Features</a>
            <a href="#docs" className="hover:text-[#FF6321] transition-colors">Docs</a>
            <a href="https://github.com/Rishet11/OmniCommand" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF6321] transition-colors">GitHub</a>
          </div>
        </header>

        {/* Hero */}
        <section className="pb-16 flex flex-col items-start border-b border-black/10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[60px] md:text-[90px] lg:text-[110px] font-serif italic leading-[0.85] tracking-tight mb-8"
          >
            The terminal tool <br /> <span className="text-black/30">for every format.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl font-medium text-black/80 max-w-3xl mb-12 leading-tight"
          >
            A practical file conversion CLI for documents, images, and media.
            Local by default, with optional AI refinement for scanned PDFs.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-6 mb-16"
          >
            <div className="relative group cursor-pointer" onClick={handleCopy}>
              <code className="flex items-center gap-6 bg-black px-6 py-4 rounded-sm text-[#F4F1ED] font-mono text-[13px] md:text-base border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-[#1A1A1A] transition-colors">
                <span>
                  {copied ? (
                    <span className="text-[#FF6321]">Copied to clipboard!</span>
                  ) : (
                    <><span className="text-white/40 select-none mr-3">$</span>npm install -g omx-cmd</>
                  )}
                </span>
              </code>
            </div>
            <div className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-[#FF6321]">
              <span className="text-black/40">One command. Real outputs.</span>
            </div>
          </motion.div>
          
          <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.4 }}
             className="w-full flex flex-col"
          >
            <Terminal />
            <div className="mt-6 flex flex-col md:flex-row items-baseline gap-4 md:gap-8 text-[11px] font-bold uppercase tracking-widest text-black/50">
               <span>Try real commands:</span>
               <div className="flex flex-wrap gap-4">
                   <button onClick={() => navigator.clipboard.writeText('omx convert report.pdf to markdown')} className="hover:text-[#FF6321] transition-colors underline underline-offset-4">PDF to Markdown &rarr;</button>
                   <button onClick={() => navigator.clipboard.writeText('omx convert scanned-report.pdf to markdown')} className="hover:text-[#FF6321] transition-colors underline underline-offset-4">Scanned PDF &rarr;</button>
                   <button onClick={() => navigator.clipboard.writeText('omx convert scanned-report.pdf to markdown --refine')} className="hover:text-[#FF6321] transition-colors underline underline-offset-4">AI Refine &rarr;</button>
                   <button onClick={() => navigator.clipboard.writeText('omx convert two-column.pdf to markdown')} className="hover:text-[#FF6321] transition-colors underline underline-offset-4">Two-Column PDF &rarr;</button>
                   <button onClick={() => navigator.clipboard.writeText('omx compress footage.mp4 to 50% --dry-run')} className="hover:text-[#FF6321] transition-colors underline underline-offset-4">Dry Run &rarr;</button>
               </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 border-b border-black/10">
          <div className="mb-16">
            <h2 className="font-serif italic text-3xl md:text-4xl mb-4">01. Real Workflows, Fewer Flags</h2>
            <p className="text-lg font-medium text-black/60 max-w-2xl">The interface stays close to how people actually work: plain language commands, local processing, and clear fallbacks when a format needs help.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
            <FeatureCard 
              icon={<Zap className="w-6 h-6" />}
              title="Natural Language CLI"
              description="The parser accepts the phrases users already type: convert, compress, trim, extract, and resize."
            />
            <FeatureCard 
              icon={<Cpu className="w-6 h-6" />}
              title="Bundled Media Tools"
              description="Video and audio work runs through ffmpeg-static. Images use Sharp. Documents use Pandoc when it is installed."
            />
            <FeatureCard 
              icon={<FileJson className="w-6 h-6" />}
              title="Script Friendly"
              description="Dry-run previews do not write files, JSON output stays structured, and the CLI exits cleanly for automation."
            />
            <FeatureCard 
              icon={<FileText className="w-6 h-6" />}
              title="Optional AI Refinement"
              description="Pass --refine for scanned PDFs when you have a Gemini API key. Everything else stays local."
            />
            <FeatureCard 
              icon={<Share2 className="w-6 h-6" />}
              title="MCP Support"
              description="The MCP server exposes the same real CLI workflows to agentic tools through Model Context Protocol."
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6" />}
              title="Local by Default"
              description="No cloud call is needed for standard conversion. The only networked path is the explicit AI refinement flow."
            />
          </div>
        </section>

        {/* Docs Snippets */}
        <section id="docs" className="py-24">
            <h2 className="font-serif italic text-3xl md:text-4xl mb-12">02. Command Reference</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <DocCard title="Convert" code={
  `# Video, images, documents
omx convert video.mp4 to gif
omx convert report.pdf to markdown

# Fix broken OCR/tables with AI
omx convert report.pdf to markdown --refine`} />

            <DocCard title="Compress & Edit" code={
  `# Percentage or absolute targets
omx compress photo.png to 200kb
omx compress video.mp4 to 50%

# Basic video editing
omx trim clip.mp4 from 0:30 to 1:45
omx extract audio from video.mp4
omx resize photo.png to 800px`} />

            <DocCard title="Batch Processing" code={
  `# Using native bash loops for batch scaling
for f in *.png; do omx compress "$f" to 80%; done

# Safe preview in a loop
for f in *.mp4; do omx compress "$f" to 50% --dry-run; done`} />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto flex flex-col md:flex-row justify-between md:items-end border-t-[3px] border-black py-8 text-[10px] uppercase font-bold tracking-[0.2em]">
          <div className="flex flex-col md:flex-row gap-4 md:space-x-8 mb-6 md:mb-0 text-black/60">
            <span>Local-first</span>
            <span>Optional AI refine</span>
            <span>MCP ready</span>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="opacity-40">Built around real CLI workflows</span>
            <span className="text-[#FF6321]">github.com/Rishet11/OmniCommand</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group border-t-[3px] border-black pt-6">
      <div className="mb-4 text-black/50">
        {icon}
      </div>
      <h3 className="text-[12px] font-bold uppercase tracking-widest mb-3 text-[#1A1A1A]">{title}</h3>
      <p className="text-black/60 text-[13px] leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function DocCard({ title, code }: { title: string, code: string }) {
  return (
    <div className="bg-[#E8E4E1] p-6 rounded-sm border border-black/5 font-mono text-[12px] leading-relaxed relative flex flex-col">
      <div className="absolute top-4 right-4 flex space-x-1.5 opacity-40">
        <div className="w-2 h-2 rounded-full bg-black"></div>
        <div className="w-2 h-2 rounded-full bg-black"></div>
        <div className="w-2 h-2 rounded-full bg-black"></div>
      </div>
      <div className="mb-4 pb-2 border-b border-black/5 text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
        // {title}
      </div>
      <pre className="overflow-x-auto text-[#1A1A1A] flex-grow">
        <code>{code}</code>
      </pre>
    </div>
  );
}
