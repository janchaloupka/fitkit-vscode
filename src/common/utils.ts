import { FileType, FileStat } from 'vscode';
import { TextEncoder, TextDecoder } from 'util';
import { workspace } from 'vscode';
import { Uri } from 'vscode';
import * as moment from "moment";
import * as path from "path";
import * as crypto from "crypto";
import { Moment } from "moment";
import fullname = require('fullname');

/**
 * Singleton třída různých utilit
 */
export class Utils{
    private static doubleClickLastTime: number = 0;
    private static doubleClickLastId: any;

    /**
     * Kontrola, zda se jedná o dvojklik
     *
     * Použití:
     * Metoda se zavolá po každém kliknutí a pokud následovali dva kliky rychle
     * za sebou, jedná se o dvojklik
     *
     * @param id Identifikace položky u které se klik kontroluje
     */
    public static doubleClickCheck(id: any): boolean{
        let time = Date.now();
        let isValid =
            (time - this.doubleClickLastTime) < 800 &&
            id === this.doubleClickLastId;

        this.doubleClickLastId = id;
        this.doubleClickLastTime = time;

        return isValid;
    }

    /**
     * Vygeneruje řetězec revize podle specifikace pro project.xml
     *
     * @param date Datum vůči kterému se má řetězec vygenerovat (výchozí = teď)
     */
    public static getRevisionString(date: Moment = moment()): string{
        return date.format("YYYYMMDD");
    }

    /**
     * Zapíše data do souboru (přepíše stávající data, pokud soubor existuje)
     *
     * Pokud je obsah řetězce, použije se kódování UTF-8
     *
     * @param path cesta k souboru
     * @param content Obsah souboru
     */
    public static async writeFile(path: Uri | string, content: Uint8Array | string){
        if(typeof path === "string") path = Uri.file(path);
        if(typeof content === "string") content = new TextEncoder().encode(content);

        return workspace.fs.writeFile(path, content);
    }

    /**
     * Přečte a vrátí binární obsah souboru
     *
     * @param path Cesta k souboru
     */
    public static async readFile(path: Uri | string): Promise<Uint8Array>{
        if(typeof path === "string") path = Uri.file(path);

        return workspace.fs.readFile(path);
    }

    /**
     * Přečte a vrátí celý obsah textového souboru
     *
     * @param path Cesta k souboru
     * @param encoding V jakém kódváním je soubor uložen (výchozí utf-8)
     */
    public static async readTextFile(path: Uri | string, encoding: string = "utf-8"): Promise<string>{
        let data = await this.readFile(path);
        return new TextDecoder(encoding).decode(data);
    }

    /**
     * Vrátí obsah složky
     *
     * @param path Cesta ke složce
     */
    public static async readDirectory(path: Uri | string): Promise<[string, FileType][]>{
        if(typeof path === "string") path = Uri.file(path);

        return workspace.fs.readDirectory(path);
    }

    /**
     * Smaže soubor nebo složku
     *
     * @param path Cesta k souboru nebo složce
     * @param options Další možnosti mazaní (rekurzivní mazání složky nebo zda použít systémový koš)
     */
    public static async deletePath(path: Uri | string, options?: {recursive?: boolean, useTrash?: boolean}){
        if(typeof path === "string") path = Uri.file(path);

        return workspace.fs.delete(path, options);
    }

    /**
     * Vytvořit nový adresář
     *
     * @param path Cesta nově vytvořeného adresáře
     */
    public static async createDirectory(path: Uri | string){
        if(typeof path === "string") path = Uri.file(path);

        return workspace.fs.createDirectory(path);
    }

    /**
     * Získat detaily o souboru nebo složce
     *
     * @param path Systémová cesta
     */
    public static async getPathStat(path: Uri | string): Promise<FileStat>{
        if(typeof path === "string") path = Uri.file(path);

        return workspace.fs.stat(path);
    }

    /**
     * Kontrola, zda existuje soubor
     *
     * @param path Cesta k souboru
     */
    public static async fileExists(path: Uri | string): Promise<boolean>{
        try{
            return (await this.getPathStat(path)).type === FileType.File;
        }catch(e){
            return false;
        }
    }

    /**
     * Kontrola, zda složka existuje
     *
     * @param path Cesta ke složce
     */
    public static async directoryExists(path: Uri | string): Promise<boolean>{
        try{
            return (await this.getPathStat(path)).type === FileType.Directory;
        }catch(e){
            return false;
        }
    }

    /**
     * Vrátí, zda `subpath` je podcestou cesty `parent`
     *
     * @example IsSubpath("/var", "/var/WWW/index.html") -> true
     * @example IsSubpath("/var/log", "/var/WWW/index.html") -> false
     *
     * @param parent Hlavní cesta vůči které se podcesta kontroluje
     * @param subpath Cesta pro kontrolu
     */
    public static isSubpath(parent: Uri | string, subpath: Uri | string): boolean{
        if(typeof parent !== "string") parent = parent.fsPath;
        if(typeof subpath !== "string") subpath = subpath.fsPath;

        const relative = path.relative(parent, subpath);
        return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    /**
     * Pokusit se získat jméno právě přihlášeného uživatele
     */
    public static async getUserFullname(): Promise<string | undefined>{
        try{
            return await fullname();
        }catch(e){
            return undefined;
        }
    }

    private static sha1Algo = crypto.createHash("sha1");

    /**
     * Vytvořit SHA1 hash
     *
     * @param data Data k vytvoření hashe
     */
    public static hashSha1(data: any): string{
        return this.sha1Algo.update(data).digest("base64");
    }
}
