import { Repository } from '../repository/Repository';
import { Utils } from '../common/Utils';
import { ProjectCommands } from './ProjectCommands';
import { ProjectView } from "./ProjectView";
import { commands, workspace } from 'vscode';
import * as path from "path";

/**
 * Singleton reprezentující otevřený FITkit projekt
 */
export class Project{
    /**
     * Inicializuje veškerou funkcionalitu spojenou s otevřeným projektem
     */
    public static async Init(){
        this.CheckOpenedProjects();
        workspace.onDidChangeWorkspaceFolders(() => this.CheckOpenedProjects());

        new ProjectView();
        new ProjectCommands();
    }

    /**
     * Kontrola, zda je mezi otevřenými složkami FITkit projekt
     */
    public static async CheckOpenedProjects(){
        console.log("Checking for opened projects...");
        let isOpen = (await this.OpenedProjects()).length > 0;
        commands.executeCommand("setContext", "fitkit.project.isOpen", isOpen);

        if(!isOpen) return;
        console.log("FITkit project is open!");
    }

    /**
     * Získat seznam všech aktuálních kořenových složek v editoru
     */
    public static async OpenedProjects(): Promise<string[]>{
        let projects: string[] = [];
        let folders = workspace.workspaceFolders?.map((folder) => folder.uri);
        if(!folders) return projects;

        for (const folder of folders) {
            if(!Utils.IsSubpath(Repository.Folder.Apps, folder))
                continue;

            if(await Utils.FileExists(path.join(folder.fsPath, "project.xml")))
                projects.push(folder.fsPath);
        }

        return projects;
    }
}
