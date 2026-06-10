import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyBackground,
  AiModel,
  BACKGROUND_OPTIONS,
  BackgroundColor,
  downloadImage,
  fetchAiModels,
  generateIdPhoto,
  pickDefaultModel,
} from './utils/imageUtils';
import './App.css';

function App() {
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [generatedRaw, setGeneratedRaw] = useState<string | null>(null);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundColor>('blue');
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const displayUrlRef = useRef<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const operationIdRef = useRef(0);

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const revokeDisplayUrl = () => {
    if (displayUrlRef.current) {
      URL.revokeObjectURL(displayUrlRef.current);
      displayUrlRef.current = null;
    }
  };

  const setDisplayUrl = (url: string | null) => {
    revokeDisplayUrl();
    if (url?.startsWith('blob:')) {
      displayUrlRef.current = url;
    }
    setDisplayImage(url);
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl();
      revokeDisplayUrl();
    };
  }, []);

  useEffect(() => {
    fetchAiModels()
      .then((models) => {
        setAiModels(models);
        setSelectedModel(pickDefaultModel(models));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '无法连接 API 服务');
      });
  }, []);

  const selectedModelInfo = aiModels.find((m) => m.id === selectedModel);

  const processBackground = useCallback(
    async (rawImage: string, bg: BackgroundColor, opId: number) => {
      setIsProcessingBg(true);
      try {
        const result = await applyBackground(rawImage, bg);
        if (opId !== operationIdRef.current) return;
        setDisplayUrl(result);
      } catch {
        if (opId !== operationIdRef.current) return;
        setDisplayUrl(rawImage);
      } finally {
        if (opId === operationIdRef.current) {
          setIsProcessingBg(false);
        }
      }
    },
    [],
  );

  const runGeneration = useCallback(
    async (file: File, { isRegenerate = false } = {}) => {
      if (!file.type.startsWith('image/')) {
        setError('请上传 JPG、PNG 或 WEBP 格式的图片');
        return;
      }

      if (!selectedModel) {
        setError('请等待 AI 模型加载完成');
        return;
      }

      const opId = ++operationIdRef.current;
      setError(null);
      pendingFileRef.current = file;

      if (!isRegenerate) {
        revokePreviewUrl();
        revokeDisplayUrl();
        setGeneratedRaw(null);
        setDisplayUrl(null);

        const preview = URL.createObjectURL(file);
        previewUrlRef.current = preview;
        setOriginalPreview(preview);
      }

      setIsGenerating(true);
      try {
        const generated = await generateIdPhoto(file, selectedModel);
        if (opId !== operationIdRef.current) return;

        setGeneratedRaw(generated);
        setDisplayUrl(generated);
        await processBackground(generated, background, opId);
      } catch (err) {
        if (opId !== operationIdRef.current) return;
        setError(err instanceof Error ? err.message : '生成失败，请重试');
      } finally {
        if (opId === operationIdRef.current) {
          setIsGenerating(false);
        }
      }
    },
    [background, processBackground, selectedModel],
  );

  const handleFile = useCallback(
    (file: File) => runGeneration(file),
    [runGeneration],
  );

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const file = pendingFileRef.current;
    if (!file) {
      setError('未找到已上传的照片，请重新上传');
      return;
    }
    runGeneration(file, { isRegenerate: true });
  };

  const handleBackgroundChange = async (bg: BackgroundColor) => {
    setBackground(bg);
    if (!generatedRaw) return;

    const opId = ++operationIdRef.current;
    await processBackground(generatedRaw, bg, opId);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">📸</span>
            <div>
              <h1>美式证件照生成器</h1>
              <p>上传原始照片，AI 自动生成专业美式证件照</p>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel panel-upload">
          <div className="panel-header">
            <span className="panel-badge">输入</span>
            <h2>原始照片上传区</h2>
          </div>

          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''} ${originalPreview ? 'has-image' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileSelect}
              hidden
            />

            {originalPreview ? (
              <div className="preview-container">
                <img src={originalPreview} alt="原始照片" className="preview-image" />
                <div className="preview-overlay">
                  <span>点击或拖拽更换照片</span>
                </div>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="upload-title">拖拽照片到此处，或点击上传</p>
                <p className="upload-hint">支持 JPG、PNG、WEBP，最大 10MB</p>
              </div>
            )}
          </div>

          <div className="upload-controls">
            <div className="control-group">
              <label className="control-label" htmlFor="ai-model-select">
                AI 生成模型
              </label>
              <select
                id="ai-model-select"
                className="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isGenerating || aiModels.length === 0}
              >
                {aiModels.map((model) => (
                  <option
                    key={model.id}
                    value={model.id}
                    disabled={!model.available}
                  >
                    {model.name} · {model.provider} · {model.badge}
                    {!model.available ? '（未配置）' : ''}
                  </option>
                ))}
              </select>

              {selectedModelInfo && (
                <div className="model-info">
                  <span
                    className={`model-badge ${
                      selectedModelInfo.id.startsWith('dashscope-')
                        ? 'model-badge-domestic'
                        : `model-badge-${selectedModelInfo.badgeType}`
                    }`}
                  >
                    {selectedModelInfo.badge}
                  </span>
                  <p className="model-desc">{selectedModelInfo.description}</p>
                  <p className="model-time">预计耗时：{selectedModelInfo.estimatedTime}</p>
                </div>
              )}

              {originalPreview && !isGenerating && (
                <button
                  type="button"
                  className="regenerate-btn"
                  onClick={handleRegenerate}
                >
                  使用当前模型重新生成
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </section>

        <div className="panel-divider">
          <div className="divider-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        <section className="panel panel-output">
          <div className="panel-header">
            <span className="panel-badge panel-badge-output">输出</span>
            <h2>美式证件照输出区</h2>
          </div>

          <div className={`output-zone ${displayImage ? 'has-image' : ''}`}>
            {displayImage ? (
              <div className="output-preview">
                <img
                  src={displayImage}
                  alt="美式证件照"
                  className="preview-image"
                  style={{
                    background:
                      background === 'transparent'
                        ? 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 50% / 16px 16px'
                        : undefined,
                  }}
                />
                {isGenerating && (
                  <div className="processing-overlay">
                    <div className="spinner spinner-sm" />
                    <span>正在重新生成…</span>
                  </div>
                )}
                {isProcessingBg && !isGenerating && (
                  <div className="processing-overlay">
                    <div className="spinner spinner-sm" />
                    <span>切换背景中…</span>
                  </div>
                )}
              </div>
            ) : isGenerating ? (
              <div className="loading-state">
                <div className="spinner" />
                <p className="loading-title">正在生成美式证件照…</p>
                <p className="loading-hint">
                  {selectedModelInfo
                    ? `使用 ${selectedModelInfo.name}，${selectedModelInfo.estimatedTime}`
                    : 'AI 正在处理，请稍候'}
                </p>
              </div>
            ) : (
              <div className="output-placeholder">
                <div className="output-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <p className="output-title">上传照片后将在此显示</p>
                <p className="output-hint">美式专业证件照效果</p>
              </div>
            )}
          </div>

          <div className="controls">
            <div className="control-group">
              <label className="control-label">背景颜色</label>
              <div className="bg-options">
                {BACKGROUND_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`bg-option ${background === opt.id ? 'active' : ''}`}
                    onClick={() => handleBackgroundChange(opt.id)}
                    disabled={!generatedRaw || isProcessingBg}
                    title={opt.label}
                  >
                    {opt.color ? (
                      <span
                        className="bg-swatch"
                        style={{
                          background: opt.color,
                          border: opt.id === 'white' ? '1px solid #ddd' : 'none',
                        }}
                      />
                    ) : (
                      <span className="bg-swatch bg-transparent-swatch" />
                    )}
                    <span className="bg-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">导出格式</label>
              <div className="export-buttons">
                <button
                  type="button"
                  className="export-btn"
                  disabled={!displayImage}
                  onClick={() => displayImage && downloadImage(displayImage, 'png')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  导出 PNG
                </button>
                <button
                  type="button"
                  className="export-btn export-btn-secondary"
                  disabled={!displayImage}
                  onClick={() => displayImage && downloadImage(displayImage, 'jpg')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  导出 JPG
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>美式证件照 · 专业 AI 生成 · 支持自定义背景与多格式导出</p>
      </footer>
    </div>
  );
}

export default App;
