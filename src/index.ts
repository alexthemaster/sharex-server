import express, { Request, Response, type NextFunction } from "express";
import { lookup } from "mime-types";
import multer, { diskStorage } from "multer";
import { nanoid } from "nanoid";
import { createReadStream } from "node:fs";
import { access, constants, mkdir, readdir, stat } from "node:fs/promises";
import { type Server } from "node:http";
import { join } from "node:path";

export class ShareXServer {
    public port: number;
    public baseUrl: string;
    public savePath: string;
    public filenameLength: number;
    public enableSxcu: boolean;
    public debug: boolean;
    public fileListing: string | false;
    public forceHttps: boolean | undefined;
    #server = express();
    #serverListener: Server | null = null;
    #password: string;
    #fsPath: string;

    constructor({
        port = 8080,
        password,
        baseUrl = "/",
        savePath = "./uploads",
        filenameLength = 10,
        enableSxcu = false,
        fileListing = "files",
        debug = false,
        forceHttps,
        trustProxy,
    }: SharexServerOptions) {
        this.port = port;
        // Ensure baseUrl starts and ends with /
        this.baseUrl =
            baseUrl == "/" ? baseUrl : `/${baseUrl.replaceAll("/", "")}/`;
        this.savePath = savePath;
        this.filenameLength = filenameLength;
        this.enableSxcu = enableSxcu;
        this.debug = debug;
        this.forceHttps = forceHttps;
        // If fileListing is provided, ensure it doesn't start with a /
        this.fileListing = fileListing
            ? fileListing.startsWith("/")
                ? fileListing.substring(1)
                : fileListing
            : false;

        if (trustProxy) {
            if (this.forceHttps == undefined) this.forceHttps = true;

            this.#server.set("trust proxy", true);
        }

        if (!password) {
            throw new Error("A password must be provided to start the server.");
        }
        this.#password = password;

        this.#fsPath = join("./", this.savePath);

        this.#setupRoutes();
    }

