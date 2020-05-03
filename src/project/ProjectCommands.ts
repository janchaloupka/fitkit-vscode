import { Utils } from '../common/Utils';
import { FitkitSerial } from '../serial/FitkitSerial';
import { Build } from '../build/Build';
import { Simulation } from '../simulation/Simulation';
import { ProjectData } from '../models/ProjectData';
import { Project } from './Project';
import { ProjectDataBuilder } from './ProjectDataBuilder';
import { commands, window } from "vscode";

/**
 * Implementace příkazů pro práci s projektem
 */
export class ProjectCommands{
	public static ExtensionPath ?: string;

	/**
	 * Instance aktivní simulace
	 */
	private Simulation?: Simulation;

	/**
	 * Instance aktivního sestavení
	 */
	private Build?: Build;

	constructor(){
		commands.registerCommand("fitkit.project.remoteBuild", () => this.RemoteBuild());
		commands.registerCommand("fitkit.project.remoteIsim", () => this.RemoteIsim());
		commands.registerCommand("fitkit.project.flash", () => this.Flash());
		commands.registerCommand("fitkit.project.openTerminal", () => this.OpenTerminal());
		commands.registerCommand("fitkit.project.flashAndRun", () => this.Flash(true));
	}

	/**
	 * Vzdálený překlad projektu
	 */
	public async RemoteBuild(){
		// Ochrana proti dvojkliku
		if(Utils.DoubleClickCheck("remoteBuild")) return;

		let projects = await Project.OpenedProjects();
		if(projects.length < 0) return;

		let data: ProjectData;
		let build = new ProjectDataBuilder(projects[0]);
		try{
			data = await build.Create();
		}catch(e){
			window.showErrorMessage(`Error while parsing project configuration file. ${e.toString()}`);
			console.error(e);
			return;
		}

		console.log(data.Mcu.Headers.map(m => m.Path));
		console.log(data.Fpga.Files.map(f => f.Path));

		if(this.Build) this.Build.Close();

		try{
			this.Build = new Build(data, projects[0]);
			this.Build.onDidClose(() => this.Build = undefined);
			await this.Build.Init();
		}catch(e){
			console.error(e);
		}
	}

	/**
	 * Vzdálená simulace projektu
	 */
	public async RemoteIsim(){
		// Ochrana proti dvojkliku
		if(Utils.DoubleClickCheck("remoteIsim")) return;

		let projects = await Project.OpenedProjects();
		if(projects.length < 0) return;

		let data: ProjectData;
		let build = new ProjectDataBuilder(projects[0]);
		try{
			data = await build.Create();
		}catch(e){
			window.showErrorMessage(`Error while parsing project configuration file. ${e.toString()}`);
			console.error(e);
			return;
		}

		if(this.Simulation) this.Simulation.Close();

		try{
			this.Simulation = new Simulation(data);
			this.Simulation.onDidClose(() => this.Simulation = undefined);
			await this.Simulation.Init();
		}catch(e){
			console.error(e);
		}
	}

	/**
	 * Programování projektu do přípravku FITkit
	 */
	public async Flash(runAfter = false){
		// Ochrana proti dvojkliku
		if(Utils.DoubleClickCheck("projectFlash")) return;

		let projects = await Project.OpenedProjects();
		if(projects.length < 0){
			window.showErrorMessage("No FITkit project is opened");
			return;
		}

		let term = new FitkitSerial();
		try{
			await term.Flash(projects[0], runAfter);
		}catch(e){
			console.error(e);
			window.showErrorMessage("FITkit flash error: " + e.toString());
			term.Close();
		}

	}

	/**
	 * Otevření terminálu a aktivace programu v přípravku FITkit
	 */
	public async OpenTerminal(){
		// Ochrana proti dvojkliku
		if(Utils.DoubleClickCheck("openTerminal")) return;

		let term = new FitkitSerial();
		term.OpenTerminal();
	}
}
