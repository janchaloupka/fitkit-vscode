import { assertType } from 'typescript-is';
import { ClientMessage } from './../models/client-message';
import { ServerMessage } from './../models/server-message';
import { client as WebSocketClient, IClientConfig, connection, IMessage } from "websocket";
import * as url from "url";
import { EventEmitter, Disposable, StatusBarItem, window, StatusBarAlignment } from 'vscode';
import { BuildResult } from '../models/BuildResult';
import { Authentication } from '../auth/Authentication';
import { ExtensionConfig } from '../extension-config';
import { promises as fs} from "fs";

/**
 * Singleton třída spojení s překladovým serverem
 */
export class Connection{
    private static activeConnection?: Connection;

    /** Instance WebSocket spojení. Je dostupná až po handshake */
    private connection?: connection;

    /** Ukazatel na stavový text zobrazený vespod editoru */
    private static status?: StatusBarItem;

    private onDidConnectEmitter = new EventEmitter<void>();
    private onDidCloseEmitter = new EventEmitter<number>();
    private onBuildBeginEmitter = new EventEmitter<void>();
    private onBuildEndEmitter = new EventEmitter<BuildResult>();
    private onBuildQueueEmitter = new EventEmitter<{size: number, pos: number}>();
    private onBuildStderrEmitter = new EventEmitter<string>();
    private onBuildStdoutEmitter = new EventEmitter<string>();
    private onIsimBeginEmitter = new EventEmitter<string>();
    private onIsimEndEmitter = new EventEmitter<void>();
    private onIsimQueueEmitter = new EventEmitter<{size: number, pos: number}>();
    private onIsimStderrEmitter = new EventEmitter<string>();
    private onIsimStdoutEmitter = new EventEmitter<string>();
    private onProjectMappingEmitter = new EventEmitter<{[serverFile: string]: string}>();
    private onServerErrorEmitter = new EventEmitter<string>();

    /** Navázáno spojení se serverem */
    public readonly onDidConnect = this.onDidConnectEmitter.event;

    /** Spojení se serverem bylo ukončeno */
    public readonly onDidClose = this.onDidCloseEmitter.event;

    /** Zahájení sestavení projektu */
    public readonly onBuildBegin = this.onBuildBeginEmitter.event;

    /** Ukončení sestavení projektu */
    public readonly onBuildEnd = this.onBuildEndEmitter.event;

    /** Informace o aktuální délky a pozici ve frontě */
    public readonly onBuildQueue = this.onBuildQueueEmitter.event;

    /** Nový řádek chybového výstupu sestavení */
    public readonly onBuildStderr = this.onBuildStderrEmitter.event;

    /** Nový řádek výstupu sestavení */
    public readonly onBuildStdout = this.onBuildStdoutEmitter.event;

    /** Spuštění simulace */
    public readonly onIsimBegin = this.onIsimBeginEmitter.event;

    /** Ukončení simulace */
    public readonly onIsimEnd = this.onIsimEndEmitter.event;

    /** Informace o aktuální délky a pozici ve frontě */
    public readonly onIsimQueue = this.onIsimQueueEmitter.event;

    /** Nový řádek chybového výstupu konzole simulace */
    public readonly onIsimStderr = this.onIsimStderrEmitter.event;

    /** Nový řádek výstupu konzole simulace */
    public readonly onIsimStdout = this.onIsimStdoutEmitter.event;

    /** Mapování nově vytvořených souborů na serveru na lokální soubory */
    public readonly onProjectMapping = this.onProjectMappingEmitter.event;

    /** Zpráva o obecné chybě, která nastala na serveru */
    public readonly onServerError = this.onServerErrorEmitter.event;

    /** Specifikovat cestu, kde bude server ukládat log komunikace */
    public LogPath?: string;

    /** Je navázáno a otevřeno spojení se serverem */
    public get connected() : boolean {
        if(!this.connection) return false;
        return this.connection.connected;

    }

    /** Server ukončil spojení */
    public get isClosed(): boolean {
        if(!this.connection) return false;
        return this.connection.closeReasonCode > -1;
    }

