import CodeWriter from "@/components/CodeWriter";

export default function CodeWriterPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Code Writer</h1>
          <p className="mt-2 text-gray-600">
            Draft snippets, copy to clipboard, or download as a file. Your work is saved locally in
            this browser.
          </p>
        </div>

        <CodeWriter storageKey="travelcms.codeWriter.page" />
      </div>
    </div>
  );
}

