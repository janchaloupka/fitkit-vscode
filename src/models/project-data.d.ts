/**
 * Obecný soubor projektu (může být zdrojový nebo binární soubor)
 */
export interface File{
    /** Cesta k souboru */
    path: string;

    /** Jedná se o binární nebo textový soubor */
    binary: boolean;

    /** Obsah textového souboru nebo binární obsah souboru v kódování Base64 */
    content: string;
}

/**
 * Zdrojový soubor pro překlad FPGA
 */
export interface FpgaFile extends File{
    /** Název knihovny souboru. Pokud není zadáno, použije se název z projektu */
    library?: string;

    /** Soubor má být použit pouze pro simulaci */
    simOnly: boolean;
}

export interface ProjectMcuData {
    /** Má se kompilovat s matematickou knihovnou */
    useMathLib: boolean;

    /** Zdrojové .c soubory */
    files: File[];
    //HeaderFiles: File[]; // Není potřeba, vždy se sestavuje celý projekt

    /** Hlavičkové soubory k .c souborům */
    headers: File[];
}

export interface ProjectFpgaData {
    /** Používá projekt některou z architektur (architektura není "none") */
    usesArchitecture: boolean;

    /** Název nejvyšší entity */
    topLevelEntity: string;

    /** Identifikační řetězec použitého FPGA. Musí obsahovat tři části oddělené pomlčkou */
    chip: string;

    /** Stupeň optimalizace. Formát řetězce je "cíl:stupeň", př. "speed:1" */
    optimization: string;

    /** Frekvence CLK hodin. Podporované možnosti jsou "25MHz", "20MHz", "40MHz" a "50MHz" */
    dcmFrequency: string;

    /** UCF soubor pro syntézu */
    ucfFile: File;

    /** Konfigurační soubor simulace za pomocí ISIM */
    isimFile?: File;

    /** Název knihovny pro překlad */
    library: string;

    //ngcPath?: File; // TODO Podpora vlastní NGC složky v další verzi

    /** Zdrojové soubory .vhd */
    files: FpgaFile[];
}

/**
 * Konfigurace projektu včetně zdrojových souborů
 */
export interface ProjectData {
    /** Konfigurace MCU části */
    mcu?: ProjectMcuData;

    /** Konfigurace FPGA části */
    fpga?: ProjectFpgaData;
}
