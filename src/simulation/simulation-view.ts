import { WebviewPanel, Disposable, window, ViewColumn, EventEmitter } from "vscode";

/**
 * Třída zastřešující WebView pro zobrazení Simulace (pomocí noVNC)
 */
export class SimulationView{
    private static opened: SimulationView | undefined;

    private onDidCloseEmitter = new EventEmitter<void>();
    public readonly onDidClose = this.onDidCloseEmitter.event;

    private readonly panel: WebviewPanel;
    private disposables: Disposable[] = [];

    public constructor(remoteUrl: string){
        if (SimulationView.opened) {
            SimulationView.opened.dispose();
        }

        this.panel = window.createWebviewPanel(
            "isim",
            "Remote ISIM",
            ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.html = this.generateHTML(remoteUrl);
        SimulationView.opened = this;
    }

    /**
     * Otevřít existující panel se simulací
     */
    public show(){
        this.panel.reveal();
    }

    /**
     * Uzavřít a uklidit využité zdroje panelu simulace
     */
    public dispose(){
        SimulationView.opened = undefined;

        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.onDidCloseEmitter.fire();
    }

    /**
     * Vygenerovat HTML pro zobrazení v panelu.
     *
     * V panelu nelze přímo navigovat na URL, proto tato metoda vygeneruje
     * stránku, která zobryzí cílovou URL v rámci přes celý dostupný prostor
     * @param remoteUrl
     */
    private generateHTML(remoteUrl: string): string{
        return `<!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="initial-scale=1">
                    <style>
                        body,iframe{width:100vw; height:100vh; overflow:hidden; background:#000;}
                        iframe{position: absolute; left:0; top:0; border:none;}
                    </style>
                </head>
                <body>
                    <iframe src="${remoteUrl}"></iframe>
                </body>
            </html>`;
    }
}
