using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.DTOs;
using SupportTicketSystem.Services;
using UglyToad.PdfPig;

namespace SupportTicketSystem.Controllers;

[ApiController]
[Route("api/kb")]
[Authorize(Roles = "Admin")]
public class KnowledgeBaseController : ControllerBase {
    private readonly IKnowledgeBaseClient _kbClient;

    public KnowledgeBaseController(IKnowledgeBaseClient kbClient) {
        _kbClient = kbClient;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadDocument([FromForm] UploadDocumentDto dto) {
        if (dto.File.Length == 0) {
            return BadRequest("No file provided.");
        }

        var extension = Path.GetExtension(dto.File.FileName).ToLowerInvariant();
        string extractedText;

        using (var stream = dto.File.OpenReadStream()) {
            if (extension == ".pdf") {
                extractedText = ExtractPdfText(stream);
            } else if (extension == ".txt") {
                using var reader = new StreamReader(stream);
                extractedText = await reader.ReadToEndAsync();
            } else {
                return BadRequest("Unsupported file type. Only .pdf and .txt are supported.");
            }
        }

        if (string.IsNullOrWhiteSpace(extractedText)) {
            return BadRequest("No extractable text was found in the uploaded file.");
        }

        var kbId = string.IsNullOrWhiteSpace(dto.KbId) ? "support-kb" : dto.KbId;
        var docId = Guid.NewGuid().ToString();

        try {
            var chunksCreated = await _kbClient.IngestAsync(kbId, docId, dto.Title, extractedText);

            return Ok(new UploadDocumentResponseDto {
                DocId = docId,
                Title = dto.Title,
                ChunksCreated = chunksCreated,
            });
        }
        catch (KnowledgeBaseIngestException e) {
            return StatusCode(502, e.Message);
        }
    }

    private static string ExtractPdfText(Stream stream) {
        var sb = new StringBuilder();
        using var document = PdfDocument.Open(stream);
        foreach (var page in document.GetPages()) {
            sb.AppendLine(page.Text);
        }
        return sb.ToString();
    }

    // Lets an Admin see what's actually in the KB rather than just
    // trusting the "chunks created" message from the last upload -
    // without this, there was no way to answer "what have I already
    // ingested?" short of re-querying /kb/retrieve with guesses.
    [HttpGet("documents")]
    public async Task<IActionResult> ListDocuments([FromQuery] string? kbId) {
        var resolvedKbId = string.IsNullOrWhiteSpace(kbId) ? "support-kb" : kbId;

        try {
            var documents = await _kbClient.ListDocumentsAsync(resolvedKbId);
            return Ok(documents);
        }
        catch (KnowledgeBaseIngestException e) {
            return StatusCode(502, e.Message);
        }
    }

    // Deletes every chunk belonging to a document. There's no "undo" -
    // the Admin would need to re-upload the original file, which this
    // app never stores (see the Phase 6 design note on why the raw file
    // itself is discarded after extraction) - the frontend confirms
    // before calling this for exactly that reason.
    [HttpDelete("documents/{docId}")]
    public async Task<IActionResult> DeleteDocument(string docId, [FromQuery] string? kbId) {
        var resolvedKbId = string.IsNullOrWhiteSpace(kbId) ? "support-kb" : kbId;

        try {
            var chunksRemoved = await _kbClient.DeleteDocumentAsync(resolvedKbId, docId);
            return Ok(new { chunksRemoved });
        }
        catch (KnowledgeBaseDocumentNotFoundException) {
            return NotFound();
        }
        catch (KnowledgeBaseIngestException e) {
            return StatusCode(502, e.Message);
        }
    }
}
