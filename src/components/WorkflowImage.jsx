import { useState, useId } from "react";
import { analyzeImage, generateImage } from "../utils/ApiHelpers";
import ImageCard from "./ImageCard";

const useGeminiDescribe = Boolean(import.meta.env.VITE_GEMINI_API_KEY);

function WorkflowImage() {
  const fileInputId = useId();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(null);
  const [error, setError] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  const handleAnalyze = async () => {
    setError("");
    setCaption("");
    setCopyDone(false);
    setLoading(true);
    setLoadingPhase("analyze");
    const result = await analyzeImage(file);
    setLoading(false);
    setLoadingPhase(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCaption(result.caption);
  };

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    setLoadingPhase("generate");
    const result = await generateImage(caption);
    setLoading(false);
    setLoadingPhase(null);
    setImages(result.urls);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleCopyCaption = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  return (
    <section
      className="workflow workflow-image"
      aria-labelledby="workflow-image-title"
      aria-busy={loading}
    >
      <header className="workflow-header">
        <h2 id="workflow-image-title">Image workflow</h2>
        <p className="workflow-lede">
          {useGeminiDescribe
            ? "Describe an image, then generate variations."
            : "Describe an image (BLIP), then generate variations. Add a Gemini key in .env to use Gemini instead."}
        </p>
      </header>

      <div className="workflow-card">
        <label className="workflow-label" htmlFor={fileInputId}>
          Source image
        </label>
        <div className="workflow-file-row">
          <input
            id={fileInputId}
            className="workflow-file-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setCaption("");
              setError("");
              setImages([]);
            }}
          />
          <label htmlFor={fileInputId} className="workflow-file-pick">
            {file ? "Change image" : "Choose image"}
          </label>
          <span className="workflow-file-name" title={file?.name}>
            {file ? file.name : "No file selected"}
          </span>
        </div>
        <div className="workflow-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !file}
            onClick={handleAnalyze}
          >
            Describe image
          </button>
        </div>
        {loadingPhase === "analyze" && (
          <p className="workflow-status" role="status">
            Describing…
          </p>
        )}
      </div>

      {error && (
        <div className="workflow-alert" role="alert">
          {error}
        </div>
      )}

      {caption && (
        <div className="workflow-card workflow-card-output">
          <div className="workflow-output-head">
            <h3 className="workflow-subtitle">Description</h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopyCaption}
              disabled={loading}
            >
              {copyDone ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="workflow-output-text">{caption}</p>
          <div className="workflow-actions workflow-actions-tight">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !caption.trim()}
            >
              Generate variations
            </button>
          </div>
          {loadingPhase === "generate" && (
            <p className="workflow-status workflow-status-tight" role="status">
              Generating…
            </p>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="workflow-gallery">
          <h3 className="workflow-subtitle workflow-gallery-title">Images</h3>
          <div className="workflow-gallery-grid">
            {images.map((img, index) => (
              <ImageCard
                key={index}
                src={img}
                downloadName={`variation-${index + 1}.png`}
                alt={`Generated variation ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkflowImage;
