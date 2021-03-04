import { Utils } from './utils';
import { assertType } from "typescript-is";
import { Uri } from 'vscode';
import { parse, j2xParser, X2jOptions } from "fast-xml-parser";
import { CategoryConfigXml } from '../models/category-config-xml';
import { ProjectConfigXml, ProjectConfig } from '../models/project-config-xml';

/**
 * Třída obsahující metody pro získání dat konfiguračních souborů z FITkit repositáře
 */
export class ConfigParser{
    /**
     * Převede XML data na JSON
     * @see https://github.com/NaturalIntelligence/fast-xml-parser
     *
     * @param xml Řetězec obsahující XML data
     * @param options Dodatečné argumenty XML parsování
     */
    private static parseXml(xml: string, options?: Partial<X2jOptions>): any{
        return parse(xml, {
            attributeNamePrefix: "_",
            ignoreAttributes: false,
            parseAttributeValue: false,
            parseNodeValue: false,
            textNodeName: "$",
            ...options
        });
    }

    private static JsonParser = new j2xParser({
        attributeNamePrefix: "_",
        ignoreAttributes: false,
        textNodeName: "$",
        format: true,
        indentBy: "    "
    });

    /**
     * Načte, verifikuje a vrátí data konfiguračního souboru popisující projekt.
     * Pokud se nepodaří verifikovat data XML souboru, skončí výjimkou.
     *
     * @param path Cesta ke konfiguračnímu XML souboru projektu
     */
    public static async projectXml(path: Uri | string): Promise<ProjectConfig>{
        let parsedXml = this.parseXml(await Utils.readTextFile(path), {
            stopNodes: ["fpga"]
        });

        let project = parsedXml?.project ?? parsedXml?.package ?? parsedXml?.library;

        if(typeof project?.fpga === "string"){
            project.fpga = {$: project.fpga};
        }

        if(project?.fpga?.$){
            let files = this.parseXml(`<fpga>${project.fpga.$}</fpga>`, {
                preserveOrder: true
            });

            project.fpga = {...project.fpga, ...files?.fpga};
            delete project.fpga.$;
        }

        try{
            assertType<ProjectConfigXml>(parsedXml);
            let config: ProjectConfigXml = parsedXml;
            if(config.project) return {...config.project, type: "project"};
            if(config.package) return {...config.package, type: "package"};
            if(config.library) return {...config.library, type: "library"};
            throw new Error("Incorrect XML config root node");
        }catch(e){
            if(typeof path !== "string") path = path.fsPath;
            throw new Error(`Error while parsing XML project config "${path}"\n${(<Error>e).message}`);
        }
    }

    /**
     * Načte, verifikuje a vrátí data konfiguračního souboru popisující kategorii.
     * Pokud se nepodaří verifikovat data XML souboru, skončí výjimkou.
     *
     * @param path Cesta ke konfiguračnímu XML souboru kategorie
     */
    public static async categoryXml(path: Uri | string): Promise<CategoryConfigXml>{
        let config = this.parseXml(await Utils.readTextFile(path));
        assertType<CategoryConfigXml>(config);
        return config;
    }

    /**
     * Serializuje objekt na XML řetězec
     *
     * @param config Objekt reprezentující kategorii nebo FITkit projekt
     */
    public static toXml(config: CategoryConfigXml | ProjectConfigXml): string{
        let res = this.JsonParser.parse(config);
        if(typeof res !== "string")
            throw new Error("Failed to create XML from JSON");

        return `<?xml version="1.0" encoding="utf-8"?>\n${res}`;
    }
}
