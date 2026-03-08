# Build Guide - Spark Assembly Lab

This guide covers building Spark Assembly Lab using Docker. **All builds must be run through Docker** - do not run `npm run build` locally.

## Quick Build

From the repository root:

```bash
./build.sh
```

This will build the production Docker image `spark-assembly-lab:latest`.

## Build Methods

### Method 1: Build Script (Recommended)

```bash
./build.sh
```

Advantages:
- Simple one-command build
- Automatic image tagging
- Built-in usage instructions
- Standard build output

### Method 2: Docker Compose

From `spark-assembly-lab/` directory:

```bash
docker compose -f docker-compose.prod.yml build
```

### Method 3: Docker Build (Manual)

From repository root:

```bash
docker build \
  -f spark-assembly-lab/Dockerfile.prod \
  -t spark-assembly-lab:latest \
  .
```

## Running the Built Image

### Local Testing

```bash
docker run -p 8080:8080 spark-assembly-lab:latest
```

Access at `http://localhost:8080`

### Using Docker Compose (Production)

```bash
cd spark-assembly-lab
docker compose -f docker-compose.prod.yml up -d
```

Logs:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

Stop:
```bash
docker compose -f docker-assembly-lab docker-compose.prod.yml down
```

## Build Configuration

### Environment Variables

Create `.env` file in `spark-assembly-lab/`:

```bash
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
SPARK_REPO=rvishravars/primer

# Cache Configuration
SPARK_CACHE_TTL_SECONDS=60

# OpenAI API Key (optional server-side fallback)
OPENAI_API_KEY=sk-...
```

## Deployment

### Cloud Run

```bash
# Build
./build.sh

# Tag for Cloud Run
docker tag spark-assembly-lab:latest gcr.io/YOUR_PROJECT/spark-assembly-lab:latest

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT/spark-assembly-lab:latest

# Deploy
gcloud run deploy spark-assembly-lab \
   --image gcr.io/YOUR_PROJECT/spark-assembly-lab:latest \
   --region us-central1 \
   --allow-unauthenticated \
   --port 8080 \
   --env-vars-file .env.cloud
```

### Other Platforms

Any platform supporting Docker images:
- **Kubernetes**: Use `docker:spark-assembly-lab:latest`
- **Docker Swarm**: `docker service create -p 8080:8080 spark-assembly-lab:latest`
- **Heroku**: Push Docker image directly
- **Fly.io, Railway, etc.**: Follow their Docker deployment guides

## Build Performance

### First Build
- Takes 3-5 minutes
- Downloads Node/Python base images
- Installs npm and pip dependencies
- Builds React application

### Subsequent Builds
- Takes 1-2 minutes
- Uses Docker layer caching
- Only rebuilds changed layers

### Speeding Up Builds

1. **Pre-pull base images:**
   ```bash
   docker pull node:20-alpine
   docker pull python:3.11-alpine
   ```

2. **Mount npm cache (optional):**
   ```bash
   docker build \
     --build-context=. \
     -f spark-assembly-lab/Dockerfile.prod \
     -t spark-assembly-lab:latest \
     .
   ```

3. **Use .dockerignore:**
   Already configured to skip:
   - `node_modules/`
   - `.env`
   - `dist/`
   - Git directories

## Troubleshooting

### Out of Space Error

```bash
# Clean up Docker
docker system prune -a

# Retry build
./build.sh
```

### Build Hangs on npm install

```bash
# Increase Docker memory allocation
# Via Docker Desktop: Settings → Resources → Memory: 4GB+
# Via CLI on Linux: No limit, uses system RAM

# Manual timeout override
docker build --progress=plain -f spark-assembly-lab/Dockerfile.prod .
```

### Port Already in Use

```bash
# Change port when running
docker run -p 9000:8080 spark-assembly-lab:latest
# Access at http://localhost:9000
```

### Build Cache Issues

```bash
# Rebuild without cache
docker build --no-cache -f spark-assembly-lab/Dockerfile.prod -t spark-assembly-lab:latest .
```

## Build Artifacts

After a successful build, verify:

```bash
# List images
docker images | grep spark-assembly-lab

# Inspect image
docker inspect spark-assembly-lab:latest

# Check image size
docker images spark-assembly-lab:latest --human-readable
```

Expected size: ~400-500 MB (optimized production build)

## Development vs Production

### Development Build (docker compose up)
- Hot module reloading
- Source maps for debugging
- No minification
- Faster startup

### Production Build (./build.sh)
- Optimized bundle
- Minified assets
- Production Python environment
- Ready for deployment

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: .
          dockerfile: spark-assembly-lab/Dockerfile.prod
          tags: spark-assembly-lab:latest
          push: false
```

## Versioning

Tag builds with versions:

```bash
./build.sh
docker tag spark-assembly-lab:latest spark-assembly-lab:v1.0.0
docker tag spark-assembly-lab:latest spark-assembly-lab:$(git rev-parse --short HEAD)
```

## Support

- **Docker issues?** → [Docker Documentation](https://docs.docker.com/)
- **Build fails?** → Check Docker Desktop settings (memory, disk space)
- **Performance?** → Enable BuildKit: `export DOCKER_BUILDKIT=1`
