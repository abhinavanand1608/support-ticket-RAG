import { useRef, useState } from 'react';
import { useUploadDocumentMutation } from '../features/kb/kbApi';
import { getErrorMessage } from '../utils/apiError';
import { ErrorText } from '../components/StatusMessage';

export default function AdminKnowledgeBaseUploadPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const formRef = useRef(null);

  const [uploadDocument, { isLoading, error }] = useUploadDocumentMutation();

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
    </div>
  );
}
