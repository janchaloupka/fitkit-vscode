import { Disposable } from 'vscode';
import { Connection } from '../remote/connection';
import { ProjectData } from '../models/project-data';
import { VirtualTerminal } from '../common/virtual-terminal';
import { window, Terminal, EventEmitter } from 'vscode';
import { SimulationView } from './simulation-view';
import * as colors from "colors/safe";
import { ExtensionConfig } from '../extension-config';
import { join } from 'path';
import { Utils } from '../common/utils';

/**
 * Logika pro ovládání a přijímání zpráv o vzdálené simulaci
 */
export class Simulation{
    private onDidCloseEmitter = new EventEmitter<void>();

    private view?: SimulationView;
    private terminal: Terminal;
    private virtualTerminal: VirtualTerminal;
    private projectData: ProjectData;
    private connection?: Connection;
    private path :string;

    /** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
    private disposables: Disposable[] = [];

    /** Indikátor, zda se hláška o zařazení do fronty zobrazuje poprvé */
    private queueFirstTime = true;

    /** Došlo k ukončení simulace */
    public readonly onDidClose = this.onDidCloseEmitter.event;

    public constructor(project: ProjectData, projectPath: string){
        this.projectData = project;
        this.path = projectPath;

        this.virtualTerminal = new VirtualTerminal();
        this.disposables.push(this.virtualTerminal.onDidClose(() => this.close()));

        this.terminal = window.createTerminal({
            name: "ISIM Output",
            pty: this.virtualTerminal
        });
        this.terminal.show();
    }

    /**
     * Spustit simulaci
     *
     * Simulace se nespustí ihned, ale naváže se spojení se serverem a pošle se
     * požadavek na spuštění simulace
     */
    public async init(){
        this.writeLine("[LOCAL] Preparing simulation...");

        if(!this.projectData.fpga.isimFile){
            this.errorLine(`[LOCAL] Cannot find "fpga/sim/isim.tcl" ISIM configuration file. Simulation cannot start`);
            this.close();
            return;
        }

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
            this.connection.logPath = logPath;
        }else
            this.connection.logPath = undefined;

        this.disposables.push(
            this.connection.onIsimBegin(connString => this.begin(connString)),
            this.connection.onIsimStderr(line => this.errorLine(line)),
            this.connection.onIsimStdout(line => this.writeLine(line)),
            this.connection.onIsimEnd(() => this.close()),
            this.connection.onIsimQueue(info => this.sendQueueInfo(info.pos, info.size)),
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
        this.writeLine("[LOCAL] Connection established. Sending simulation request...");
        this.connection?.send({
            type: "isim-begin",
            data: this.projectData
        });
    }

    /**
     * Simulace začala
     *
     * @param connectionUrl adresa, kde je dostupný VNC stream ISIM okna
     */
    private begin(connectionUrl: string){
        this.writeLine("[LOCAL] Simulation started on remote server");
        this.view = new SimulationView(connectionUrl);
        this.disposables.push(this.view.onDidClose(() => {
            this.view = undefined;
            this.close();
        }));
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
     * Ukončit simulaci
     */
    public close(){
        // Uklidit všechny zachytávače eventů
        this.disposables.forEach(d => d.dispose());

        // Říci serveru (pokud ještě existuje), že simulace byla ukončena
        if(this.connection) this.connection.send({type: "isim-end"});

        this.view?.dispose();

        this.virtualTerminal.anyKeyToClose();

        this.onDidCloseEmitter.fire();

        if(this.connection) this.connection.LogPath = undefined;
    }
}
