# ============================================================
# SGA - Dockerfile (API .NET 10)
# ============================================================

# --- Etapa de build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Web uni C#.csproj", "./"]
RUN dotnet restore "Web uni C#.csproj"

COPY . .
RUN dotnet publish "Web uni C#.csproj" -c Release -o /app/publish --no-restore

# --- Etapa final (runtime) ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Web uni C#.dll"]
