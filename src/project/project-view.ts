import { window, TreeView, TreeDataProvider, Event, EventEmitter, TreeItem, ThemeIcon } from "vscode";

/**
 * Seznam dostupných akcí
 */
class ProjectViewDataProvider implements TreeDataProvider<TreeItem>{
    private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
    readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

    public Refresh(){
        this._onDidChangeTreeData.fire();
    }

    public async getChildren(element: TreeItem | undefined): Promise<TreeItem[]>{
        if(element) return [];

        return [
            {
                label: "Remote build",
                iconPath: new ThemeIcon("gear"),
                tooltip: "Build project using remote build server",
                command: {
                    command: "fitkit.project.remoteBuild",
                    title: "Remote build"
                }
            },
            {
                label: "Remote simulation (ISIM)",
                iconPath: new ThemeIcon("debug"),
                tooltip: "Open remote ISIM session",
                command: {
                    command: "fitkit.project.remoteIsim",
                    title: "Remote simulation (ISIM)"
                }
            },
            {
                label: "Flash",
                iconPath: new ThemeIcon("zap"),
                tooltip: "Flash last build to FITkit",
                command: {
                    command: "fitkit.project.flash",
                    title: "Flash"
                }
            },
            {
                label: "Run (open terminal)",
                iconPath: new ThemeIcon("play"),
                tooltip: "Open terminal connection with FITkit",
                command: {
                    command: "fitkit.project.openTerminal",
                    title: "Run (open terminal)"
                }
            },
            {
                label: "Flash and Run",
                iconPath: new ThemeIcon("rocket"),
                tooltip: "Flash last build to fitkit and open terminal",
                command: {
                    command: "fitkit.project.flashAndRun",
                    title: "Flash and Run"
                }
            }
        ];
    }

    public getTreeItem(item: TreeItem): TreeItem{
        return item;
    }
}

/**
 * Panel zobrazující dostupné akce, které je možno nad projektem vykonávat
 */
export class ProjectView{
    private TreeView?: TreeView<TreeItem>;
    private DataProvider?: ProjectViewDataProvider;

    public constructor(){
        this.DataProvider = new ProjectViewDataProvider();

        this.TreeView = window.createTreeView("fitkit.projectView", {
            treeDataProvider: this.DataProvider,
            canSelectMany: false,
            showCollapseAll: false
        });
    }
}
