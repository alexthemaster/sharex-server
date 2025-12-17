# [ShareX Server on Github](https://github.com/alexthemaster/sharex-server)

## Docker Compose Example

Save this as `docker-compose.yml`:

```yml
services:
    sharex-server:
        image: alexthemaster/sharex-server:latest
        container_name: sharex-server
        # Uncomment the following line to run sharex-server as your user instead of root (change id if different)
        # user: 1000:1000
        ports:
            - "8080:8080"
        environment:
            - PASSWORD=yourpasswordhere
        volumes:
            # Change this path if you want to persist uploads elsewhere
            - ./uploads:/server/uploads
        restart: unless-stopped
```

## Environment Variables

The ShareX Server Docker image can be configured via the following environment variables:

-   **PASSWORD** (REQUIRED)

    -   Description: The password used for uploading files to ShareX Server
    -   Example: `PASSWORD=Dr3wCIsHkdU9QQ`

-   **PORT**

    -   Description: TCP port the server listens on inside the container.
    -   Default: `8080`
    -   Example: `PORT=80`

-   **BASE_URL**

    -   Description: Base URL of the server.
    -   Default: `/`
    -   Example: `BASE_URL=/uploads`

-   **FILENAME_LENGTH**

    -   Description: Length of randomly generated filenames (using `nanoid`).
    -   Default: `10`
    -   Example: `FILENAME_LENGTH=10`

-   **ENABLE_SXCU**

    -   Description: Enables the SXCU endpoint (`GET /api/sxcu`) for ShareX configuration. Set to false after downloading if this will be used as a private service (recommended)
    -   Default: `true`
    -   Example: `ENABLE_SXCU=true`

-   **FORCE_HTTPS**

    -   Description: Force HTTPS in return URL (useful when running behind reverse proxy)
    -   Default: ` `
    -   Example: `FORCE_HTTPS=true`

-   **TRUST_PROXY**

    -   Description: Sets Express trust proxy to true; Useful for getting your X-Forwarded-For IP from reverse proxy when running with debug enabled; Also enables forceHttps if not explicitly set to a boolean
    -   Default: `false`
    -   Example: `TRUST_PROXY=true`

-   **DEBUG**

    -   Description: Enables debug logging. Set to `true` to log detailed server activity.
    -   Default: `false`
    -   Example: `DEBUG=false`

-   **FILE_LISTING**
    -   Description: Path for optional file listing page. Set to `false` to disable.
    -   Default: `files`
    -   Example: `FILE_LISTING=files`

## Manual Build

### Production image

`docker build -t sharex-server -f docker/Dockerfile .`

### Development image (for testing local/unpublished changes)

`docker build -t sharex-server -f docker/Dockerfile.dev .`
