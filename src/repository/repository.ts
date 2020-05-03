import { RepositoryCommands } from './repositoryCommands';
import { RepositoryView } from './repositoryView';
import { Utils } from '../common/Utils';
import { ExtensionConfig } from '../ExtensionConfig';
import { window, ProgressLocation, Progress } from "vscode";
import * as unzipper from "unzipper";
import * as path from "path";
import * as request from "request-promise-native";

/**
 * Absolutní cesty k důležitým adresářům repozitáře
 */
interface RepositoryFolders{
	/** Kořenový adresář repozitáře */
	Root: string;

	/** Adresář projektů */
	Apps: string;

	/** Adresář základních souborů nutných k překladu */
	Base: string;

	/** Adresář souborů knihovny pro FPGA */
	LibFpga: string;

	/** Adresář souborů knihovny pro MCU */
	LibMcu: string;
}

/**
 * Rozhraní pro práci s repozitářem
 */
export class Repository{
	private static _Folder: RepositoryFolders;
	private static _LastExists: boolean = false;

	private static get LastExists(): boolean {
		return this._LastExists;
	}

	private static set LastExists(val: boolean) {
		this._LastExists = val;
		this.OnExistsChangeCallbacks.forEach(callback => {
			callback(val);
		});
	}

	private static OnExistsChangeCallbacks: ((exists: boolean) => void)[] = [];

	public static OnExistChange(callback: (exists: boolean) => void){
		this.OnExistsChangeCallbacks.push(callback);
	}

	/**
 	 * Absolutní cesty k důležitým adresářům repozitáře
 	 */
	public static get Folder() : RepositoryFolders {
		if(!this._Folder){
			this._Folder = {
				Root: ExtensionConfig.RepositoryPath,
				Apps: path.join(ExtensionConfig.RepositoryPath, "apps"),
				Base: path.join(ExtensionConfig.RepositoryPath, "base"),
				LibFpga: path.join(ExtensionConfig.RepositoryPath, "fpga"),
				LibMcu: path.join(ExtensionConfig.RepositoryPath, "mcu"),
			};
		}

		return this._Folder;
	}

	public static async Init(){
		new RepositoryView();
		new RepositoryCommands();

		if(await this.Exists()) return;

		let res = await window.showWarningMessage(
			`FITkit repository was not found
			(configured repository path: ${this.Folder.Root})`,
			"Download repository"
		);

		if(typeof res === "string") this.Download();
	}

	/**
	 * Proces pro stažení a extrahování složky repozitáře
	 *
	 * @param progress Třída pro hlášení aktuálního stavu procesu
	 */
	private static async DownloadProcess(progress: Progress<{message: string}>){
		progress.report({message: "Downloading archive..."});

		let zipFile: Buffer = await request(ExtensionConfig.RepositoryUrl, {
			encoding: null
		});

		// TODO Do budoucna - Přepsat extrakci pro podporu FS API ve VSCode
		progress.report({message: "Extracting archive..."});
		let zip = await unzipper.Open.buffer(zipFile);

		await zip.extract({path: this.Folder.Root});
	}

	/**
	 * Stáhne a extrahuje složku repozitáře
	 */
	public static async Download(): Promise<boolean>{
		try{
			await window.withProgress({
				location: ProgressLocation.Notification,
				title: "FITkit repository",
				cancellable: false
			}, (progress) => this.DownloadProcess(progress));

			window.showInformationMessage(`FITkit repository succesfully downloaded.`);
		}catch(e){
			window.showErrorMessage(`Failed to download repository from ${ExtensionConfig.RepositoryUrl}. ${e}`);
			return false;
		}

		return this.Exists();
	}

	/**
	 * Kontrola, zda existuje lokální adresář repozitáře
	 */
	public static async Exists(): Promise<boolean>{
		let exists = await Utils.DirectoryExists(this.Folder.Root)
			&& await Utils.DirectoryExists(this.Folder.Apps)
			&& await Utils.DirectoryExists(this.Folder.Base)
			&& await Utils.DirectoryExists(this.Folder.LibFpga)
			&& await Utils.DirectoryExists(this.Folder.LibMcu);

		if(this.LastExists !== exists) this.LastExists = exists;

		return exists;
	}
}
