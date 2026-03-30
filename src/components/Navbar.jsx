function Navbar({ activeTab, setActiveTab }) {
  return (
    <header className="app-nav">
      <nav className="app-nav-tabs" role="tablist" aria-label="Workflow">
        <button
          type="button"
          role="tab"
          id="tab-text"
          aria-selected={activeTab === "text"}
          aria-controls="workflow-panel"
          className={`app-nav-tab ${activeTab === "text" ? "app-nav-tab-active" : ""}`}
          onClick={() => setActiveTab("text")}
        >
          Text to image
        </button>
        <button
          type="button"
          role="tab"
          id="tab-image"
          aria-selected={activeTab === "image"}
          aria-controls="workflow-panel"
          className={`app-nav-tab ${activeTab === "image" ? "app-nav-tab-active" : ""}`}
          onClick={() => setActiveTab("image")}
        >
          Image workflow
        </button>
      </nav>
    </header>
  );
}

export default Navbar;
