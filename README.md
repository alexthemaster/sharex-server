# ShareX Server

A tiny, self-hosted upload target for ShareX and similar clients. Runs on Node.js and stores uploads on disk.

## ⭐ Features

-   File uploads (including text, image, GIF, MP4 etc)
-   Simple files directory listing with configurable endpoint
-   Downloadable .sxcu file endpoint (/api/sxcu)
-   Setting Base URL
-   Custom generated filename length

## ▶️ Quickstart

### 🐳 Docker is the recommended way to run ShareX Server! See [Docker Hub](https://hub.docker.com/r/alexthemaster/sharex-server) for setup instructions.

#### 🔨 Manually in your Node app:

-   `npm install sharex-server`
-   ```ts
    import { ShareXServer } from "sharex-server";
    new ShareXServer({ password: "s3cret", port: 8080, savePath: "./uploads" });
    ```

#### ⚙️ Options

All options accepted by the `ShareXServer` constructor:

-   `password` (string) - REQUIRED. The password clients must send as the `x-password` header to upload files.
-   `port` (number, default `8080`) - TCP port the server listens on.
-   `baseUrl` (string, default `/`) - Base URL the server will run on.
-   `savePath` (string, default `./uploads`) - Filesystem directory where uploads are stored. The server ensures this directory exists. On Windows prefer an absolute path to avoid a leading `/` being prefixed when resolving.
-   `filenameLength` (number, default `10`) - Length passed to `nanoid()` used to generate short random filenames.
-   `enableSxcu` (boolean, default `false`) - When `true` the server exposes a simple endpoint to get a downloadable .sxcu at `GET /api/sxcu`.
-   `fileListing` (string | false, default `files`) - Path to file listing of uploads. Set to `false` to disable the listing.
-   `debug` (boolean, default `false`) - Enable verbose debug logging to the console.
-   `forceHttps` (boolean, default `false`) - Force HTTPS for return URL (useful when running behind reverse proxy)

## 🗒️ Usage notes:

-   The server saves uploaded files directly under `savePath` and will serve any file in that directory - do not point `savePath` at directories containing sensitive data.
-   The upload flow is protected only by the `x-password` header - run behind HTTPS and/or restrict access with a firewall or reverse proxy for production deployments.
-   The code sets `this.#fsPath = join("./", this.savePath)`. If you encounter path problems on Windows, set `savePath` to an absolute Windows path (e.g. `C:\data\uploads`).
-   Ensure the Node process has permission to create and write to `savePath`.

## ⬆️ Uploading

-   Endpoint: `POST /api/upload` (multipart form, field name `file`).
-   Auth: include header `x-password: <your-password>`.
-   Success response: JSON containing a `url` pointing to the uploaded file.
- Error response: JSON containing an `error` property with status code 400 for missing file and 401 for missing/incorrect password.

Example (PowerShell / pwsh):

```pwsh
curl -X POST "http://localhost:8080/api/upload" -H "x-password: s3cret" -F "file=@C:\path\to\file.jpg"
```

Example (Linux / macOS):

```bash
curl -X POST "http://localhost:8080/api/upload" \
    -H "x-password: s3cret" \
    -F "file=@/path/to/file.jpg"
```

## 🌐 Additional HTTP Endpoints

-   `GET /:filename`

    -   Purpose: Download a previously uploaded file. The server streams the file from disk.
    -   Response: 200 with file body and `Content-Type` derived via the `mime-types` lookup (falls back to `application/octet-stream`).
    -   Response: 404 if file does not exist.

-   `GET /files` (or the configured `fileListing` path)

    -   Purpose: Optional file listing page with links and upload timestamps. Disabled when `fileListing` is `false`.
    -   Response: Simple HTML list of links to the uploaded files and their upload dates`.

-   `GET /api/sxcu`
    -   Purpose: When `enableSxcu` is `true`, will return a .sxcu file to be used with ShareX.

> **Note:** All endpoints take the configured `baseUrl` into account.  
> This means that every URL, will be prefixed with the `baseUrl` you have configured. (example: `GET /baseUrl/files`)

---

## Upload handling and filename strategy

-   Filenames are generated as: `${nanoid(this.filenameLength)}.{ext}` where `ext` is the uploaded file's original extension.
-   A collision safeguard checks whether a file with the generated name already exists and regenerates once if necessary. The probability of collision is [extremely low](https://zelark.github.io/nano-id-cc/) with `nanoid`.


---

## 📌 Documentation notice

This README was produced with the assistance of an AI.
