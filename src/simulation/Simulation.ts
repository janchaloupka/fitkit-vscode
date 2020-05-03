import { Disposable } from 'vscode';
import { Connection } from '../remote/Connection';
import { ProjectData } from '../models/ProjectData';
import { VirtualTerminal } from '../common/VirtualTerminal';
import { window, Terminal, EventEmitter } from 'vscode';
import { SimulationView } from './SimulationView';
import * as colors from "colors/safe";

/**
 * Logika pro ovládání a přijímání zpráv o vzdálené simulaci
 */
export class Simulation{
	private onDidCloseEmitter = new EventEmitter<void>();

	private View?: SimulationView;
	private Terminal: Terminal;
	private VirtualTerminal: VirtualTerminal;
	private ProjectData: ProjectData;
	private Connection?: Connection;

	/** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
	private Disposables: Disposable[] = [];

	/** Indikátor, zda se hláška o zařazení do fronty zobrazuje poprvé */
	private QueueFirstTime = true;

	/** Došlo k ukončení simulace */
	public readonly onDidClose = this.onDidCloseEmitter.event;

	public constructor(project: ProjectData){
		this.ProjectData = project;

		this.VirtualTerminal = new VirtualTerminal();
		this.Disposables.push(this.VirtualTerminal.onDidClose(() => this.Close()));

		this.Terminal = window.createTerminal({
			name: "ISIM Output",
			pty: this.VirtualTerminal
		});
		this.Terminal.show();
	}

	/**
	 * Spustit simulaci
	 *
	 * Simulace se nespustí ihned, ale nevázě se spojení se serverem a pošle se
	 * požadavek na spuštení simulace
	 */
	public async Init(){
		this.WriteLine("[LOCAL] Preparing simulation...");

		if(!this.ProjectData.Fpga.IsimFile){
			this.ErrorLine(`[LOCAL] Cannot find "fpga/sim/isim.tcl" ISIM configuration file. Simulation cannot start`);
			this.Close();
			return;
		}

		this.WriteLine("[LOCAL] Establishing connection to build server...");

		try{
			this.Connection = await Connection.GetActiveConnection();
		}catch(e){
			this.ErrorLine(`[LOCAL] Failed to connect to the build server. ${e.toString()}`);
			this.Close();
			return;
		}

		this.Disposables.push(
			this.Connection.onIsimBegin(connString => this.Begin(connString)),
			this.Connection.onIsimStderr(line => this.ErrorLine(line)),
			this.Connection.onIsimStdout(line => this.WriteLine(line)),
			this.Connection.onIsimEnd(() => this.Close()),
			this.Connection.onIsimQueue(info => this.SendQueueInfo(info.pos, info.size)),
			this.Connection.onProjectMapping(map => this.VirtualTerminal.LoadFilesMapping(map)),
			this.Connection.onServerError(err => this.ErrorLine(`Server error: ${err}`)),
			this.Connection.onDidClose(() => this.Close())
		);

		if(this.Connection.Connected){
			this.SendRequest();
			return;
		}

		this.Disposables.push(
			this.Connection.onDidConnect(() => this.SendRequest())
		);
	}

	/**
	 * Poslat zprávu o zahájení simulace
	 */
	private SendRequest(){
		this.WriteLine("[LOCAL] Connection established. Sending simulation request...");
		this.Connection?.Send({
			type: "isim-begin",
			data: this.ProjectData
		});
	}

	/**
	 * Simulace začala
	 *
	 * @param connectionUrl adresa, kde je dostupný VNC stream ISIM okna
	 */
	private Begin(connectionUrl: string){
		this.WriteLine("[LOCAL] Simulation started on remote server");
		this.View = new SimulationView(connectionUrl);
		this.Disposables.push(this.View.onDidClose(() => {
			this.View = undefined;
			this.Close();
		}));
	}

	/**
	 * Vypsat informační řádek do terminálu (ekvivalent stdout)
	 * @param line Řádek textu pro vypsání
	 */
	private WriteLine(line: string){
		this.VirtualTerminal.WriteLine(line);
	}

	/**
	 * Vypsat chybový řádek do terminálu (ekvivalent stderr)
	 * @param line Řádek chyby pro vypsání
	 */
	private ErrorLine(line: string){
		this.VirtualTerminal.ErrorLine(line);
	}

	/**
	 * Zobrazí na terminálu aktuální informaci o stavu fronty
	 * @param pos Pozice tohoto požadavku ve frontě
	 * @param size Celkové délka fronty
	 */
	private SendQueueInfo(pos: number, size: number){
		if(this.QueueFirstTime){
			this.WriteLine("");
			this.WriteLine(colors.yellow("[LOCAL] Unfortunately, the server is at maximum capacity. Your task has been placed in queue."));
			this.WriteLine(colors.yellow("[LOCAL] You can cancel this task by killing this terminal (note that by doing this you will loose your position in the queue)"));
			this.WriteLine("");
			this.QueueFirstTime = false;
		}
		this.WriteLine(`[LOCAL] Your current position in the queue: ${pos} out of ${size} waiting task(s)`);
		if(pos === 1)
			this.WriteLine("[LOCAL] You are first in the queue. Expect your task to start soon...");
	}

	/**
	 * Uknončit simulaci
	 */
	public Close(){
		// Uklidit všechny zachytávače eventů
		this.Disposables.forEach(d => d.dispose());

		// Říci serveru (pokud ještě existuje), že simulace byla ukončena
		if(this.Connection) this.Connection.Send({type: "isim-end"});

		this.View?.Dispose();

		this.VirtualTerminal.AnyKeyToClose();

		this.onDidCloseEmitter.fire();
	}
}
