import { useState } from "react";
import Navbar from "./components/Navbar";
import WorkflowText from "./components/WorkflowText";
import WorkflowImage from "./components/WorkflowImage";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("text");

  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div id="workflow-panel" role="tabpanel" aria-labelledby={activeTab === "text" ? "tab-text" : "tab-image"}>
        {activeTab === "text" ? <WorkflowText /> : <WorkflowImage />}
      </div>
    </div>
  );
}

export default App;
