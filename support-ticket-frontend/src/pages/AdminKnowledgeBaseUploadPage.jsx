import { useRef, useState } from 'react';
import {
  useUploadDocumentMutation,
  useGetDocumentsQuery,
  useDeleteDocumentMutation,
} from '../features/kb/kbApi';
import { getErrorMessage } from '../utils/apiError';
import { Loading, ErrorText } from '../components/StatusMessage';

export default function AdminKnowledgeBaseUploadPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const formRef = useRef(null);

  const [uploadDocument, { isLoading, error }] = useUploadDocumentMutation();

  const {
    data: documents,
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useGetDocumentsQuery();

  const [deleteDocument, { isLoading: isDeleting, error: deleteError }] =
    useDeleteDocumentMutation();

  // Tracks which row is mid-delete, so only that row shows a disabled
  // state instead of the whole list locking up - same pattern as
  // AdminUsersPage's pendingUserId.
  const [pendingDocId, setPendingDocId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('Title', title);
    formData.append('File', file);

    setResult(null);
    try {
      const response = await uploadDocument(formData).unwrap();
      setResult(response);
      setTitle('');
      setFile(null);
      formRef.current?.reset();
    } catch {
      // surfaced via error
    }
  }

  async function handleDelete(doc) {
    // There's no undo - the original file was never stored (see the
    // Phase 6 design note: only extracted/chunked text persists), so
    // re-adding this document means re-uploading the source file from
    // scratch. The confirm dialog exists specifically because of that.
    if (
      !window.confirm(
        `Remove "${doc.title}" from the knowledge base? This can't be undone - you'd need to re-upload the original file to add it back.`
      )
    ) {
      return;
    }
    setPendingDocId(doc.docId);
    try {
      await deleteDocument(doc.docId).unwrap();
    } catch {
      // surfaced via deleteError
    } finally {
      setPendingDocId(null);
    }
  }

  return (
    <div className="page">
      <h1>Upload Knowledge Base Document</h1>
      <form ref={formRef} className="card-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Document (.pdf or .txt)
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files[0] || null)}
            required
          />
        </label>

        {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

        <button type="submit" disabled={isLoading || !file}>
          {isLoading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {result && (
        <p className="status-message status-message--success">
          &quot;{result.title}&quot; ingested successfully &mdash; {result.chunksCreated}{' '}
          chunk{result.chunksCreated === 1 ? '' : 's'} created.
        </p>
      )}

      <h2>Ingested Documents</h2>

      {isLoadingDocuments && <Loading />}
      {documentsError && <ErrorText>{getErrorMessage(documentsError)}</ErrorText>}
      {deleteError && <ErrorText>{getErrorMessage(deleteError)}</ErrorText>}

      {documents && documents.length === 0 && (
        <p className="status-message">
          Nothing ingested yet - upload a document above to get started.
        </p>
      )}

      {documents && documents.length > 0 && (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Chunks</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.docId}>
                <td>{doc.title}</td>
                <td>{doc.chunkCount}</td>
                <td>{doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '-'}</td>
                <td>
                  <button
                    type="button"
                    disabled={isDeleting && pendingDocId === doc.docId}
                    onClick={() => handleDelete(doc)}
                  >
                    {isDeleting && pendingDocId === doc.docId ? 'Removing...' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