    /**
     * Naváže spojení s překladovým serverem
     *
     * @param token JWT token pro autorizaci
     * @param host Adresa vzdáleného serveru. Př. 127.0.0.1, zakladna.eu:9069
     * @param config Volitelná konfigurace WebSocket spojení
     */
    public constructor(token: string, host: string, config?: IClientConfig){
        if(!Connection.status){
            Connection.status = window.createStatusBarItem();
            Connection.status.command = "fitkit.disconnect";
            Connection.status.tooltip = "Click to disconnect from server";
        }

        Connection.status.show();
        Connection.status.text = "Connecting to build server...";

        let request = url.parse(`ws://${host}/`);
        request.port = request.port ?? "9000";

        let client = new WebSocketClient(config);
        client.on("connect", conn => this.accepted(conn));
        client.on("connectFailed", err => {
            console.error(err);

            let errMsg = err.message;
            if(errMsg.includes("401 Unauthorized")){
                Authentication.invalidate();
                errMsg += "\n\nYou local auth token has been removed. You will be prompted to authorize on next connection.";
            }
            this.onServerErrorEmitter.fire(errMsg);
            this.onDidCloseEmitter.fire(-1);

            Connection.status?.hide();
        });

        console.log("Connecting to ", request.href, "with token", token);

        client.connect(request, undefined, undefined, {
            "Authorization": `Bearer ${token}`
        });
    }

    /**
     * Server přijal požadavek a spojení je nyní otevřeno
     *
     * @param connection Nově vytvořené WebSocket spojení
     */
    private accepted(connection: connection){
        console.log(`Connected to remote server`);
        if(Connection.status) Connection.status.text = "Connected to build server";

        this.connection = connection;
        connection.on("message", data => this.receiveMessage(data));
        connection.on("close", code => this.closed(code));

        this.onDidConnectEmitter.fire();
    }

    /**
     * Spojení se serverrem bylo uzavřeno
     */
    private closed(code: number){
        console.log(`Connection closed (code: ${code})`);

        this.onDidCloseEmitter.fire(code);
        Connection.status?.hide();
    }

    /**
     * Odeslat zprávu serveru
     *
     * @param msg Zpráva ve správném formátu
     */
    public send(msg: ClientMessage){
        if(!this.connection?.connected) return;

        if(this.LogPath){
            fs.appendFile(this.LogPath, `[CLIENT] ${JSON.stringify(msg, null, "    ")}\n`);
        }

        this.connection.sendUTF(JSON.stringify(msg));
    }

    /**
     * Zpracovat nově přijatou zprávu ze serveru
     *
     * @param data WebSocket data zprávy
     */
    private receiveMessage(data: IMessage){
        if(data.type !== "utf8") return;

        let msg: ServerMessage;

        try{
            msg = JSON.parse(data.utf8Data?? "{}");
            assertType<ServerMessage>(msg);
        }catch(e){
            console.error("Unknown server message:", data.utf8Data);
            console.error(e.toString());
            return;
        }

        if(this.LogPath){
            fs.appendFile(this.LogPath, `[SERVER] ${JSON.stringify(msg, null, "    ")}\n`);
        }

        //console.log(JSON.stringify(msg));

        // Zpracovat data ze serveru
        switch(msg.type){
            case "build-begin":
                this.onBuildBeginEmitter.fire();
                break;
            case "build-end":
                this.onBuildEndEmitter.fire(msg.data);
                break;
            case "build-queue":
                this.onBuildQueueEmitter.fire(msg.data);
                break;
            case "build-stderr":
                this.onBuildStderrEmitter.fire(msg.data);
                break;
            case "build-stdout":
                this.onBuildStdoutEmitter.fire(msg.data);
                break;
            case "isim-begin":
                this.onIsimBeginEmitter.fire(msg.data);
                break;
            case "isim-end":
                this.onIsimEndEmitter.fire();
                break;
            case "isim-queue":
                this.onIsimQueueEmitter.fire(msg.data);
                break;
            case "isim-stderr":
                this.onIsimStderrEmitter.fire(msg.data);
                break;
            case "isim-stdout":
                this.onIsimStdoutEmitter.fire(msg.data);
                break;
            case "project-mapping":
                this.onProjectMappingEmitter.fire(msg.data);
                break;
            case "error":
                this.onServerErrorEmitter.fire(msg.data);
                console.error(`Server error: ${msg.data}`);
        }
    }

    public static async getActiveConnection(): Promise<Connection>{
        if(this.activeConnection?.connected) return this.activeConnection;

        const conn = new Connection(
            await Authentication.getToken(),
            ExtensionConfig.remoteServerIp
        );

        this.activeConnection = conn;
        return conn;
    }

    public static disconnectFromServer(){
        if(this.activeConnection?.connected){
            this.activeConnection.connection?.close();
        }
    }
}
