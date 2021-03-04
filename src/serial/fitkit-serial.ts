import { FileType } from 'vscode';
import { Utils } from './../common/utils';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { VirtualTerminal } from '../common/virtual-terminal';
import { EventEmitter, Disposable, window, Terminal } from 'vscode';
import { join } from 'path';
import * as fs from "fs";

export class FitkitSerial{
    private static serialPath?: string;

    /** Nastavit absolutní cestu k utilitě komunikace s FITkit zařízením */
    public static updateSerialPathByArch(extensionRoot: string){
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
        FitkitSerial.serialPath = absPath;

        if(process.platform === "win32") return;

        // Natavit práva spouštění
        fs.chmod(absPath, "755", () => {});
    }

    private onDidCloseEmitter = new EventEmitter<void>();

    private terminal: Terminal;
    private virtualTerminal: VirtualTerminal;

    private process?: ChildProcessWithoutNullStreams;

    /** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
    private disposables: Disposable[] = [];

    public readonly onDidClose = this.onDidCloseEmitter.event;

    public constructor(){
        this.virtualTerminal = new VirtualTerminal();
        this.disposables.push(this.virtualTerminal.onDidClose(() => this.close()));

        this.terminal = window.createTerminal({
            name: "FITkit terminal",
            pty: this.virtualTerminal
        });
        this.terminal.show();
    }

    protected startProcess(args: string[], cwd?: string){
        if(!FitkitSerial.serialPath){
            window.showErrorMessage("Cannot open terminal. Unknown serial utility path");
            this.close();
            return;
        }

        this.process = spawn(FitkitSerial.serialPath,
            args,
            {cwd: cwd}
        );

        this.virtualTerminal.onInput(data => {
            if(!this.process || this.process.killed) return;
            if(data === "\r") data = "\r\n";
            if(data === "\x03"){
                this.close();
                return;
            }
            this.process.stdin.write(data);
        });

        this.process.on("close", () => {
            this.close();
        });

        this.process.stdout.on("data", chunk => {
            this.virtualTerminal.write(chunk);
        });

        this.process.stderr.on("data", chunk => {
            this.virtualTerminal.write(chunk);
        });

    }

    public openTerminal(){
        this.startProcess(["--term"]);
    }

    public async flash(projectPath: string, runTerm = false, hex1?: string, hex2?: string, bin?: string){
        if(!hex1){
            hex1 = "build/output_f1xx.hex";
            if(!await Utils.fileExists(join(projectPath, hex1))){
                hex1 = undefined;
                let dir = await Utils.readDirectory(join(projectPath, "build"));
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
            if(!await Utils.fileExists(join(projectPath, hex2))){
                hex2 = undefined;
                let dir = await Utils.readDirectory(join(projectPath, "build"));
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
            if(!await Utils.fileExists(join(projectPath, bin))){
                bin = undefined;
                let dir = await Utils.readDirectory(join(projectPath, "build"));
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

        this.startProcess(args, projectPath);
    }

    public close(){
        this.process?.kill();

        // Uklidit všechny zachytávače eventů
        this.disposables.forEach(d => d.dispose());

        this.virtualTerminal.anyKeyToClose();

        this.onDidCloseEmitter.fire();
    }
}