    #setupRoutes() {
        // SXCU configuration route
        if (this.enableSxcu) {
            this.#server.get(`${this.baseUrl}api/sxcu`, (req, res) =>
                this.#handleSxcu(req, res)
            );
        }

        // File listing route
        if (this.fileListing) {
            this.#server.get(`${this.baseUrl}${this.fileListing}`, (req, res) =>
                this.#handleFileListing(req, res)
            );
        }

        // Get file
        this.#server.get(`${this.baseUrl}:filename`, (req, res) =>
            this.#getFile(req, res)
        );

        // Upload file
        this.#server.post(
            `${this.baseUrl}api/upload`,
            // Make sure only authorized users can upload
            (req, res, next) => this.#checkAuth(req, res, next),
            // Handle the file upload
            multer({
                storage: diskStorage({
                    destination: (_req, _file, cb) => cb(null, this.#fsPath),
                    filename: async (_req, file, cb) => {
                        let name = nanoid(this.filenameLength);
                        const extension =
                            file.originalname.split(".").length > 1
                                ? "." + file.originalname.split(".").pop()
                                : "";

                        // Little safeguard to prevent overwriting files (although extremely unlikely https://zelark.github.io/nano-id-cc/)
                        if (await this.#checkFileExists(name)) {
                            name = nanoid(this.filenameLength);
                        }

                        cb(null, `${name}${extension}`);
                    },
                }),
            }).single("file"),
            // This returns the URL to the user
            (req, res) => this.#uploadFile(req, res)
        );

        // Base route
        this.#server.get(this.baseUrl, (_req, res) => {
            res.send(
                `<a href="https://github.com/alexthemaster/sharex-server" target=_blank>ShareX Server</a> is running. ${
                    this.fileListing
                        ? "Visit <a href=" +
                          this.baseUrl +
                          this.fileListing +
                          ">here</a> to see the file listing."
                        : ""
                }
                ${
                    this.enableSxcu
                        ? `<br><a href="${this.baseUrl}api/sxcu">Download the .sxcu configuration file</a>`
                        : ""
                }`
            );
        });
    }

    /** Start the server and listenn on the user defined port */
    async start(): Promise<void | Error> {
        if (this.#serverListener)
            throw new Error("[Error] Server already started");

        await this.#ensureSavePath();

        return new Promise((resolve, reject) => {
            this.#serverListener = this.#server.listen(this.port, (err) => {
                // If port is 0, reflect changes to randomly selected port in the object
                if (this.port == 0) {
                    const addr = this.#serverListener?.address();
                    if (addr && typeof addr == "object") {
                        this.port = addr.port;
                    }
                }

                if (err) {
                    console.error(
                        `[Error] Something went wrong when starting the server: ${err.message}`
                    );
                    reject(err);
                }

                console.log(
                    `[Info] ShareX server started on port ${this.port}`
                );
                resolve();
            });

            this.#serverListener.once("error", (err) => {
                reject(err);
                this.#serverListener = null;
            });
        });
    }

    /** Stop the server */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.#serverListener) return resolve();
            this.#serverListener.close(() => {
                this.#serverListener = null;
                return resolve();
            });
        });
    }

    /** Streams a requested file to the client if it exists */
    async #getFile(req: Request, res: Response) {
        const { filename } = req.params;
        if (!filename) {
            this.#debug(`File request with no filename from ${req.ip}`);
            return res.status(400).send("No filename provided.");
        }

        this.#debug(`File ${filename} requested by ${req.ip}`);
        const exists = await this.#checkFileExists(filename);

        if (!exists) {
            this.#debug(`The requested file ${filename} does not exist`);
            return res.status(404).send("The requested file does not exist.");
        }

        this.#debug(`Serving file ${filename} to ${req.ip}`);
        const file = createReadStream(`${this.#fsPath}/${filename}`);
        const fileStat = await stat(`${this.#fsPath}/${filename}`);

        res.set({
            "Content-Length": fileStat.size.toString(),
            "Accept-Ranges": "bytes",
            "Content-Type": lookup(filename) || "application/octet-stream",
        });

        return file.pipe(res);
    }

    /** Handles file uploads and returns the file URL if successful. */
    async #uploadFile(req: Request, res: Response) {
        if (!req.file) {
            this.#debug(`Upload attempt with no file from ${req.ip}`);
            return res.status(400).json({ error: "No file provided." });
        }

        this.#debug(
            `File ${req.file.filename} uploaded successfully by ${req.ip}`
        );
        return res.json({
            url: `${this.forceHttps ? "https" : req.protocol}://${req.host}${
                this.baseUrl
            }${req.file?.filename}`,
        });
    }

    async #ensureSavePath() {
        this.#debug(`Checking if save path exists at ${this.#fsPath}`);
        try {
            await access(this.#fsPath, constants.F_OK);
            this.#debug(`Save path does exist at ${this.#fsPath}`);
        } catch {
            this.#debug(
                `Save path does not exist at ${this.#fsPath}, creating...`
            );
            await mkdir(this.#fsPath, { recursive: true });
            this.#debug(`Save path created at ${this.#fsPath}`);
        }
    }

    async #checkFileExists(filename: string): Promise<boolean> {
        try {
            await access(join(this.#fsPath, filename), constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async #handleFileListing(req: Request, res: Response) {
        this.#debug(`File listing requested by ${req.ip}`);
        const files = await readdir(this.#fsPath);

        const list = await Promise.all(
            files.map(
                async (file: string) =>
                    `<li><a href="${
                        this.baseUrl
                    }${file}" target=_blank>${file}</a> - uploaded ${(
                        await stat(join(this.#fsPath, file))
                    ).mtime.toLocaleString()}</li>`
            )
        );

        return res.set("Content-Type", lookup("html") as string).end(`
            <ul>
                ${list.join("\n")}
            </ul>
            `);
    }

    #handleSxcu(req: Request, res: Response) {
        this.#debug(`SXCU configuration requested by ${req.ip}`);
        const sxcu = {
            Version: "18.0.0",
            Name: `ShareX Server (${req.host})`,
            DestinationType: "ImageUploader, TextUploader, FileUploader",
            RequestMethod: "POST",
            RequestURL: `${this.forceHttps ? "https" : req.protocol}://${
                req.host
            }${this.baseUrl}api/upload`,
            Body: "MultipartFormData",
            Headers: {
                "X-Password": this.#password,
            },
            FileFormName: "file",
            URL: "{json:url}",
            ErrorMessage: "{json:error}",
        };

        return res
            .set("Content-Type", "application/octet-stream")
            .set(
                "Content-Disposition",
                "attachment;filename=sharex-server.sxcu"
            )
            .json(sxcu);
    }

    #checkAuth(req: Request, res: Response, next: NextFunction) {
        if (
            !req.headers["x-password"] ||
            req.headers["x-password"] !== this.#password
        ) {
            this.#debug(`Unauthorized upload attempt from ${req.ip}`);
            return res.status(401).json({
                error: `Unauthorized. Provide a${
                    req.headers["x-password"] ? " valid" : ""
                } password.`,
            });
        }
        return next();
    }

    #debug(str: string) {
        if (this.debug) {
            console.debug("[Debug]", str);
        }
    }
}

export interface SharexServerOptions {
    /** Password used for uploading */
    password: string;
    /** Port number to run the server on, defaults to :8080 */
    port?: number;
    /** Base URL of the server, defaults to / */
    baseUrl?: string;
    /** Path to save uploaded files, defaults to ./uploads */
    savePath?: string;
    /** Length of the generated filenames, defaults to 10 */
    filenameLength?: number;
    /** Enable SXCU configuration generation, defaults to false */
    enableSxcu?: boolean;
    /** File listing of all uploaded files, defaults to /files */
    fileListing?: string | false;
    /** Enable debug logging */
    debug?: boolean;
    /** Force HTTPS in return URL (useful when running behind reverse proxy) */
    forceHttps?: boolean;
    /** Sets Express trust proxy to true
     *
     * Useful for getting your X-Forwarded-For IP from reverse proxy
     *
     * Also enables forceHttps if not explicitly set to a boolean
     */
    trustProxy?: boolean;
}
