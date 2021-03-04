import { RepositoryCommands } from './repository-commands';
import { RepositoryView } from './repository-view';
import { Utils } from '../common/utils';
import { ExtensionConfig } from '../extension-config';
import { window, ProgressLocation, Progress } from "vscode";
import * as unzipper from "unzipper";
import * as path from "path";
import * as request from "request-promise-native";

/**
 * Absolutní cesty k důležitým adresářům repositáře
 */
interface RepositoryFolders{
    /** Kořenový adresář repositáře */
    root: string;

    /** Adresář projektů */
    apps: string;

    /** Adresář základních souborů nutných k překladu */
    base: string;

    /** Adresář souborů knihovny pro FPGA */
    libFpga: string;

    /** Adresář souborů knihovny pro MCU */
    libMcu: string;
}

/**
 * Rozhraní pro práci s repositářem
 */
export class Repository{
    private static _folder: RepositoryFolders;
    private static _lastExists: boolean = false;

    private static get lastExists(): boolean {
        return this._lastExists;
    }

    private static set lastExists(val: boolean) {
        this._lastExists = val;
        this.onExistsChangeCallbacks.forEach(callback => {
            callback(val);
        });
    }

    private static onExistsChangeCallbacks: ((exists: boolean) => void)[] = [];

    public static onExistChange(callback: (exists: boolean) => void){
        this.onExistsChangeCallbacks.push(callback);
    }

    /**
      * Absolutní cesty k důležitým adresářům repositáře
      */
    public static get folder() : RepositoryFolders {
        if(!this._folder){
            this._folder = {
                root: ExtensionConfig.repositoryPath,
                apps: path.join(ExtensionConfig.repositoryPath, "apps"),
                base: path.join(ExtensionConfig.repositoryPath, "base"),
                libFpga: path.join(ExtensionConfig.repositoryPath, "fpga"),
                libMcu: path.join(ExtensionConfig.repositoryPath, "mcu"),
            };
        }

        return this._folder;
    }

    public static async init(){
        new RepositoryView();
        new RepositoryCommands();

        if(await this.exists()) return;

        let res = await window.showWarningMessage(
            `FITkit repository was not found
            (configured repository path: ${this.folder.root})`,
            "Download repository"
        );

        if(typeof res === "string") this.download();
    }

    /**
     * Proces pro stažení a extrahování složky repositáře
     *
     * @param progress Třída pro hlášení aktuálního stavu procesu
     */
    private static async downloadProcess(progress: Progress<{message: string}>){
        progress.report({message: "Downloading archive..."});

        let zipFile: Buffer = await request(ExtensionConfig.repositoryUrl, {
            encoding: null
        });

        // TODO Do budoucna - Přepsat extrakci pro podporu FS API ve VSCode
        // Není zas tak důležitý
        progress.report({message: "Extracting archive..."});
        let zip = await unzipper.Open.buffer(zipFile);

        await zip.extract({path: this.folder.root});
    }

    /**
     * Stáhne a extrahuje složku repositáře
     */
    public static async download(): Promise<boolean>{
        try{
            await window.withProgress({
                location: ProgressLocation.Notification,
                title: "FITkit repository",
                cancellable: false
            }, (progress) => this.downloadProcess(progress));

            window.showInformationMessage(`FITkit repository successfully downloaded.`);
        }catch(e){
            window.showErrorMessage(`Failed to download repository from ${ExtensionConfig.repositoryUrl}. ${e}`);
            return false;
        }

        return this.exists();
    }

    /**
     * Kontrola, zda existuje lokální adresář repositáře
     */
    public static async exists(): Promise<boolean>{
        let exists = await Utils.directoryExists(this.folder.root)
            && await Utils.directoryExists(this.folder.apps)
            && await Utils.directoryExists(this.folder.base)
            && await Utils.directoryExists(this.folder.libFpga)
            && await Utils.directoryExists(this.folder.libMcu);

        if(this.lastExists !== exists) this.lastExists = exists;

        return exists;
    }
}
