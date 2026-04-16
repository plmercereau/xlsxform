/**
 * Simple HTTP file server for tests - ported from tests/validators/server.py
 * Serves files from a specified directory.
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

export class TestServer {
	private server: http.Server;
	private _port: number;
	private _rootDir: string;

	constructor(rootDir: string, port = 8000) {
		this._port = port;
		this._rootDir = rootDir;
		this.server = http.createServer((req, res) => {
			// Only allow localhost
			const remoteAddr = req.socket.remoteAddress;
			if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1" && remoteAddr !== "::ffff:127.0.0.1") {
				res.writeHead(401);
				res.end("Unauthorized");
				return;
			}

			const urlPath = decodeURIComponent(req.url || "/").split("?")[0].split("#")[0];
			// Strip leading slash and resolve relative to root
			const segments = urlPath.split("/").filter(Boolean);
			let filePath = this._rootDir;
			for (const seg of segments) {
				if (seg === "." || seg === "..") continue;
				filePath = path.join(filePath, seg);
			}

			if (!fs.existsSync(filePath)) {
				res.writeHead(404);
				res.end("Not Found");
				return;
			}

			const stat = fs.statSync(filePath);
			if (stat.isFile()) {
				const data = fs.readFileSync(filePath);
				res.writeHead(200, { "Content-Length": data.length.toString() });
				res.end(data);
			} else {
				res.writeHead(404);
				res.end("Not a file");
			}
		});
	}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const tryBind = (tries: number) => {
				this.server.once("error", (err: NodeJS.ErrnoException) => {
					if (err.code === "EADDRINUSE" && tries < 5) {
						setTimeout(() => tryBind(tries + 1), 500);
					} else {
						reject(err);
					}
				});
				this.server.listen(this._port, "127.0.0.1", () => {
					resolve();
				});
			};
			tryBind(0);
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			this.server.close(() => resolve());
		});
	}
}
