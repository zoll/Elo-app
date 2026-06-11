# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npx vite build --outDir /dist --emptyOutDir

# Stage 2: Build .NET backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/ ./
COPY --from=frontend-build /dist ./wwwroot
RUN dotnet restore
RUN dotnet publish -c Release -o /publish

# Stage 3: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend-build /publish ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "TableTennis.Api.dll"]
