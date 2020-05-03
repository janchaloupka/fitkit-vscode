import { Utils } from '../common/Utils';
import { RepositoryCommands } from './repositoryCommands';
import { ConfigParser } from '../common/ConfigParser';
import { Repository } from './repository';
import { window, TreeView, TreeDataProvider, Event, EventEmitter, FileType, TreeItem, TreeItemCollapsibleState, commands } from "vscode";
import * as path from "path";

export interface TreeChild{
	Path: string;
	IsCategory: boolean;
	Name: string;
	Description?: string;
	IsButton?: boolean
}

class RepositoryViewDataProvider implements TreeDataProvider<TreeChild>{
	private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
	readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

	public Refresh(){
		this._onDidChangeTreeData.fire();
	}

	private async ParseChild(folder: string): Promise<TreeChild|undefined>{
		try{
			let config = await ConfigParser.CategoryXml(path.join(folder, "description.xml"));

			return {
				Path: folder,
				IsCategory: true,
				Name: config.category.name
			};
		}catch(e){}

		try{
			let config = await ConfigParser.ProjectXml(path.join(folder, "project.xml"));

			return {
				Path: folder,
				IsCategory: false,
				Name: config.name,
				Description: config.description
			};
		}catch(e){}

		return undefined;
	}

	public async getChildren(element: TreeChild | undefined): Promise<TreeChild[]>{
		if(element?.IsCategory === false) return [];

		let basePath: string = element?.Path ?? Repository.Folder.Apps;
		let folders: [string, FileType][];
		try{
			if(!(await Repository.Exists())) throw Error();
			folders = await Utils.ReadDirectory(basePath);
		}catch(e){
			console.log("Repository not found");
			return [];
		}

		let children: TreeChild[] = [];
		for (const folder of folders) {
			if(folder[1] !== FileType.Directory) continue;
			let folderPath = path.join(basePath, folder[0]);

			let child = await this.ParseChild(folderPath);
			if(child) children.push(child);
		}

		return children;
	}

	public getTreeItem(element: TreeChild): TreeItem{
		return {
			collapsibleState: element.IsCategory ?
				TreeItemCollapsibleState.Collapsed :
				TreeItemCollapsibleState.None,
			label: element.Name,
			tooltip: element.Description,
			contextValue: element.IsCategory ? "category" : "project",
			id: element.Path,
			command: element.IsCategory ? undefined : {
				command: "fitkit.repository.openProject",
				arguments: [element, true],
				title: "Open project"
			}
		};
	}
}

export class RepositoryView{
	private static TreeView?: TreeView<TreeChild>;
	private static DataProvider?: RepositoryViewDataProvider;

	constructor(){

		RepositoryView.DataProvider = new RepositoryViewDataProvider();

		RepositoryView.TreeView = window.createTreeView("fitkit.repositoryView", {
			treeDataProvider: RepositoryView.DataProvider,
			canSelectMany: false,
			showCollapseAll: true
		});

		Repository.OnExistChange((exists: boolean) => {
			commands.executeCommand("setContext", "fitkit.repository.available", exists);
			RepositoryView.Refresh();
		});

		RepositoryView.Refresh();
	}

	public static async Refresh(){
		console.log("refresh");
		this.DataProvider?.Refresh();

		if(!this.TreeView) return;
		this.TreeView.message = (await Repository.Exists()) ? "" : "Project repository was not found.";
	}
}
