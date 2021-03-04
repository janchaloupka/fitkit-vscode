import { Utils } from '../common/utils';
import { FitkitSerial } from '../serial/fitkit-serial';
import { Build } from '../build/build';
import { Simulation } from '../simulation/simulation';
import { ProjectData } from '../models/project-data';
import { Project } from './project';
import { ProjectDataBuilder } from './project-data-builder';
import { commands, window, workspace } from "vscode";
import { ExtensionConfig } from '../extension-config';

/**
 * Implementace příkazů pro práci s projektem
 */
export class ProjectCommands{
    public static extensionPath ?: string;

    /**
     * Instance aktivní simulace
     */
    private simulation?: Simulation;

    /**
     * Instance aktivního sestavení
     */
    private build?: Build;

    constructor(){
        commands.registerCommand("fitkit.project.remoteBuild", () => this.remoteBuild());
        commands.registerCommand("fitkit.project.remoteIsim", () => this.remoteIsim());
        commands.registerCommand("fitkit.project.flash", () => this.flash());
        commands.registerCommand("fitkit.project.openTerminal", () => this.openTerminal());
        commands.registerCommand("fitkit.project.flashAndRun", () => this.flash(true));
    }

    /**
     * Vzdálený překlad projektu
     */
    public async remoteBuild(){
        // Ochrana proti dvojkliku
        if(Utils.doubleClickCheck("remoteBuild")) return;

        let projects = await Project.openedProjects();
        if(projects.length < 0) return;

        // Uložit rozpracované soubory
        if(ExtensionConfig.saveOnBuild) await workspace.saveAll(false);

        let data: ProjectData;
        let build = new ProjectDataBuilder(projects[0]);
        try{
            data = await build.create();
        }catch(e){
            window.showErrorMessage(`Error while parsing project configuration file. ${e.toString()}`);
            console.error(e);
            return;
        }

        console.log(data.mcu?.headers.map(m => m.path));
        console.log(data.fpga?.files.map(f => f.path));

        if(this.build) this.build.close();

        try{
            this.build = new Build(data, projects[0]);
            this.build.onDidClose(() => this.build = undefined);
            await this.build.init();
        }catch(e){
            console.error(e);
        }
    }

    /**
     * Vzdálená simulace projektu
     */
    public async remoteIsim(){
        // Ochrana proti dvojkliku
        if(Utils.doubleClickCheck("remoteIsim")) return;

        let projects = await Project.openedProjects();
        if(projects.length < 0) return;

        // Uložit rozpracované soubory
        if(ExtensionConfig.saveOnBuild) await workspace.saveAll(false);

        let data: ProjectData;
        let build = new ProjectDataBuilder(projects[0]);
        try{
            data = await build.create();
        }catch(e){
            window.showErrorMessage(`Error while parsing project configuration file. ${e.toString()}`);
            console.error(e);
            return;
        }

        if(this.simulation) this.simulation.close();

        try{
            this.simulation = new Simulation(data, projects[0]);
            this.simulation.onDidClose(() => this.simulation = undefined);
            await this.simulation.init();
        }catch(e){
            console.error(e);
        }
    }

    /**
     * Programování projektu do přípravku FITkit
     */
    public async flash(runAfter = false){
        // Ochrana proti dvojkliku
        if(Utils.doubleClickCheck("projectFlash")) return;

        let projects = await Project.openedProjects();
        if(projects.length < 0){
            window.showErrorMessage("No FITkit project is opened");
            return;
        }

        let term = new FitkitSerial();
        try{
            await term.flash(projects[0], runAfter);
        }catch(e){
            console.error(e);
            window.showErrorMessage("FITkit flash error: " + e.toString());
            term.close();
        }

    }

    /**
     * Otevření terminálu a aktivace programu v přípravku FITkit
     */
    public async openTerminal(){
        // Ochrana proti dvojkliku
        if(Utils.doubleClickCheck("openTerminal")) return;

        let term = new FitkitSerial();
        term.openTerminal();
    }
}
