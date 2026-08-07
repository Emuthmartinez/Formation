/**
 * Taking the work out of Formation.
 *
 * Plain anchors rather than a fetch-and-blob dance: the browser already knows how to download a
 * file, it already sends the session cookie on a same-origin request, and the server already sets
 * the filename. Doing it by hand would add three failure modes and remove none.
 *
 * Three formats, named by what they are for rather than by their extension. A founder deciding
 * between "Markdown" and "CSV" is being asked a question about file formats; one deciding between
 * "a document to read" and "a spreadsheet of the numbers" is being asked about their afternoon.
 */
const FORMATS: Array<{ id: string; label: string; title: string }> = [
  { id: "markdown", label: "Document", title: "The whole record as a document, with the evidence under each deliverable" },
  { id: "csv", label: "Numbers", title: "The pricing scenarios and what follows from them, as a spreadsheet" },
  { id: "json", label: "Structured", title: "Everything, structured, for another tool to read" },
];

export function ExportBundle({ workspaceId }: { workspaceId: string }) {
  return (
    <span className="export-bundle">
      <span className="export-bundle__label">Export</span>
      {FORMATS.map((format) => (
        <a key={format.id} href={`/api/workspaces/${workspaceId}/export?format=${format.id}`} title={format.title} download>
          {format.label}
        </a>
      ))}
    </span>
  );
}
