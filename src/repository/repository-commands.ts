import { defaultMCUFile, defaultTopVHDLFile, defaultTestBench, defaultIsimScript } from './default-project-files';
import { ConfigParser } from '../common/config-parser';
import { Utils } from '../common/utils';
import { env, Uri, commands, window } from "vscode";
import { Repository } from "./repository";
import { TreeChild, RepositoryView } from "./repository-view";
import * as path from "path";
import latinize = require('latinize');

export class RepositoryCommands{
    constructor(){
        commands.registerCommand("fitkit.repository.openRootInOS", () => this.openRootInOS());
        commands.registerCommand("fitkit.repository.openFolderInOS", (i) => this.openFolderInOS(i));
        commands.registerCommand("fitkit.repository.openProject", (i, j) => this.openProject(i, j));
        commands.registerCommand("fitkit.repository.openProjectSameWindow", i => this.openProjectSameWindow(i));
        commands.registerCommand("fitkit.repository.refreshView", () => this.refreshView());
        commands.registerCommand("fitkit.repository.deleteFolder", (i) => this.deleteFolder(i));
        commands.registerCommand("fitkit.repository.download", () => this.download());
        commands.registerCommand("fitkit.repository.redownload", () => this.download());
        commands.registerCommand("fitkit.repository.rename", (i) => this.rename(i));
        commands.registerCommand("fitkit.repository.newCategory", (i) => this.newCategory(i));
        commands.registerCommand("fitkit.repository.createProject", (i) => this.createProject(i));
    }

    private openRootInOS(){
        env.openExternal(Uri.file(Repository.folder.root));
    }

    private openFolderInOS(item: TreeChild){
        env.openExternal(Uri.file(item.path));
    }

    private openProject(item: TreeChild, requireDoubleClick: boolean = false){
        if(item.isCategory) return;
        if(requireDoubleClick && !Utils.doubleClickCheck(item)) return;

        commands.executeCommand("vscode.openFolder", Uri.file(item.path), true);
    }

    private openProjectSameWindow(item: TreeChild){
        if(item.isCategory) return;

        commands.executeCommand("vscode.openFolder", Uri.file(item.path));
    }

    private refreshView(){
        RepositoryView.Refresh();
    }

    private async download(){
        await Repository.download();
        RepositoryView.Refresh();
    }

    private async newCategory(item?: TreeChild){
        item = item ?? {
            isCategory: true,
            path: Repository.folder.apps,
            name: "root folder"
        };

        let name = await window.showInputBox({
            prompt: `(1/2) Enter category name. This category will be created in ${item.name}.`,
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

        await Utils.createDirectory(path.join(item.path, folder));
        await Utils.writeFile(path.join(item.path, folder, "description.xml"), ConfigParser.toXml({
            category: {name: name}
        }));

        RepositoryView.Refresh();
    }

    private async createProject(item?: TreeChild){
        item = item ?? {
            isCategory: true,
            path: Repository.folder.apps,
            name: "root folder"
        };

        let name = await window.showInputBox({
            prompt: `(1/4) Enter project name. This project will be created in ${item.name}.`,
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
            value: await Utils.getUserFullname()
        });

        author = author?.trim();
        if(!author || author.length === 0) return;

        let desc = await window.showInputBox({
            prompt: `(4/4) Enter project description (optional).`
        });

        if(desc === undefined) return;
        desc = desc.trim();

        // Vytvořit výchozí strukturu projektu
        await Utils.createDirectory(path.join(item.path, folder, "mcu"));
        await Utils.createDirectory(path.join(item.path, folder, "fpga"));
        await Utils.createDirectory(path.join(item.path, folder, "fpga", "sim"));
        await Utils.writeFile(path.join(item.path, folder, "project.xml"), ConfigParser.toXml({
            project: {
                name: name,
                author: author,
                description: desc,
                revision: Utils.getRevisionString(),
                fpga: {
                    _dcmfrequency: "20MHz",
                    _architecture: "gp",
                    file: ["top.vhd", {$: "fpga/sim/tb.vhd", _context: "sim"}]
                },
                mcu: {file: "main.c"}
            }
        }));
        await Utils.writeFile(path.join(item.path, folder, "mcu", "main.c"), defaultMCUFile);
        await Utils.writeFile(path.join(item.path, folder, "fpga", "top.vhd"), defaultTopVHDLFile);
        await Utils.writeFile(path.join(item.path, folder, "fpga", "sim", "tb.vhd"), defaultTestBench);
        await Utils.writeFile(path.join(item.path, folder, "fpga", "sim", "isim.tcl"), defaultIsimScript);

        this.openProject({isCategory: false, name: name, path: path.join(item.path, folder)});
    }

    private async rename(item: TreeChild){
        if(!item.isCategory) return;
        let configPath = path.join(item.path, "description.xml");

        try{
            let config = await ConfigParser.categoryXml(configPath);

            let newName = await window.showInputBox({
                value: item.name,
                prompt: `Enter new name for the "${item.name}" category.`,
                placeHolder: "New name (e.g. \"Media\")"
            });

            newName = newName?.trim();
            if(!newName || newName.length === 0) return;
            config.category.name = newName;

            await Utils.writeFile(configPath, ConfigParser.toXml(config));
            RepositoryView.Refresh();
        }catch(e){
            window.showErrorMessage("Failed to rename category. " + e.toString());
        }

    }

    private async deleteFolder(item: TreeChild){
        let question = `Do you really want to DELETE this ${item.isCategory?"category":"project"} and all of its content?`;
        let choiceConfirm = `Yes, I really want to DELETE ALL FILES in ${item.isCategory?"category":"project"} "${item.name}"`;
        let choiceCancel = "Cancel";

        let choice = await window.showQuickPick(
            [choiceCancel, choiceConfirm],
            {canPickMany: false, placeHolder: question}
        );

        if(choice !== choiceConfirm) return;

        try{
            await Utils.deletePath(item.path, {recursive: true, useTrash: true});
        }catch(e){
            window.showErrorMessage(`Cannot delete ${item.name}. ${e.toString()}`);
        }

        RepositoryView.Refresh();
    }
}
