# Multi-stage build: compile with the full SDK image, then copy only the
# published output into the much smaller ASP.NET runtime image - keeps
# the final image small and avoids shipping the SDK/compiler to production.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the project file first and restore before copying the rest of the
# source - Docker caches each layer by its inputs, so as long as the
# .csproj (dependencies) hasn't changed, rebuilds after a source-only
# change skip re-downloading NuGet packages entirely.
COPY SupportTicketSystem.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SupportTicketSystem.dll"]
