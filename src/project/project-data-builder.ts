import { ProjectConfig, FpgaOrderedSource } from '../models/ProjectConfigXml';
import { Repository } from '../repository/Repository';
import { Utils } from '../common/Utils';
import { File, ProjectData } from '../models/ProjectData';
import { ConfigParser } from '../common/ConfigParser';
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
async function FileAbsolutePath(file: string, projectRoot: string, subdir: string): Promise<string>{
    if(path.isAbsolute(file)) return file;

    let relativeToProject = path.join(projectRoot, file);
    if(await Utils.FileExists(relativeToProject))
        return relativeToProject;

    let relativeToSubdir = path.join(projectRoot, subdir, file);
    if(await Utils.FileExists(relativeToSubdir))
        return relativeToSubdir;

    let relativeToRepository = path.join(Repository.Folder.Root, file);
    if(await Utils.FileExists(relativeToRepository))
        return relativeToRepository;

    throw new Error(`File "${file}" was not found relative to project root ("${projectRoot}"), ${subdir} subdirectory or repository root`);
}

/**
 * Vyhledá a načte soubor za pomoci metody `FileAbsolutePath`.
 * Vrátí data a cestu k souboru ve struktuře, ktrou je možné použít při
 * sestavování objektu obsahující projektová data
 *
 * @param path Relativní nebo absolutní cesta k souboru
 * @param projectRoot Absolutní cesta k projektu
 * @param subdir Podadresář zdrojových souborů (typicky "mcu" nebo "fpga")
 */
async function GetFileData(path: string, projectRoot: string, subdir: string): Promise<File>{
    path = await FileAbsolutePath(path, projectRoot, subdir);

    return {
        Path: path,
        Content: (new Buffer(await Utils.ReadFile(path))).toString("base64")
    };
}

/**
 * Pokud projekt specifikuje architekturu, přidá XML konfigurační soubor
 * do seznamu závislostí
 * @param project Daata popiující aktuálně parsovaný projekt
 */
