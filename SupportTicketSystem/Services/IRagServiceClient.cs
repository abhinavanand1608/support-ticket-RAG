

public interface IRagServiceClient {
    Task<(string Category, string Priority)> ClassifyAsync(string title, string description);
}