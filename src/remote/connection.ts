import { assertType } from 'typescript-is';
import { ClientMessage } from './../models/ClientMessage';
import { ServerMessage } from './../models/ServerMessage';
import { client as WebSocketClient, IClientConfig, connection, IMessage } from "websocket";
import * as url from "url";
import { EventEmitter, Disposable, StatusBarItem, window, StatusBarAlignment } from 'vscode';
import { BuildResult } from '../models/BuildResult';
import { Authentication } from '../auth/Authentication';
import { ExtensionConfig } from '../ExtensionConfig';
import { promises as fs} from "fs";

/**
 * Singleton třída spojení s překladovým serverem
 */
export class Connection{
    private static ActiveConnection?: Connection;

    /** Instance WebSocket spojení. Je dostupná až po handshake */
    private Connection?: connection;

    /** Ukazatel na stavový text zobrazený vespod editoru */
    private static Status?: StatusBarItem;

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

    /** Spuštení simulace */
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
    public get Connected() : boolean {
        if(!this.Connection) return false;
        return this.Connection.connected;

    }

    /** Server ukončil spojení */
    public get IsClosed(): boolean {
        if(!this.Connection) return false;
        return this.Connection.closeReasonCode > -1;
    }

    /**
     * Naváže spojení s překladovým serverem
     *
     * @param token JWT token pro autorizaci
     * @param host Adresa vzdáleného serveru. Př. 127.0.0.1, zakladna.eu:9069
     * @param config Volitelná konfigurace WebSocket spojení
     */
    public constructor(token: string, host: string, config?: IClientConfig){
        if(!Connection.Status){
            Connection.Status = window.createStatusBarItem();
            Connection.Status.command = "fitkit.disconnect";
            Connection.Status.tooltip = "Click to disconnect from server";
        }

        Connection.Status.show();
        Connection.Status.text = "Connecting to build server...";

        let request = url.parse(`ws://${host}/`);
        request.port = request.port ?? "9000";

        let client = new WebSocketClient(config);
        client.on("connect", conn => this.Accepted(conn));
        client.on("connectFailed", err => {
            console.error(err);

            let errMsg = err.message;
            if(errMsg.includes("401 Unauthorized")){
                Authentication.Invalidate();
                errMsg += "\n\nYou local auth token has been removed. You will be prompted to authorize on next connection.";
            }
            this.onServerErrorEmitter.fire(errMsg);
            this.onDidCloseEmitter.fire(-1);

            Connection.Status?.hide();
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
    private Accepted(connection: connection){
        console.log(`Connected to remote server`);
        if(Connection.Status) Connection.Status.text = "Connected to build server";

        this.Connection = connection;
        connection.on("message", data => this.ReceiveMessage(data));
        connection.on("close", code => this.Closed(code));

        this.onDidConnectEmitter.fire();
    }

    /**
     * Spojení se serverrem bylo uzavřeno
     */
    private Closed(code: number){
        console.log(`Connection closed (code: ${code})`);

        this.onDidCloseEmitter.fire(code);
        Connection.Status?.hide();
    }

    /**
     * Odeslat zprávu serveru
     *
     * @param msg Zpráva ve správném formátu
     */
    public Send(msg: ClientMessage){
        if(!this.Connection?.connected) return;

        if(this.LogPath){
            fs.appendFile(this.LogPath, `[CLIENT] ${JSON.stringify(msg, null, "    ")}\n`);
        }

        this.Connection.sendUTF(JSON.stringify(msg));
    }

    /**
     * Zpracovat nově přijatou zprávu ze serveru
     *
     * @param data WebSocket data zprávy
     */
    private ReceiveMessage(data: IMessage){
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

    public static async GetActiveConnection(): Promise<Connection>{
        if(this.ActiveConnection?.Connected) return this.ActiveConnection;

        const conn = new Connection(
            await Authentication.GetToken(),
            ExtensionConfig.RemoteServerIp
        );

        this.ActiveConnection = conn;
        return conn;
    }

    public static DisconnectFromServer(){
        if(this.ActiveConnection?.Connected){
            this.ActiveConnection.Connection?.close();
        }
    }
}
