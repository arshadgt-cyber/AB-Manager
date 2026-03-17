import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, Sparkles, Image as ImageIcon, 
  Video, FileText, Search, MapPin, Brain, Zap,
  Loader2, Download, Upload, X, Play, User
} from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { User as FirebaseUser } from 'firebase/auth';

type Tab = 'chat' | 'image' | 'video';

export const AIStudio = ({ user }: { user: FirebaseUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#a12328] to-[#c42e34] rounded-xl flex items-center justify-center text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">AB Manager AI Studio</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Powered by Gemini
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={Bot} label="Chat & Analysis" />
          <TabButton active={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={ImageIcon} label="Image Studio" />
          <TabButton active={activeTab === 'video'} onClick={() => setActiveTab('video')} icon={Video} label="Video Studio" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && <ChatInterface user={user} />}
        {activeTab === 'image' && <ImageStudio />}
        {activeTab === 'video' && <VideoStudio />}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-[#a12328] text-white shadow-md' 
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

// --- Chat Interface ---
const ChatInterface = ({ user }: { user: FirebaseUser }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: "Hello! I'm your advanced AI assistant. I can analyze images, understand videos, search the web, check maps, or just chat. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('pro');
  const [attachment, setAttachment] = useState<{ file: File, data: string, mimeType: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => scrollToBottom(), [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setAttachment({ file, data: base64String, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || loading) return;

    const userMessage = input.trim();
    setInput('');
    const currentAttachment = attachment;
    setAttachment(null);

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      attachment: currentAttachment ? currentAttachment.file.name : null
    }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      let modelName = 'gemini-3.1-pro-preview';
      let config: any = {};
      let contents: any = userMessage;

      if (selectedModel === 'flash-lite') {
        modelName = 'gemini-3.1-flash-lite-preview';
      } else if (selectedModel === 'thinking') {
        modelName = 'gemini-3.1-pro-preview';
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (selectedModel === 'search') {
        modelName = 'gemini-3-flash-preview';
        config.tools = [{ googleSearch: {} }];
      } else if (selectedModel === 'maps') {
        modelName = 'gemini-2.5-flash';
        config.tools = [{ googleMaps: {} }];
      }

      if (currentAttachment) {
        contents = {
          parts: [
            { inlineData: { data: currentAttachment.data, mimeType: currentAttachment.mimeType } },
            { text: userMessage || "Please analyze this file." }
          ]
        };
        // Force Pro for video/image analysis if not already set to a capable model
        if (currentAttachment.mimeType.startsWith('video/') || currentAttachment.mimeType.startsWith('image/')) {
           if (selectedModel !== 'pro' && selectedModel !== 'thinking') {
             modelName = 'gemini-3.1-pro-preview'; // Best for analysis
           }
        }
      }

      const response = await ai.models.generateContent({ 
        model: modelName,
        config,
        contents
      });

      let text = response.text || "I couldn't generate a response.";
      
      // Extract grounding links if any
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        text += "\n\n**Sources:**\n";
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) text += `- [${chunk.web.title}](${chunk.web.uri})\n`;
          if (chunk.maps?.uri) text += `- [${chunk.maps.title}](${chunk.maps.uri})\n`;
        });
      }

      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error processing request. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Model Selector */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex gap-2 overflow-x-auto no-scrollbar">
        <ModelOption active={selectedModel === 'pro'} onClick={() => setSelectedModel('pro')} icon={Brain} label="Smart (Pro)" />
        <ModelOption active={selectedModel === 'flash-lite'} onClick={() => setSelectedModel('flash-lite')} icon={Zap} label="Fast (Flash-Lite)" />
        <ModelOption active={selectedModel === 'thinking'} onClick={() => setSelectedModel('thinking')} icon={Brain} label="Deep Think" />
        <ModelOption active={selectedModel === 'search'} onClick={() => setSelectedModel('search')} icon={Search} label="Web Search" />
        <ModelOption active={selectedModel === 'maps'} onClick={() => setSelectedModel('maps')} icon={MapPin} label="Maps Data" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' ? 'bg-slate-100 dark:bg-slate-700 text-slate-600' : 'bg-[#a12328] text-white'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-tr-none' 
                  : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
              }`}>
                {msg.attachment && (
                  <div className="mb-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg flex items-center gap-2 text-xs font-bold text-slate-500">
                    <FileText size={14} /> {msg.attachment}
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-lg bg-[#a12328] text-white flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold">
            <FileText size={14} />
            <span className="truncate max-w-[200px]">{attachment.file.name}</span>
            <button onClick={() => setAttachment(null)} className="hover:text-indigo-800"><X size={14} /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*"
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-white dark:bg-slate-800 text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-700 hover:text-[#a12328] transition-colors"
            title="Upload Image or Video for Analysis"
          >
            <Upload size={20} />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything or upload a file to analyze..."
            className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 ring-[#a12328]/20 text-sm"
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !attachment) || loading}
            className="p-3 bg-[#a12328] text-white rounded-2xl shadow-lg hover:bg-[#8a1e22] transition-all disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ModelOption = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
      active 
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
    }`}
  >
    <Icon size={12} />
    {label}
  </button>
);

// --- Image Studio ---
const ImageStudio = () => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setReferenceImage({ data: base64String, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setGeneratedImage(null);

    try {
      // Check for API key if using Pro or Flash Image 3.1
      if (model !== 'gemini-2.5-flash-image') {
        // @ts-ignore
        if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '' });
      
      let contents: any = { parts: [{ text: prompt }] };
      if (referenceImage) {
        contents.parts.unshift({
          inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType }
        });
      }

      const response = await ai.models.generateContent({
        model: model,
        contents,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            ...(model === 'gemini-3-pro-image-preview' ? { imageSize } : {})
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Image Gen Error:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Controls */}
        <div className="space-y-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Model</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium">
              <option value="gemini-2.5-flash-image">Nano Banana (Free)</option>
              <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (Paid API Key)</option>
              <option value="gemini-3-pro-image-preview">Nano Banana Pro (Paid API Key)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Aspect Ratio</label>
            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium">
              <option value="1:1">1:1 (Square)</option>
              <option value="4:3">4:3 (Landscape)</option>
              <option value="3:4">3:4 (Portrait)</option>
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="9:16">9:16 (Vertical)</option>
              {model !== 'gemini-2.5-flash-image' && (
                <>
                  <option value="3:2">3:2</option>
                  <option value="2:3">2:3</option>
                  <option value="21:9">21:9 (Cinematic)</option>
                </>
              )}
            </select>
          </div>

          {model === 'gemini-3-pro-image-preview' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Resolution</label>
              <select value={imageSize} onChange={e => setImageSize(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium">
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Reference Image (Optional for Editing)</label>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-[#a12328] hover:text-[#a12328] transition-colors flex items-center justify-center gap-2 text-sm font-bold">
              <Upload size={16} /> Upload Image
            </button>
            {referenceImage && <p className="text-xs text-emerald-600 mt-2 font-bold">✓ Image attached</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Prompt</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create or edit..."
              className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="w-full py-4 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {loading ? 'Generating...' : 'Generate Image'}
          </button>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden relative min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <Loader2 size={48} className="animate-spin" />
              <p className="font-medium animate-pulse">Creating your masterpiece...</p>
            </div>
          ) : generatedImage ? (
            <>
              <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <a href={generatedImage} download="generated-image.png" className="absolute top-4 right-4 p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-xl shadow-lg text-slate-700 dark:text-white hover:text-[#a12328] transition-colors">
                <Download size={20} />
              </a>
            </>
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-2">
              <ImageIcon size={48} className="opacity-50" />
              <p className="font-medium">Your generated image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Video Studio ---
const VideoStudio = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setReferenceImage({ data: base64String, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    setVideoUrl(null);

    try {
      // @ts-ignore
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }

      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || undefined,
        ...(referenceImage ? {
          image: { imageBytes: referenceImage.data, mimeType: referenceImage.mimeType }
        } : {}),
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // Fetch to get the actual video blob using the API key
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      } else {
        throw new Error("No video URI returned");
      }
    } catch (error) {
      console.error("Video Gen Error:", error);
      alert("Failed to generate video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Controls */}
        <div className="space-y-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Aspect Ratio</label>
            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium">
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Portrait)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Resolution</label>
            <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium">
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Starting Image (Optional)</label>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:border-[#a12328] hover:text-[#a12328] transition-colors flex items-center justify-center gap-2 text-sm font-bold">
              <Upload size={16} /> Upload Image
            </button>
            {referenceImage && <p className="text-xs text-emerald-600 mt-2 font-bold">✓ Image attached</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Prompt</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the video you want to generate..."
              className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={(!prompt.trim() && !referenceImage) || loading}
            className="w-full py-4 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
            {loading ? 'Generating (Takes a few mins)...' : 'Generate Video'}
          </button>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden relative min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <Loader2 size={48} className="animate-spin" />
              <p className="font-medium animate-pulse">Generating video... This may take a few minutes.</p>
            </div>
          ) : videoUrl ? (
            <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-2">
              <Video size={48} className="opacity-50" />
              <p className="font-medium">Your generated video will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
