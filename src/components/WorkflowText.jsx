import { useState } from "react";
import { enhanceText, generateImage } from "../utils/ApiHelpers";
import ImageCard from "./ImageCard";

function isEnhanceFailureMessage(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  return (
    t.startsWith("Enhancement failed:") ||
    t.startsWith("Missing ") ||
    t === "Error enhancing text" ||
    t === "Enter a prompt to enhance."
  );
}

function WorkflowText() {
  const [prompt, setPrompt] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [genError, setGenError] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  const enhanceFailed = enhanced && isEnhanceFailureMessage(enhanced);

  const handleEnhance = async () => {
    setGenError("");
    setCopyDone(false);
    setLoading(true);
    setLoadingAction("enhance");
    const result = await enhanceText(prompt);
    setEnhanced(result);
    setLoading(false);
    setLoadingAction(null);
  };

  const handleGenerate = async () => {
    setGenError("");
    setLoading(true);
    setLoadingAction("generate");
    const result = await generateImage(enhanced);
    setImages(result.urls);
    if (result.error) {
      setGenError(result.error);
    }
    setLoading(false);
    setLoadingAction(null);
  };

  const handleCopyEnhanced = async () => {
    if (!enhanced || enhanceFailed) return;
    try {
      await navigator.clipboard.writeText(enhanced);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  return (
    <section
      className="workflow workflow-text"
      aria-labelledby="workflow-text-title"
      aria-busy={loading}
    >
      <header className="workflow-header">
        <h2 id="workflow-text-title">Text to image</h2>
        <p className="workflow-lede">Enhance a prompt, then generate an image.</p>
      </header>

      <div className="workflow-card">
        <label className="workflow-label" htmlFor="prompt-input">
          Your prompt
        </label>
        <textarea
          id="prompt-input"
          className="workflow-textarea"
          rows={5}
          placeholder="e.g. A fox reading a book in a rainy Tokyo alley at night, neon reflections…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          spellCheck
        />
        <div className="workflow-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEnhance}
            disabled={loading || !prompt.trim()}
          >
            Enhance prompt
          </button>
        </div>
        {loadingAction === "enhance" && (
          <p className="workflow-status" role="status">
            Enhancing…
          </p>
        )}
      </div>

      {enhanced && (
        <div
          className={`workflow-card workflow-card-output ${enhanceFailed ? "workflow-card-error" : ""}`}
        >
          <div className="workflow-output-head">
            <h3 className="workflow-subtitle">
              {enhanceFailed ? "Could not enhance" : "Enhanced prompt"}
            </h3>
            {!enhanceFailed && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCopyEnhanced}
                disabled={loading}
              >
                {copyDone ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <p className={`workflow-output-text ${enhanceFailed ? "workflow-error-text" : ""}`}>
            {enhanced}
          </p>
          {!enhanceFailed && (
            <div className="workflow-actions workflow-actions-tight">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!enhanced || enhanceFailed || loading}
              >
                Generate image
              </button>
            </div>
          )}
          {loadingAction === "generate" && (
            <p className="workflow-status workflow-status-tight" role="status">
              Generating…
            </p>
          )}
        </div>
      )}

      {genError && (
        <div className="workflow-alert" role="alert">
          {genError}
        </div>
      )}

      {images.length > 0 && (
        <div className="workflow-gallery">
          <h3 className="workflow-subtitle workflow-gallery-title">Image</h3>
          <div className="workflow-gallery-grid">
            {images.map((img, index) => (
              <ImageCard
                key={index}
                src={img}
                downloadName={`generated-${index + 1}.png`}
                alt={`Generated image ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkflowText;
