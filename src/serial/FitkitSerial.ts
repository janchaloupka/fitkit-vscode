import { FileType } from 'vscode';
import { Utils } from './../common/Utils';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { VirtualTerminal } from '../common/VirtualTerminal';
import { EventEmitter, Disposable, window, Terminal } from 'vscode';
import { join } from 'path';
import * as fs from "fs";

export class FitkitSerial{
	private static SerialPath?: string;

	/** Nastavit absultní cestu k utilite komunikace s FITkit zařízením */
	public static UpdateSerialPathByArch(extensionRoot: string){
		let binaryName = "";

		if(process.arch !== "x64"){
			throw new Error("Unsupported architecture for serial communication. Only x86_64 is supported");
		}

		switch(process.platform){
			case "win32":
				binaryName ="fitkit-serial-win-amd64.exe";
				break;
			case "linux":
				binaryName ="fitkit-serial-linux-amd64";
				break;
			case "darwin":
				binaryName ="fitkit-serial-darwin-amd64";
				break;
			default:
				throw new Error("Unsupported platform for serial communication");
		}

		var absPath = join(extensionRoot, "resources", binaryName);
		FitkitSerial.SerialPath = absPath;

		if(process.platform === "win32") return;

		// Natavit práva spouštění
		fs.chmod(absPath, "755", () => {});
	}

	private onDidCloseEmitter = new EventEmitter<void>();

	private Terminal: Terminal;
	private VirtualTerminal: VirtualTerminal;

	private Process?: ChildProcessWithoutNullStreams;

	/** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
	private Disposables: Disposable[] = [];

	public readonly onDidClose = this.onDidCloseEmitter.event;

	public constructor(){
		this.VirtualTerminal = new VirtualTerminal();
		this.Disposables.push(this.VirtualTerminal.onDidClose(() => this.Close()));

		this.Terminal = window.createTerminal({
			name: "FITkit terminal",
			pty: this.VirtualTerminal
		});
		this.Terminal.show();
	}

	protected StartProcess(args: string[], cwd?: string){
		if(!FitkitSerial.SerialPath){
			window.showErrorMessage("Cannot open terminal. Unknown serial utility path");
			this.Close();
			return;
		}

		this.Process = spawn(FitkitSerial.SerialPath,
			args,
			{cwd: cwd}
		);

		this.VirtualTerminal.onInput(data => {
			if(!this.Process || this.Process.killed) return;
			if(data === "\r") data = "\r\n";
			if(data === "\x03"){
				this.Close();
				return;
			}
			this.Process.stdin.write(data);
		});

		this.Process.on("close", () => {
			this.Close();
		});

		this.Process.stdout.on("data", chunk => {
			this.VirtualTerminal.Write(chunk);
		});

		this.Process.stderr.on("data", chunk => {
			this.VirtualTerminal.Write(chunk);
		});

	}

	public OpenTerminal(){
		this.StartProcess(["--term"]);
	}

	public async Flash(projectPath: string, runTerm = false, hex1?: string, hex2?: string, bin?: string){
		if(!hex1){
			hex1 = "build/output_f1xx.hex";
			if(!await Utils.FileExists(join(projectPath, hex1))){
				hex1 = undefined;
				let dir = await Utils.ReadDirectory(join(projectPath, "build"));
				for (const item of dir) {
					if(item[1] !== FileType.File) continue;
					if(item[0].endsWith("_f1xx.hex")){
						hex1 = join("build", item[0]);
						break;
					}
				}
				if(!hex1){
					throw new Error("Cannot find any _f1xx.hex file in project build folder");
				}
			}
		}

		if(!hex2){
			hex2 = "build/output_f2xx.hex";
			if(!await Utils.FileExists(join(projectPath, hex2))){
				hex2 = undefined;
				let dir = await Utils.ReadDirectory(join(projectPath, "build"));
				for (const item of dir) {
					if(item[1] !== FileType.File) continue;
					if(item[0].endsWith("_f2xx.hex")){
						hex2 = join("build", item[0]);
						break;
					}
				}
				if(!hex2){
					throw new Error("Cannot find any _f2xx.hex file in project build folder");
				}
			}
		}

		if(!bin){
			bin = "build/bin.hex";
			if(!await Utils.FileExists(join(projectPath, bin))){
				bin = undefined;
				let dir = await Utils.ReadDirectory(join(projectPath, "build"));
				for (const item of dir) {
					if(item[1] !== FileType.File) continue;
					if(item[0].endsWith(".bin")){
						bin = join("build", item[0]);
						break;
					}
				}
				if(!bin){
					throw new Error("Cannot find any .bin file in project build folder");
				}
			}
		}

		var args = [
			"--flash",
			"--hex1x", hex1,
			"--hex2x", hex2,
			"--bin", bin
		];

		console.log(args);

		if(runTerm) args.push("--term");

		this.StartProcess(args, projectPath);
	}

	public Close(){
		this.Process?.kill();

		// Uklidit všechny zachytávače eventů
		this.Disposables.forEach(d => d.dispose());

		this.VirtualTerminal.AnyKeyToClose();

		this.onDidCloseEmitter.fire();
	}
}
