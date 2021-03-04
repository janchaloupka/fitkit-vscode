import { ProjectMcuData, ProjectFpgaData } from './../models/project-data.d';
import { ProjectConfig, FpgaOrderedSource } from '../models/project-config-xml';
import { Repository } from '../repository/repository';
import { Utils } from '../common/utils';
import { File, ProjectData } from '../models/project-data';
import { ConfigParser } from '../common/config-parser';
import { Uri, FileType } from "vscode";
import * as path from "path";

/**
 * Cesty k souborům mohou být relativní nebo absolutní. Při zadávání
 * relativních cest platí následující pravidlo:
 *
 * 1) Nejprve se prohledává vzhledem k adresáři s projektem
 * 2) Poté vzhledem k podadresáři mcu/fpga
 * 3) Nakonec vzhledem ke kořenovému adresáři SVN stromu
 *
 * @param file Absolutní nebo relativní cesta k souboru
 * @param subdir Podadresář zdrojových souborů (typicky "mcu" nebo "fpga")
 */
async function fileAbsolutePath(file: string, projectRoot: string, subdir: string): Promise<string>{
    if(path.isAbsolute(file)) return file;

    let relativeToProject = path.join(projectRoot, file);
    if(await Utils.fileExists(relativeToProject))
        return relativeToProject;

    let relativeToSubdir = path.join(projectRoot, subdir, file);
    if(await Utils.fileExists(relativeToSubdir))
        return relativeToSubdir;

    let relativeToRepository = path.join(Repository.folder.root, file);
    if(await Utils.fileExists(relativeToRepository))
        return relativeToRepository;

    throw new Error(`File "${file}" was not found relative to project root ("${projectRoot}"), ${subdir} subdirectory or repository root`);
}

/**
 * Vyhledá a načte soubor za pomoci metody `FileAbsolutePath`.
 * Vrátí data a cestu k souboru ve struktuře, kterou je možné použít při
 * sestavování objektu obsahující projektová data
 *
 * @param path Relativní nebo absolutní cesta k souboru
 * @param projectRoot Absolutní cesta k projektu
 * @param subdir Podadresář zdrojových souborů (typicky "mcu" nebo "fpga")
 */
async function getFileData(path: string, projectRoot: string, subdir: string): Promise<File>{
    path = await fileAbsolutePath(path, projectRoot, subdir);

    return {
        path: path,
        content: (new Buffer(await Utils.readFile(path))).toString("base64"),
        binary: true
    };
}

/**
 * Pokud projekt specifikuje architekturu, přidá XML konfigurační soubor
 * do seznamu závislostí
 * @param project Data popisující aktuálně parsovaný projekt
 */
function appendArchitectureXml(project: ProjectConfig){
    let arch = project.fpga?._architecture ?? "bare";
    if(arch === "none") return;
    let archXml = path.join(Repository.folder.libFpga, "chips", `architecture_${arch}`, "package.xml");

    let fpga = project.fpga ?? {};

    if(fpga["#ordered"]){
        fpga["#ordered"].unshift({
            include: archXml
        });
        return;
    }

    if(!fpga.include){
        fpga.include = archXml;
        return;
    }

    if(!(fpga.include instanceof Array)){
        fpga.include = [fpga.include];
    }

    fpga.include.push(archXml);
}

/**
 * Položka zásobníku závislostí čekající na zpracování
 */
interface ConfigStackItem extends ProjectConfig{
    root: string;
}

/**
 * Načte všechny potřebné MCU soubory, které jsou specifikovány ve všech
 * linkovaných project.xml
 *
 * @param request Cílový objekt, kam se vloží všechny načtené soubory
 * @param project Konfigurace aktuálního projektu
 * @param projectRoot Absolutní cesta ke kořenu projektu
 */
