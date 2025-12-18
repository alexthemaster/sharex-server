import { nanoid } from "nanoid";
import assert from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
    after,
    afterEach,
    before,
    beforeEach,
    describe,
    test,
} from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { ShareXServer } from "../dist/index.js";

const password = nanoid();
let port;
const servers = [];

before(() => {
    console.log = () => null;
    console.error = () => null;
});

describe("Basic functionality", () => {
    test("is defined", () => {
        assert.ok(ShareXServer);
    });

    test("starts up without issues", async () => {
        const server = newServer();
        assert.ok(server);
    });

    test("throws error when password is missing", async () => {
        assert.throws(() => new ShareXServer({}));
    });

    test("returns error when binding to used port", async () => {
        const conflictingServer = new ShareXServer({
            port: 0,
            password: "test",
        });

        await conflictingServer.start();

        const server = new ShareXServer({
            port: conflictingServer.port,
            password: "test",
        });
        servers.push(server);

        await assert
            .rejects(async () => {
                await server.start();
            })
            .finally(async () => {
                await conflictingServer.stop();
            });
    });

    test("assigns default options properly", async () => {
        const password = nanoid();
        const server = new ShareXServer({ password });
        assert.equal(server.port, 8080);
        assert.equal(server.baseUrl, "/");
        assert.equal(server.filenameLength, 10);
        assert.equal(server.enableSxcu, false);
        assert.equal(server.fileListing, "files");
        assert.equal(server.savePath, "./uploads");
        assert.equal(server.debug, false);
        assert.equal(server.forceHttps, undefined);
    });

    test("assigns user provided options properly", async () => {
        const server = new ShareXServer({
            port: 1234,
            password,
            baseUrl: "/testing",
            filenameLength: 20,
            savePath: "./files",
            enableSxcu: true,
            fileListing: "uploads",
            debug: true,
            forceHttps: true,
        });
        assert.equal(server.port, 1234);
        assert.equal(server.baseUrl, "/testing/");
        assert.equal(server.filenameLength, 20);
        assert.equal(server.enableSxcu, true);
        assert.equal(server.fileListing, "uploads");
        assert.equal(server.savePath, "./files");
        assert.equal(server.debug, true);
        assert.equal(server.forceHttps, true);
    });
    test("sets forceHttps to true if trustProxy is true", () => {
        const server = new ShareXServer({ password, trustProxy: true });
        assert.equal(server.forceHttps, true);
    });
    test("forceHttps remains false if assigned even if trustProxy is true", () => {
        const server = new ShareXServer({
            password,
            forceHttps: false,
            trustProxy: true,
        });
        assert.equal(server.forceHttps, false);
    });
});

describe("API functionality", () => {
    const tmpPath = join(dirname(fileURLToPath(import.meta.url)), "./tmp/");

    before(async () => {
        await mkdir(tmpPath);
        await writeFile(join(tmpPath, "./test.txt"), Buffer.from("hello"));
    });

    after(async () => {
        await rm(tmpPath, { recursive: true, force: true });
    });

    beforeEach(async () => {
        const server = new ShareXServer({
            port: 0,
            password,
            savePath: "./tests/tmp",
        });
        servers.push(server);
        await server.start();
        port = server.port;
    });

    const getBaseUrl = () => `http://localhost:${port}`;
    test("/ functions properly", async () => {
        const res = await request(getBaseUrl()).get("/");
        assert.equal(res.statusCode, 200);
        assert.ok(res.text.includes("is running"));
    });

    test("files listing is not public if disabled", async () => {
        const server = new ShareXServer({
            port: 0,
            password,
            fileListing: false,
        });
        servers.push(server);
        await server.start();
        port = server.port;

        const res = await request(getBaseUrl()).get("/");
        assert.ok(!res.text.includes("see the file listing"));
    });

    test("sxcu config is properly disabled", async () => {
        const res = await request(getBaseUrl()).get("/");
        const resSxcu = await request(getBaseUrl()).get("/api/sxcu");
        assert.ok(!res.text.includes("Download the .sxcu configuration file"));
        assert.notEqual(resSxcu.statusCode, 200);
    });

    test("sxcu config is valid", async () => {
        await newServer({ enableSxcu: true });

        const sxcu = JSON.parse(
            (await request(getBaseUrl()).get("/api/sxcu")).body
        );
        assert.ok(
            "Version" in sxcu &&
                "Name" in sxcu &&
                "DestinationType" in sxcu &&
                "RequestMethod" in sxcu &&
                "RequestURL" in sxcu &&
                "Body" in sxcu &&
                "Headers" in sxcu &&
                "FileFormName" in sxcu &&
                "URL" in sxcu &&
                "ErrorMessage" in sxcu
        );
    });

    test("/:file returns valid file", async () => {
        const res = await request(getBaseUrl()).get("/test.txt");
        assert.equal(res.statusCode, 200);
        assert.equal(res.text, "hello");
    });

    test("/:file returns 404 if file not found", async () => {
        const res = await request(getBaseUrl()).get("/unknown.png");
        assert.equal(res.statusCode, 404);
    });

    test("/api/upload works", async () => {
        const server = new ShareXServer({
            port: 0,
            password,
            savePath: "./tests/tmp",
        });
        servers.push(server);
        await server.start();
        port = server.port;

        const res = await request(getBaseUrl())
            .post("/api/upload")
            .set("X-Password", password)
            .attach("file", Buffer.from("test"), "filename.txt");
        assert.ok(res.statusCode == 200 && "url" in JSON.parse(res.text));
    });

    test("/api/upload returns 400 if no file is provided", async () => {
        const server = new ShareXServer({
            port: 0,
            password,
            savePath: "./tests/tmp",
        });
        servers.push(server);
        await server.start();
        port = server.port;

        const res = await request(getBaseUrl())
            .post("/api/upload")
            .set("X-Password", password);
        assert.equal(res.statusCode, 400);
    });

    test("/api/upload returns 401 if wrong password is used", async () => {
        const server = new ShareXServer({
            port: 0,
            password,
            savePath: "./tests/tmp",
        });
        servers.push(server);
        await server.start();
        port = server.port;

        const res = await request(getBaseUrl())
            .post("/api/upload")
            .set("X-Password", "wrong password provided")
            .attach("file", Buffer.from("test"), "filename.txt");
        assert.equal(res.statusCode, 401);
    });
});

afterEach(async () => {
    await Promise.all(servers.map((server) => server.stop()));
});

async function newServer(options) {
    const server = new ShareXServer({
        port: 0,
        password,
        ...options,
    });
    servers.push(server);
    await server.start();
    port = server.port;
    return server;
}
