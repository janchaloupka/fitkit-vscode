import { Utils } from '../common/utils';
import { RepositoryCommands } from './repository-commands';
import { ConfigParser } from '../common/config-parser';
import { Repository } from './repository';
import { window, TreeView, TreeDataProvider, Event, EventEmitter, FileType, TreeItem, TreeItemCollapsibleState, commands } from "vscode";
import * as path from "path";

export interface TreeChild{
    path: string;
    isCategory: boolean;
    name: string;
    description?: string;
    isButton?: boolean
}

class RepositoryViewDataProvider implements TreeDataProvider<TreeChild>{
    private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
    readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

    public refresh(){
        this._onDidChangeTreeData.fire(undefined);
    }

    private async parseChild(folder: string): Promise<TreeChild|undefined>{
        try{
            let config = await ConfigParser.categoryXml(path.join(folder, "description.xml"));

            return {
                path: folder,
                isCategory: true,
                name: config.category.name
            };
        }catch(e){}

        try{
            let config = await ConfigParser.projectXml(path.join(folder, "project.xml"));

            return {
                path: folder,
                isCategory: false,
                name: config.name,
                description: config.description
            };
        }catch(e){}

        return undefined;
    }

    public async getChildren(element: TreeChild | undefined): Promise<TreeChild[]>{
        if(element?.isCategory === false) return [];

        let basePath: string = element?.path ?? Repository.folder.apps;
        let folders: [string, FileType][];
        try{
            if(!(await Repository.exists())) throw Error();
            folders = await Utils.readDirectory(basePath);
        }catch(e){
            console.log("Repository not found");
            return [];
        }

        let children: TreeChild[] = [];
        for (const folder of folders) {
            if(folder[1] !== FileType.Directory) continue;
            let folderPath = path.join(basePath, folder[0]);

            let child = await this.parseChild(folderPath);
            if(child) children.push(child);
        }

        return children;
    }

    public getTreeItem(element: TreeChild): TreeItem{
        return {
            collapsibleState: element.isCategory ?
                TreeItemCollapsibleState.Collapsed :
                TreeItemCollapsibleState.None,
            label: element.name,
            tooltip: element.description,
            contextValue: element.isCategory ? "category" : "project",
            id: element.path,
            command: element.isCategory ? undefined : {
                command: "fitkit.repository.openProject",
                arguments: [element, true],
                title: "Open project"
            }
        };
    }
}

export class RepositoryView{
    private static treeView?: TreeView<TreeChild>;
    private static dataProvider?: RepositoryViewDataProvider;

    constructor(){

        RepositoryView.dataProvider = new RepositoryViewDataProvider();

        RepositoryView.treeView = window.createTreeView("fitkit.repositoryView", {
            treeDataProvider: RepositoryView.dataProvider,
            canSelectMany: false,
            showCollapseAll: true
        });

        Repository.onExistChange((exists: boolean) => {
            commands.executeCommand("setContext", "fitkit.repository.available", exists);
            RepositoryView.Refresh();
        });

        RepositoryView.Refresh();
    }

    public static async Refresh(){
        console.log("refresh");
        this.dataProvider?.refresh();

        if(!this.treeView) return;
        this.treeView.message = (await Repository.exists()) ? "" : "Project repository was not found.";
    }
}
