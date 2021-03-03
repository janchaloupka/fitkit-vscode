import { Utils } from './../common/Utils';
import { BuildResult } from './../models/BuildResult';
import { Disposable } from 'vscode';
import { Connection } from '../remote/Connection';
import { ProjectData } from '../models/ProjectData';
import { VirtualTerminal } from '../common/VirtualTerminal';
import { window, Terminal, EventEmitter } from 'vscode';
import * as colors from "colors/safe";
import { join } from 'path';
import { ExtensionConfig } from '../ExtensionConfig';

/**
 * Logika pro ovládání a přijímání zpráv o vzdáleném překladu
 */
export class Build{
	private onDidCloseEmitter = new EventEmitter<void>();

	private Terminal: Terminal;
	private VirtualTerminal: VirtualTerminal;
	private ProjectData: ProjectData;
	private Connection?: Connection;

	public readonly Path: string;

	/** Seznam všech prvků, které je nutné po ukončení uklidit. Většinou event listenery */
	private Disposables: Disposable[] = [];

	/** Indikátor, zda se hláška o zařazení do fronty zobrazuje poprvé */
	private QueueFirstTime = true;

	/** Došlo k ukončení překladu */
	public readonly onDidClose = this.onDidCloseEmitter.event;

	public constructor(project: ProjectData, path: string){
		this.ProjectData = project;

		this.Path = path;

		this.VirtualTerminal = new VirtualTerminal();
		this.Disposables.push(this.VirtualTerminal.onDidClose(() => this.Close()));

		this.Terminal = window.createTerminal({
			name: "Remote Build",
			pty: this.VirtualTerminal
		});
		this.Terminal.show();
	}

	/**
	 * Spustit překlad
	 *
	 * Překlad se nespustí ihned, ale nevázě se spojení se serverem a pošle se
	 * požadavek na spuštení překladu
	 */
	public async Init(){
		this.WriteLine("[LOCAL] Establishing connection to build server...");

		try{
			this.Connection = await Connection.GetActiveConnection();
		}catch(e){
			this.ErrorLine(`[LOCAL] ${e.toString()}`);
			this.Close();
			return;
		}

		if(ExtensionConfig.LogDebugInfo){
			const logPath = join(this.Path, "server_communication.log");
			try{
				await Utils.DeletePath(logPath);
			}catch(e){}
			this.Connection.LogPath = logPath;
		}else
			this.Connection.LogPath = undefined;

		this.Disposables.push(
			this.Connection.onBuildBegin(() => this.Begin()),
			this.Connection.onBuildStderr(line => this.ErrorLine(line)),
			this.Connection.onBuildStdout(line => this.WriteLine(line)),
			this.Connection.onBuildEnd(res => this.Close(res)),
			this.Connection.onBuildQueue(info => this.SendQueueInfo(info.pos, info.size)),
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
		this.WriteLine("[LOCAL] Connection established. Sending build request...");
		this.Connection?.Send({
			type: "build-begin",
			data: this.ProjectData
		});
	}

	/**
	 * Překlad začal
	 */
	private Begin(){
		this.WriteLine("[LOCAL] Build started on remote server");
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
	 * Uknončit překlad
	 *
	 * @param res Je specifikován, pokud překlad ukončil server (úspěšně nebo neúspěšně)
	 */
	public async Close(res?: BuildResult){
		// Uklidit všechny zachytávače eventů
		this.Disposables.forEach(d => d.dispose());

		// Říci serveru (pokud ještě existuje), že překlad byl ukončena
		if(this.Connection) this.Connection.Send({type: "build-end"});

		if(res) await this.SaveBinFiles(res);

		this.VirtualTerminal.AnyKeyToClose();

		this.onDidCloseEmitter.fire();

		if(this.Connection) this.Connection.LogPath = undefined;
	}

	private async SaveBinFiles(res: BuildResult){
		if(res.ExitStatus === 0){
			this.VirtualTerminal.WriteLine(colors.green("\n\n[LOCAL] BUILD SUCCESS! Saving files..."));
		}

		const buildFolder = join(this.Path, "build");

		if(res.FpgaBinary){
			Utils.CreateDirectory(buildFolder);
			Utils.WriteFile(
				join(buildFolder, "output.bin"),
				new Buffer(res.FpgaBinary, "base64")
			);

			this.VirtualTerminal,this.WriteLine(colors.green("[LOCAL] FPGA bin file saved to build/output.bin"));
		}

		if(res.McuV1Binary){
			Utils.CreateDirectory(buildFolder);
			Utils.WriteFile(
				join(buildFolder, "output_f1xx.hex"),
				new Buffer(res.McuV1Binary, "base64")
			);

			this.VirtualTerminal,this.WriteLine(colors.green("[LOCAL] MCU v1.x file saved to build/output_f1xx.hex"));
		}

		if(res.McuV2Binary){
			Utils.CreateDirectory(buildFolder);
			Utils.WriteFile(
				join(buildFolder, "output_f2xx.hex"),
				new Buffer(res.McuV2Binary, "base64")
			);

			this.VirtualTerminal,this.WriteLine(colors.green("[LOCAL] MCU v2.x file saved to build/output_f2xx.hex"));
		}
	}
}