async function appendMcuFiles(request: ProjectMcuData, project: ProjectConfig, projectRoot: string){
    let configs: ConfigStackItem[] = [
        {...project, root: projectRoot}
    ];

    while(configs.length > 0){
        let mcu = configs[0].mcu ?? {};

        if(mcu.include){
            if(!(mcu.include instanceof Array)) mcu.include = [mcu.include];
            if (mcu.include.length > 0) {
                let includePath = await fileAbsolutePath(mcu.include[0], configs[0].root, "mcu");
                let includeXml = await ConfigParser.projectXml(includePath);
                configs.unshift({...includeXml, root: path.dirname(includePath)});
                mcu.include.shift();
                continue;
            }
        }

        if(!mcu.file) mcu.file = [];
        if(!(mcu.file instanceof Array)) mcu.file = [mcu.file];

        if(mcu.files){
            if(!(mcu.files instanceof Array)) mcu.files = [mcu.files];
            for (const files of mcu.files) {
                if(typeof files === "string"){
                    mcu.file.push(...files.match(/\S+/g) ?? []);
                }else{
                    for (const file of files.$.match(/\S+/g) ?? []) {
                        mcu.file.push({
                            $: file,
                            _location: files._location
                        });
                    }
                }
            }
        }

        // Definice hlavičkových souborů nemá v aktuální implementaci využití
        /*if(mcu.headerfile){
            if(!(mcu.headerfile instanceof Array)) mcu.headerfile = [mcu.headerfile];
            for (const header of mcu.headerfile) {
                if(typeof header === "string"){
                    request.mcuHeaderFiles.push(await GetFileData(header, configs[0].root, "mcu"));
                }else{
                    request.mcuHeaderFiles.push(await GetFileData(header.$, configs[0].root, "mcu"));
                }
            }
        }*/

        for (const file of mcu.file) {
            if(typeof file === "string"){
                request.files.push(await getFileData(file, configs[0].root, "mcu"));
            }else{
                request.files.push(await getFileData(file.$, configs[0].root, "mcu"));
            }
        }

        configs.shift();
    }
}

/**
 * Načte všechny potřebné FPGA soubory, které jsou specifikovány ve všech
 * linkovaných project.xml. soubory jsou načtené ve správném pořadí, přesně tak,
 * jak jsou definovány v konfiguračních souborech
 *
 * @param request Cílový objekt, kam se vloží všechny načtené soubory
 * @param project Konfigurace aktuálního projektu
 * @param projectRoot Absolutní cesta ke kořenu projektu
 */
async function appendFpgaFiles(request: ProjectFpgaData, project: ProjectConfig, projectRoot: string){
    let fpga = project.fpga ?? {};
    let sources: FpgaOrderedSource[] = [];

    if(fpga.include){
        if(!(fpga.include instanceof Array)) fpga.include = [fpga.include];
        for (const include of fpga.include) sources.push({include: include});
    }

    if(fpga.file){
        if(!(fpga.file instanceof Array)) fpga.file = [fpga.file];
        for (const file of fpga.file) sources.push({file: file});
    }

    if(fpga.files){
        if(!(fpga.files instanceof Array)) fpga.files = [fpga.files];
        for (const files of fpga.files) sources.push({files: files});
    }

    if(fpga["#ordered"]){
        sources.push(...fpga["#ordered"]);
    }

    for (const source of sources) {
        if(source.include){
            let xmlPath = await fileAbsolutePath(source.include, projectRoot, "fpga");
            await appendFpgaFiles(request, await ConfigParser.projectXml(xmlPath), path.dirname(xmlPath));
        }else if(source.files){
            if(typeof source.files === "string"){
                for (const file of source.files.match(/\S+/g) ?? []) {
                    request.files.push({
                        ...(await getFileData(file, projectRoot, "fpga")),
                        simOnly: false
                    });
                }
            }else{
                for (const file of source.files.$.match(/\S+/g) ?? []) {
                    request.files.push({
                        ...(await getFileData(file, projectRoot, "fpga")),
                        simOnly: source.files._context === "sim",
                        library: source.files._library
                    });
                }
            }
        }else if(source.file){
            if(typeof source.file === "string"){
                request.files.push({
                    ...(await getFileData(source.file, projectRoot, "fpga")),
                    simOnly: false
                });
            }else{
                request.files.push({
                    ...(await getFileData(source.file.$, projectRoot, "fpga")),
                    simOnly: source.file._context === "sim",
                    library: source.file._library
                });
            }
        }
    }
}

/**
 * Třída implementující parsování konfiguračního souboru projektu a získání dat
 * za všech zdrojových a ostatních souborů potřebné pro kompilaci
 */
export class ProjectDataBuilder{
    public projectPath: string;
    public projectXmlPath: string;

    /** Cesta k výchozímu UCF souboru */
    private static defaultUcfFile = path.join(
        Repository.folder.libFpga, "chips", "fpga_xc3s50.ucf");

