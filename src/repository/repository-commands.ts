import { DefaultMCUFile, DefaultTopVHDLFile, DefaultTestBench, DefaultIsimScript } from './DefaultProjectFiles';
import { ConfigParser } from '../common/ConfigParser';
import { Utils } from '../common/Utils';
import { env, Uri, commands, window } from "vscode";
import { Repository } from "./Repository";
import { TreeChild, RepositoryView } from "./repositoryView";
import * as path from "path";
import latinize = require('latinize');

export class RepositoryCommands{
	constructor(){
		commands.registerCommand("fitkit.repository.openRootInOS", () => this.OpenRootInOS());
		commands.registerCommand("fitkit.repository.openFolderInOS", (i) => this.OpenFolderInOS(i));
		commands.registerCommand("fitkit.repository.openProject", (i, j) => this.OpenProject(i, j));
		commands.registerCommand("fitkit.repository.openProjectSameWindow", i => this.OpenProjectSameWindow(i));
		commands.registerCommand("fitkit.repository.refreshView", () => this.RefreshView());
		commands.registerCommand("fitkit.repository.deleteFolder", (i) => this.DeleteFolder(i));
		commands.registerCommand("fitkit.repository.download", () => this.Download());
		commands.registerCommand("fitkit.repository.redownload", () => this.Download());
		commands.registerCommand("fitkit.repository.rename", (i) => this.Rename(i));
		commands.registerCommand("fitkit.repository.newCategory", (i) => this.NewCategory(i));
		commands.registerCommand("fitkit.repository.createProject", (i) => this.CreateProject(i));
	}

	private OpenRootInOS(){
		env.openExternal(Uri.file(Repository.Folder.Root));
	}

	private OpenFolderInOS(item: TreeChild){
		env.openExternal(Uri.file(item.Path));
	}

	private OpenProject(item: TreeChild, requireDoubleClick: boolean = false){
		if(item.IsCategory) return;
		if(requireDoubleClick && !Utils.DoubleClickCheck(item)) return;

		commands.executeCommand("vscode.openFolder", Uri.file(item.Path), true);
	}

	private OpenProjectSameWindow(item: TreeChild){
		if(item.IsCategory) return;

		commands.executeCommand("vscode.openFolder", Uri.file(item.Path));
	}

	private RefreshView(){
		RepositoryView.Refresh();
	}

	private async Download(){
		await Repository.Download();
		RepositoryView.Refresh();
	}

	private async NewCategory(item?: TreeChild){
		item = item ?? {
			IsCategory: true,
			Path: Repository.Folder.Apps,
			Name: "root folder"
		};

		let name = await window.showInputBox({
			prompt: `(1/2) Enter category name. This category will be created in ${item.Name}.`,
			placeHolder: "Full category name (e.g. \"Demo Applications\")"
		});

		name = name?.trim();
		if(!name || name.length === 0) return;

		let folder = await window.showInputBox({
			prompt: `(2/2) Enter category folder name.`,
			placeHolder: "Folder name (e.g. \"demo_applications\")",
			value: latinize(name.toLowerCase().replace(/\s/g, "_"))
		});

		folder = folder?.trim();
		if(!folder || folder.length === 0) return;

		await Utils.CreateDirectory(path.join(item.Path, folder));
		await Utils.WriteFile(path.join(item.Path, folder, "description.xml"), ConfigParser.ToXml({
			category: {name: name}
		}));

		RepositoryView.Refresh();
	}

	private async CreateProject(item?: TreeChild){
		item = item ?? {
			IsCategory: true,
			Path: Repository.Folder.Apps,
			Name: "root folder"
		};

		let name = await window.showInputBox({
			prompt: `(1/4) Enter project name. This project will be created in ${item.Name}.`,
			placeHolder: "Full project name (e.g. \"Keyboard Demo Application\")"
		});

		name = name?.trim();
		if(!name || name.length === 0) return;

		let folder = await window.showInputBox({
			prompt: `(2/4) Enter project folder name.`,
			placeHolder: "Folder name (e.g. \"keyboard_demo\")",
			value: latinize(name.toLowerCase().replace(/\s/g, "_"))
		});

		folder = folder?.trim();
		if(!folder || folder.length === 0) return;

		let author = await window.showInputBox({
			prompt: `(3/4) Enter author full name.`,
			placeHolder: "Author full name (e.g. \"John Doe\")",
			value: await Utils.GetUserFullname()
		});

		author = author?.trim();
		if(!author || author.length === 0) return;

		let desc = await window.showInputBox({
			prompt: `(4/4) Enter project description (optional).`
		});

		if(desc === undefined) return;
		desc = desc.trim();

		// Vytvořít výchozí strukturu projektu
		await Utils.CreateDirectory(path.join(item.Path, folder, "mcu"));
		await Utils.CreateDirectory(path.join(item.Path, folder, "fpga"));
		await Utils.CreateDirectory(path.join(item.Path, folder, "fpga", "sim"));
		await Utils.WriteFile(path.join(item.Path, folder, "project.xml"), ConfigParser.ToXml({
			project: {
				name: name,
				author: author,
				description: desc,
				revision: Utils.GetRevisionString(),
				fpga: {
					_dcmfrequency: "20MHz",
					_architecture: "gp",
					file: ["top.vhd", {$: "fpga/sim/tb.vhd", _context: "sim"}]
				},
				mcu: {file: "main.c"}
			}
		}));
		await Utils.WriteFile(path.join(item.Path, folder, "mcu", "main.c"), DefaultMCUFile);
		await Utils.WriteFile(path.join(item.Path, folder, "fpga", "top.vhd"), DefaultTopVHDLFile);
		await Utils.WriteFile(path.join(item.Path, folder, "fpga", "sim", "tb.vhd"), DefaultTestBench);
		await Utils.WriteFile(path.join(item.Path, folder, "fpga", "sim", "isim.tcl"), DefaultIsimScript);

		this.OpenProject({IsCategory: false, Name: name, Path: path.join(item.Path, folder)});
	}

	private async Rename(item: TreeChild){
		if(!item.IsCategory) return;
		let configPath = path.join(item.Path, "description.xml");

		try{
			let config = await ConfigParser.CategoryXml(configPath);

			let newName = await window.showInputBox({
				value: item.Name,
				prompt: `Enter new name for the "${item.Name}" category.`,
				placeHolder: "New name (e.g. \"Media\")"
			});

			newName = newName?.trim();
			if(!newName || newName.length === 0) return;
			config.category.name = newName;

			await Utils.WriteFile(configPath, ConfigParser.ToXml(config));
			RepositoryView.Refresh();
		}catch(e){
			window.showErrorMessage("Failed to rename category. " + e.toString());
		}

	}

	private async DeleteFolder(item: TreeChild){
		let question = `Do you really want to DELETE this ${item.IsCategory?"category":"project"} and all of its content?`;
		let choiceConfirm = `Yes, I really want to DELETE ALL FILES in ${item.IsCategory?"category":"project"} "${item.Name}"`;
		let choiceCancel = "Cancel";

		let choice = await window.showQuickPick(
			[choiceCancel, choiceConfirm],
			{canPickMany: false, placeHolder: question}
		);

		if(choice !== choiceConfirm) return;

		try{
			await Utils.DeletePath(item.Path, {recursive: true, useTrash: true});
		}catch(e){
			window.showErrorMessage(`Cannot delete ${item.Name}. ${e.toString()}`);
		}

		RepositoryView.Refresh();
	}
}