function AppendArchitectureXml(project: ProjectConfig){
    let arch = project.fpga?._architecture ?? "bare";
    if(arch === "none") return;
    let archXml = path.join(Repository.Folder.LibFpga, "chips", `architecture_${arch}`, "package.xml");

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
async function AppendMcuFiles(request: ProjectData, project: ProjectConfig, projectRoot: string){
    let configs: ConfigStackItem[] = [
        {...project, root: projectRoot}
    ];

    while(configs.length > 0){
        let mcu = configs[0].mcu ?? {};

        if(mcu.include){
            if(!(mcu.include instanceof Array)) mcu.include = [mcu.include];
            if (mcu.include.length > 0) {
                let includePath = await FileAbsolutePath(mcu.include[0], configs[0].root, "mcu");
                let includeXml = await ConfigParser.ProjectXml(includePath);
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
                request.Mcu.Files.push(await GetFileData(file, configs[0].root, "mcu"));
            }else{
                request.Mcu.Files.push(await GetFileData(file.$, configs[0].root, "mcu"));
            }
        }

        configs.shift();
    }
}

/**
 * Načte všechny potřebné FPGA soubory, které jsou specifikovány ve všech
 * linkovaných project.xml. souboryj sou načené ve správném pořadí, přesně tak,
 * jak jsou definovány v konfiguračních souborech
 *
 * @param request Cílový objekt, kam se vloží všechny načtené soubory
 * @param project Konfigurace aktuálního projektu
 * @param projectRoot Absolutní cesta ke kořenu projektu
 */
async function AppendFpgaFiles(request: ProjectData, project: ProjectConfig, projectRoot: string){
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
            let xmlPath = await FileAbsolutePath(source.include, projectRoot, "fpga");
            await AppendFpgaFiles(request, await ConfigParser.ProjectXml(xmlPath), path.dirname(xmlPath));
        }else if(source.files){
            if(typeof source.files === "string"){
                for (const file of source.files.match(/\S+/g) ?? []) {
                    request.Fpga.Files.push({
                        ...(await GetFileData(file, projectRoot, "fpga")),
                        SimOnly: false
                    });
                }
            }else{
                for (const file of source.files.$.match(/\S+/g) ?? []) {
                    request.Fpga.Files.push({
                        ...(await GetFileData(file, projectRoot, "fpga")),
                        SimOnly: source.files._context === "sim",
                        Library: source.files._library
                    });
                }
            }
        }else if(source.file){
            if(typeof source.file === "string"){
                request.Fpga.Files.push({
                    ...(await GetFileData(source.file, projectRoot, "fpga")),
                    SimOnly: false
                });
            }else{
                request.Fpga.Files.push({
                    ...(await GetFileData(source.file.$, projectRoot, "fpga")),
                    SimOnly: source.file._context === "sim",
                    Library: source.file._library
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
    public ProjectPath: string;
    public ProjectXmlPath: string;

    /** Cesta k výchozímu UCF souboru */
    private static DefaultUcfFile = path.join(
        Repository.Folder.LibFpga, "chips", "fpga_xc3s50.ucf");

    constructor(projectPath: Uri | string, projectXml: string = "project.xml"){
        this.ProjectPath = typeof projectPath === "string" ? projectPath : projectPath.fsPath;
        this.ProjectXmlPath = path.join(this.ProjectPath, projectXml);
    }

    /**
     * Vytvořit objekt se všemi potřebnými daty pro překlad tohoto projektu
     */
    public async Create(): Promise<ProjectData>{
        let mcuProjectRoot = this.ProjectPath;
        let fpgaProjectRoot = this.ProjectPath;
        let project = await ConfigParser.ProjectXml(this.ProjectXmlPath);

        while(project.fpga?._use){
            // Použít FPGA část odkazovaného projektu
            let useProjectPath = await FileAbsolutePath(project.fpga._use, this.ProjectPath, "fpga");
            let useProject = await ConfigParser.ProjectXml(useProjectPath);
            project.fpga = useProject.fpga;
            fpgaProjectRoot = path.dirname(useProjectPath);
        }

        // Základní kostra dat projektu
        let data: ProjectData = {
            Version: "1.0.0",
            Mcu: {
                UseMathLib: project.mcu?._mathlibrary === "yes",
                Files: [],
                Headers: []
            },
            Fpga: {
                UseArchitecture: (project.fpga?._architecture) !== "none",
                DcmFrequency: project.fpga?._dcmfrequency ?? "25MHz",
                TopLevelEntity: project.fpga?._toplevelentity ?? "fpga",
                Chip: project.fpga?._fpgachip ?? "xc3s50-4-pq208",
                Optimization: project.fpga?._optimization ?? "speed:1",
                Library: project.fpga?._library ?? "work",
                UcfFile: await GetFileData(project.fpga?._ucffile ?? ProjectDataBuilder.DefaultUcfFile, this.ProjectPath, "fpga"),
                Files: []
            }
        };

        // Načtení konfiguračního souboru ISIM
        try{
            const isimFile = path.join(this.ProjectPath, "fpga", "sim", "isim.tcl");
            data.Fpga.IsimFile = {
                Path: isimFile,
                Content: (new Buffer(await Utils.ReadFile(isimFile))).toString("base64")
            };
        }catch(e){
            console.log("Project does not contain ISIM configuration file");
        }

        // Načíst všechny potřebné zdrojové soubory
        AppendArchitectureXml(project);
        await AppendFpgaFiles(data, project, fpgaProjectRoot);
        await AppendMcuFiles(data, project, mcuProjectRoot);

        // Přidat soubory simulace (testbench soubory)
        const simPath = path.join(this.ProjectPath, "fpga", "sim");
        try{
            const simFolderContent = await Utils.ReadDirectory(simPath);

            for (const item of simFolderContent) {
                if(item[1] !== FileType.File) continue;
                if(!item[0].endsWith(".vhd") && !item[0].endsWith(".vhdl")) continue;

                const filePath = path.join(simPath, item[0]);
                data.Fpga.Files.push({
                    Path: filePath,
                    Content: (new Buffer(await Utils.ReadFile(filePath))).toString("base64"),
                    SimOnly: true
                });
            }
        }catch(e){
            console.log("Sim folder does not exist, skipping...");
        }

        // Odstranit duplikátní soubory (zůstane vždy první reference na soubor)
        data.Fpga.Files = data.Fpga.Files.filter((f, i) => {
            let findex = data.Fpga.Files.findIndex(find => find.Path === f.Path);
            return i === findex;
        });

        // Odstranit duplikátní soubory (zůstane vždy první reference na soubor)
        data.Mcu.Files = data.Mcu.Files.filter((f, i) => {
            let findex = data.Mcu.Files.findIndex(find => find.Path === f.Path);
            return i === findex;
        });

        // Vložit všechny hlavičkové soubory, které se nachází ve stejných složkách jako
        // linkované .c soubory
        for (const src of data.Mcu.Files) {
            const p = path.dirname(src.Path);

            let dir = await Utils.ReadDirectory(p);
            for (const item of dir) {
                if(item[1] !== FileType.File) continue;
                if(!item[0].endsWith(".h")) continue;

                const headerPath = path.join(p, item[0]);

                // kontrola jestli už neexistuje
                if(data.Mcu.Headers.find(h => h.Path === headerPath)) continue;

                data.Mcu.Headers.push({
                    Path: headerPath,
                    Content: (new Buffer(await Utils.ReadFile(headerPath))).toString("base64")
                });
            }
        }

        return data;
    }
}
