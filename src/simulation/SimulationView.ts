import { WebviewPanel, Disposable, window, ViewColumn, EventEmitter } from "vscode";

/**
 * Třída zastřešující WebView pro zobrazení Simulace (pomocí noVNC)
 */
export class SimulationView{
	private static Opened: SimulationView | undefined;

	private onDidCloseEmitter = new EventEmitter<void>();
	public readonly onDidClose = this.onDidCloseEmitter.event;

	private readonly Panel: WebviewPanel;
	private Disposables: Disposable[] = [];

	public constructor(remoteUrl: string){
		if (SimulationView.Opened) {
			SimulationView.Opened.Dispose();
		}

		this.Panel = window.createWebviewPanel(
			"isim",
			"Remote ISIM",
			ViewColumn.Active,
			{ enableScripts: true, retainContextWhenHidden: true }
		);

		this.Panel.onDidDispose(() => this.Dispose(), null, this.Disposables);
		this.Panel.webview.html = this.GenerateHTML(remoteUrl);
		SimulationView.Opened = this;
	}

	/**
	 * Otevřít existující panel se simulací
	 */
	public Show(){
		this.Panel.reveal();
	}

	/**
	 * Uzavřít a uklidit využité zdroje panelu simulace
	 */
	public Dispose(){
		SimulationView.Opened = undefined;

		this.Panel.dispose();
		this.Disposables.forEach(d => d.dispose());
		this.Disposables = [];
		this.onDidCloseEmitter.fire();
	}

	/**
	 * Vygenerovat HTML pro zobrazení v panelu.
	 *
	 * V panelu nelze přímo navigovat na URL, proto tato metoda vygeneruje
	 * stránku, která zobryzí cílovou URL v rámci přes celý dostupný prostor
	 * @param remoteUrl
	 */
	private GenerateHTML(remoteUrl: string): string{
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
