import { Navigate, Route, Routes } from "react-router-dom";
import { DraftProvider } from "./draft.jsx";
import {
  Docs,
  ExampleDetail,
  Examples,
  Flow,
  Generating,
  History,
  Home,
  How,
  LiveSite,
  Preview,
  Publish,
  ReferenceFailed,
} from "./pages.jsx";
import { Shell } from "./ui.jsx";

export default function App() {
  return (
    <DraftProvider>
      <Routes>
        <Route path="/s/:slug" element={<LiveSite />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/generating" element={<Generating />} />
          <Route path="/reference-failed" element={<ReferenceFailed />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/how" element={<How />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/history" element={<History />} />
          <Route path="/examples" element={<Examples />} />
          <Route path="/examples/:id" element={<ExampleDetail />} />
          <Route path="/docs" element={<Navigate to="/docs/who" replace />} />
          <Route path="/docs/:slug" element={<Docs />} />
        </Route>
      </Routes>
    </DraftProvider>
  );
}
