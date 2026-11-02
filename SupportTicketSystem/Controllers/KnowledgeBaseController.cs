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
}
