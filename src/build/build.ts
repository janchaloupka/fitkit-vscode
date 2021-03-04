import { Utils } from './../common/utils';
import { BuildResult } from './../models/BuildResult';
import { Disposable } from 'vscode';
import { Connection } from '../remote/connection';
import { ProjectData } from '../models/project-data';
import { VirtualTerminal } from '../common/virtual-terminal';
import { window, Terminal, EventEmitter } from 'vscode';
import * as colors from "colors/safe";
import { join } from 'path';
import { ExtensionConfig } from '../extension-config';

/**
 * Logika pro ovládání a přijímání zpráv o vzdáleném překladu
 */
export class Build{
    private onDidCloseEmitter = new EventEmitter<void>();

    private terminal: Terminal;
    private virtualTerminal: VirtualTerminal;
    private projectData: ProjectData;
    private connection?: Connection;

    public readonly path: string;

    /** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
    private disposables: Disposable[] = [];

    /** Indikátor, zda se hláška o zařazení do fronty zobrazuje poprvé */
    private queueFirstTime = true;

    /** Došlo k ukončení překladu */
    public readonly onDidClose = this.onDidCloseEmitter.event;

    public constructor(project: ProjectData, path: string){
        this.projectData = project;

        this.path = path;

        this.virtualTerminal = new VirtualTerminal();
        this.disposables.push(this.virtualTerminal.onDidClose(() => this.close()));

        this.terminal = window.createTerminal({
            name: "Remote Build",
            pty: this.virtualTerminal
        });
        this.terminal.show();
    }

    /**
     * Spustit překlad
     *
     * Překlad se nespustí ihned, ale naváže se spojení se serverem a pošle se
     * požadavek na spuštění překladu
     */
    public async init(){
        this.writeLine("[LOCAL] Establishing connection to build server...");

        try{
            this.connection = await Connection.getActiveConnection();
        }catch(e){
            this.errorLine(`[LOCAL] ${e.toString()}`);
            this.close();
            return;
        }

        if(ExtensionConfig.logDebugInfo){
            const logPath = join(this.path, "server_communication.log");
            try{
                await Utils.deletePath(logPath);
            }catch(e){}
            this.connection.LogPath = logPath;
        }else
            this.connection.LogPath = undefined;

        this.disposables.push(
            this.connection.onBuildBegin(() => this.begin()),
            this.connection.onBuildStderr(line => this.errorLine(line)),
            this.connection.onBuildStdout(line => this.writeLine(line)),
            this.connection.onBuildEnd(res => this.close(res)),
            this.connection.onBuildQueue(info => this.sendQueueInfo(info.pos, info.size)),
            this.connection.onProjectMapping(map => this.virtualTerminal.loadFilesMapping(map)),
            this.connection.onServerError(err => this.errorLine(`Server error: ${err}`)),
            this.connection.onDidClose(() => this.close())
        );

        if(this.connection.connected){
            this.sendRequest();
            return;
        }

        this.disposables.push(
            this.connection.onDidConnect(() => this.sendRequest())
        );
    }

    /**
     * Poslat zprávu o zahájení simulace
     */
    private sendRequest(){
        this.writeLine("[LOCAL] Connection established. Sending build request...");
        this.connection?.send({
            type: "build-begin",
            data: this.projectData
        });
    }

    /**
     * Překlad začal
     */
    private begin(){
        this.writeLine("[LOCAL] Build started on remote server");
    }

    /**
     * Vypsat informační řádek do terminálu (ekvivalent stdout)
     * @param line Řádek textu pro vypsání
     */
    private writeLine(line: string){
        this.virtualTerminal.writeLine(line);
    }

    /**
     * Vypsat chybový řádek do terminálu (ekvivalent stderr)
     * @param line Řádek chyby pro vypsání
     */
    private errorLine(line: string){
        this.virtualTerminal.errorLine(line);
    }

    /**
     * Zobrazí na terminálu aktuální informaci o stavu fronty
     * @param pos Pozice tohoto požadavku ve frontě
     * @param size Celkové délka fronty
     */
    private sendQueueInfo(pos: number, size: number){
        if(this.queueFirstTime){
            this.writeLine("");
            this.writeLine(colors.yellow("[LOCAL] Unfortunately, the server is at maximum capacity. Your task has been placed in queue."));
            this.writeLine(colors.yellow("[LOCAL] You can cancel this task by killing this terminal (note that by doing this you will loose your position in the queue)"));
            this.writeLine("");
            this.queueFirstTime = false;
        }
        this.writeLine(`[LOCAL] Your current position in the queue: ${pos} out of ${size} waiting task(s)`);
        if(pos === 1)
            this.writeLine("[LOCAL] You are first in the queue. Expect your task to start soon...");
    }

    /**
     * Ukončit překlad
     *
     * @param res Je specifikován, pokud překlad ukončil server (úspěšně nebo neúspěšně)
     */
    public async close(res?: BuildResult){
        // Uklidit všechny zachytávače eventů
        this.disposables.forEach(d => d.dispose());

        // Říci serveru (pokud ještě existuje), že překlad byl ukončena
        if(this.connection) this.connection.send({type: "build-end"});

        if(res) await this.saveBinFiles(res);

        this.virtualTerminal.anyKeyToClose();

        this.onDidCloseEmitter.fire();

        if(this.connection) this.connection.LogPath = undefined;
    }

    private async saveBinFiles(res: BuildResult){
        if(res.ExitStatus === 0){
            this.virtualTerminal.writeLine(colors.green("\n\n[LOCAL] BUILD SUCCESS! Saving files..."));
        }

        const buildFolder = join(this.path, "build");

        if(res.FpgaBinary){
            Utils.createDirectory(buildFolder);
            Utils.writeFile(
                join(buildFolder, "output.bin"),
                new Buffer(res.FpgaBinary, "base64")
            );

            this.virtualTerminal,this.writeLine(colors.green("[LOCAL] FPGA bin file saved to build/output.bin"));
        }

        if(res.McuV1Binary){
            Utils.createDirectory(buildFolder);
            Utils.writeFile(
                join(buildFolder, "output_f1xx.hex"),
                new Buffer(res.McuV1Binary, "base64")
            );

            this.virtualTerminal,this.writeLine(colors.green("[LOCAL] MCU v1.x file saved to build/output_f1xx.hex"));
        }

        if(res.McuV2Binary){
            Utils.createDirectory(buildFolder);
            Utils.writeFile(
                join(buildFolder, "output_f2xx.hex"),
                new Buffer(res.McuV2Binary, "base64")
            );

            this.virtualTerminal,this.writeLine(colors.green("[LOCAL] MCU v2.x file saved to build/output_f2xx.hex"));
        }
    }
}
