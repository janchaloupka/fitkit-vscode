import { Repository } from '../repository/repository';
import { Utils } from '../common/utils';
import { ProjectCommands } from './project-commands';
import { ProjectView } from "./project-view";
import { commands, workspace } from 'vscode';
import * as path from "path";

/**
 * Singleton reprezentující otevřený FITkit projekt
 */
export class Project{
    /**
     * Inicializuje veškerou funkcionalitu spojenou s otevřeným projektem
     */
    public static async init(){
        this.checkOpenedProjects();
        workspace.onDidChangeWorkspaceFolders(() => this.checkOpenedProjects());

        new ProjectView();
        new ProjectCommands();
    }

    /**
     * Kontrola, zda je mezi otevřenými složkami FITkit projekt
     */
    public static async checkOpenedProjects(){
        console.log("Checking for opened projects...");
        let isOpen = (await this.openedProjects()).length > 0;
        commands.executeCommand("setContext", "fitkit.project.isOpen", isOpen);

        if(!isOpen) return;
        console.log("FITkit project is open!");
    }

    /**
     * Získat seznam všech aktuálních kořenových složek v editoru
     */
    public static async openedProjects(): Promise<string[]>{
        let projects: string[] = [];
        let folders = workspace.workspaceFolders?.map((folder) => folder.uri);
        if(!folders) return projects;

        for (const folder of folders) {
            if(!Utils.isSubpath(Repository.folder.apps, folder))
                continue;

            if(await Utils.fileExists(path.join(folder.fsPath, "project.xml")))
                projects.push(folder.fsPath);
        }

        return projects;
    }
}