    constructor(projectPath: Uri | string, projectXml: string = "project.xml"){
        this.projectPath = typeof projectPath === "string" ? projectPath : projectPath.fsPath;
        this.projectXmlPath = path.join(this.projectPath, projectXml);
    }

    /**
     * Vytvořit objekt se všemi potřebnými daty pro překlad tohoto projektu
     */
    public async create(): Promise<ProjectData>{
        let mcuProjectRoot = this.projectPath;
        let fpgaProjectRoot = this.projectPath;
        let project = await ConfigParser.projectXml(this.projectXmlPath);

        while(project.fpga?._use){
            // Použít FPGA část odkazovaného projektu
            let useProjectPath = await fileAbsolutePath(project.fpga._use, this.projectPath, "fpga");
            let useProject = await ConfigParser.projectXml(useProjectPath);
            project.fpga = useProject.fpga;
            fpgaProjectRoot = path.dirname(useProjectPath);
        }

        // Základní kostra dat projektu
        let fpgaData: ProjectFpgaData = {
            usesArchitecture: (project.fpga?._architecture) !== "none",
            dcmFrequency: project.fpga?._dcmfrequency ?? "25MHz",
            topLevelEntity: project.fpga?._toplevelentity ?? "fpga",
            chip: project.fpga?._fpgachip ?? "xc3s50-4-pq208",
            optimization: project.fpga?._optimization ?? "speed:1",
            library: project.fpga?._library ?? "work",
            ucfFile: await getFileData(project.fpga?._ucffile ?? ProjectDataBuilder.defaultUcfFile, this.projectPath, "fpga"),
            files: []
        };

        let mcuData: ProjectMcuData = {
            useMathLib: project.mcu?._mathlibrary === "yes",
            files: [],
            headers: []
        };

        let data: ProjectData = {
            mcu: mcuData,
            fpga: fpgaData
        };

        // Načtení konfiguračního souboru ISIM
        try{
            const isimFile = path.join(this.projectPath, "fpga", "sim", "isim.tcl");
            fpgaData.isimFile = {
                path: isimFile,
                content: (new Buffer(await Utils.readFile(isimFile))).toString("base64"),
                binary: true
            };
        }catch(e){
            console.log("Project does not contain ISIM configuration file");
        }

        // Načíst všechny potřebné zdrojové soubory
        appendArchitectureXml(project);
        await appendFpgaFiles(fpgaData, project, fpgaProjectRoot);
        await appendMcuFiles(mcuData, project, mcuProjectRoot);

        // Přidat soubory simulace (testbench soubory)
        const simPath = path.join(this.projectPath, "fpga", "sim");
        try{
            const simFolderContent = await Utils.readDirectory(simPath);

            for (const item of simFolderContent) {
                if(item[1] !== FileType.File) continue;
                if(!item[0].endsWith(".vhd") && !item[0].endsWith(".vhdl")) continue;

                const filePath = path.join(simPath, item[0]);
                fpgaData.files.push({
                    path: filePath,
                    content: (new Buffer(await Utils.readFile(filePath))).toString("base64"),
                    simOnly: true,
                    binary: true
                });
            }
        }catch(e){
            console.log("Sim folder does not exist, skipping...");
        }

        // Odstranit duplikátní soubory (zůstane vždy první reference na soubor)
        fpgaData.files = fpgaData.files.filter((f, i) => {
            let findex = fpgaData.files.findIndex(find => find.path === f.path);
            return i === findex;
        });

        // Odstranit duplikátní soubory (zůstane vždy první reference na soubor)
        mcuData.files = mcuData.files.filter((f, i) => {
            let findex = mcuData.files.findIndex(find => find.path === f.path);
            return i === findex;
        });

        // Vložit všechny hlavičkové soubory, které se nachází ve stejných složkách jako
        // linkované .c soubory
        for (const src of mcuData.files) {
            const p = path.dirname(src.path);

            let dir = await Utils.readDirectory(p);
            for (const item of dir) {
                if(item[1] !== FileType.File) continue;
                if(!item[0].endsWith(".h")) continue;

                const headerPath = path.join(p, item[0]);

                // kontrola jestli už neexistuje
                if(mcuData.headers.find(h => h.path === headerPath)) continue;

                mcuData.headers.push({
                    path: headerPath,
                    content: (new Buffer(await Utils.readFile(headerPath))).toString("base64"),
                    binary: true
                });
            }
        }

        return data;
    }
}
