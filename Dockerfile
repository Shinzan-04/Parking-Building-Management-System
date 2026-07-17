# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["be/ParkingBuildingManager.sln", "be/"]
COPY ["be/ParkingSystem.API/ParkingSystem.API.csproj", "be/ParkingSystem.API/"]
COPY ["be/ParkingSystem.Application/ParkingSystem.Application.csproj", "be/ParkingSystem.Application/"]
COPY ["be/ParkingSystem.Domain/ParkingSystem.Domain.csproj", "be/ParkingSystem.Domain/"]
COPY ["be/ParkingSystem.Infrastructure/ParkingSystem.Infrastructure.csproj", "be/ParkingSystem.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "be/ParkingSystem.API/ParkingSystem.API.csproj"

# Copy the rest of the source code
COPY ["be/", "be/"]

# Build and publish the API
WORKDIR "/src/be/ParkingSystem.API"
RUN dotnet publish "ParkingSystem.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render exposes the PORT environment variable
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ParkingSystem.API.dll"]
